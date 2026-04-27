"""FastAPI entry point for the Cambridge KET/PET AI service.

Responsibilities right now (Phase 1, Step 9):
  * /health  - public liveness probe (Docker/Zeabur healthcheck).
  * /ready   - public readiness probe; reports whether upstream AI providers
               are configured, WITHOUT revealing any secret values.
  * /v1/ping - internal auth smoke test (Bearer shared-secret); will be
               replaced by real generator/grader endpoints in Step 10+.
"""

from __future__ import annotations

import logging
import os
from typing import Annotated, Any, Literal

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, status
from pydantic import BaseModel

from app.agents.analysis import analyze_student
from app.agents.diagnose_analysis import analyze_diagnose
from app.agents.diagnose_generator import (
    DiagnoseGenerationError,
    generate_diagnose_test,
)
from app.agents.diagnose_summary import summarize_diagnose
from app.agents.grammar_generator import run_grammar_generate
from app.agents.listening_generator import generate_listening_test
from app.agents.reading import generate_reading_test
from app.agents.speaking_examiner import run_examiner_turn
from app.agents.speaking_generator import generate_speaking_prompts
from app.agents.speaking_scorer import score_speaking_attempt
from app.agents.vocab_gloss import run_vocab_gloss
from app.agents.writing import generate_writing_test, grade_writing_response
from app.prompts.reading import UnsupportedReadingPart
from app.prompts.writing import UnsupportedWritingPart
from app.schemas.analysis import (
    StudentAnalysisRequest,
    StudentAnalysisResponse,
)
from app.schemas.diagnose import (
    DiagnoseAIGenerateResponse,
    DiagnoseAnalysisRequest,
    DiagnoseAnalysisResponse,
    DiagnoseGenerateRequest,
    DiagnoseSummaryRequest,
    DiagnoseSummaryResponse,
)
from app.schemas.grammar import (
    GrammarGenerateRequest,
    GrammarGenerateResponse,
)
from app.schemas.listening import ListeningTestResponse
from app.schemas.reading import ReadingTestRequest, ReadingTestResponse
from app.schemas.speaking import (
    SpeakingExaminerReply,
    SpeakingPrompts,
    SpeakingScore,
)
from app.schemas.vocab import VocabGlossRequest, VocabGlossResponse
from app.schemas.writing import (
    WritingGradeRequest,
    WritingGradeResponse,
    WritingTestRequest,
    WritingTestResponse,
)
from app.validators.reading import validate_reading_test
from app.validators.writing import validate_writing_test


class ListeningGenerateRequest(BaseModel):
    exam_type: Literal["KET", "PET"]
    scope: Literal["FULL", "PART"]
    part: int | None = None
    mode: Literal["PRACTICE", "MOCK"] = "PRACTICE"
    seed_exam_points: list[str] = []

load_dotenv()

log = logging.getLogger("ketpet-ai")
logging.basicConfig(level=logging.INFO)

INTERNAL_SHARED_SECRET: str = os.environ.get("INTERNAL_SHARED_SECRET", "")

app = FastAPI(
    title="Cambridge KET/PET AI Service",
    version="0.1.0",
    description=(
        "Pydantic-AI-powered generators and graders for KET (A2 Key) and "
        "PET (B1 Preliminary) practice tests. Called internally by the "
        "Next.js app over HTTP with a shared-secret Bearer header."
    ),
)


async def verify_internal_auth(
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    """Require callers to send `Authorization: Bearer <INTERNAL_SHARED_SECRET>`.

    In local dev, if the env var is empty/unset, auth is treated as disabled
    so curl smoke tests don't need the header. In any environment where the
    secret IS set (CI, staging, prod), the header is required and must match.
    """
    if not INTERNAL_SHARED_SECRET:
        return
    expected = f"Bearer {INTERNAL_SHARED_SECRET}"
    if authorization != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing internal shared secret",
        )


@app.get("/health")
def health() -> dict[str, str]:
    """Public liveness probe."""
    return {"status": "ok", "service": "ketpet-ai", "version": app.version}


@app.get("/ready")
def ready() -> dict[str, object]:
    """Public readiness probe. Booleans only — never leaks key values."""
    return {
        "status": "ready",
        "providers": {
            "deepseek": bool(os.environ.get("DEEPSEEK_API_KEY")),
            "siliconflow": bool(os.environ.get("SILICONFLOW_API_KEY")),
            "dashscope": bool(os.environ.get("DASHSCOPE_API_KEY")),
        },
        "internal_auth_enabled": bool(INTERNAL_SHARED_SECRET),
    }


@app.get("/v1/ping", dependencies=[Depends(verify_internal_auth)])
def ping() -> dict[str, str]:
    """Authenticated ping — verifies the Next.js <-> AI shared-secret
    handshake works end-to-end."""
    return {"pong": "ketpet-ai"}


@app.post(
    "/v1/reading/generate",
    response_model=ReadingTestResponse,
    dependencies=[Depends(verify_internal_auth)],
)
async def reading_generate(req: ReadingTestRequest) -> ReadingTestResponse:
    """Generate a fresh KET/PET reading test.

    Retries up to 3 times on format-validator failure; after that, returns
    422 so the Next.js caller can surface a user-visible error.
    """
    try:
        last_errors: list[str] = []
        for attempt in range(1, 4):
            try:
                response = await generate_reading_test(req)
            except UnsupportedReadingPart as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(e),
                ) from e

            errors = validate_reading_test(response, req.exam_type, req.part)
            if not errors:
                if attempt > 1:
                    log.info("reading_generate succeeded on attempt %d", attempt)
                return response

            last_errors = [f"{e.code}: {e.message}" for e in errors]
            log.warning(
                "reading_generate attempt %d failed format checks: %s",
                attempt,
                last_errors,
            )

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "generation_failed_validation",
                "message": (
                    "The generator could not produce a valid test after 3 "
                    "attempts. Please retry."
                ),
                "last_errors": last_errors,
            },
        )
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001 — last-resort log + 500
        log.exception("reading_generate unexpected failure")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal error generating reading test",
        ) from e


@app.post(
    "/v1/writing/generate",
    response_model=WritingTestResponse,
    dependencies=[Depends(verify_internal_auth)],
)
async def writing_generate(req: WritingTestRequest) -> WritingTestResponse:
    """Generate a fresh KET/PET writing task. Retries up to 3 times on
    format-validator failure; returns 422 after that."""
    try:
        last_errors: list[str] = []
        for attempt in range(1, 4):
            try:
                response = await generate_writing_test(req)
            except UnsupportedWritingPart as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(e),
                ) from e

            errors = validate_writing_test(response, req.exam_type, req.part)
            if not errors:
                if attempt > 1:
                    log.info("writing_generate succeeded on attempt %d", attempt)
                return response

            last_errors = [f"{e.code}: {e.message}" for e in errors]
            log.warning(
                "writing_generate attempt %d failed format checks: %s",
                attempt,
                last_errors,
            )

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "generation_failed_validation",
                "message": (
                    "The generator could not produce a valid writing task "
                    "after 3 attempts. Please retry."
                ),
                "last_errors": last_errors,
            },
        )
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001 — last-resort log + 500
        log.exception("writing_generate unexpected failure")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal error generating writing task",
        ) from e


@app.post(
    "/v1/analysis/student",
    response_model=StudentAnalysisResponse,
    dependencies=[Depends(verify_internal_auth)],
)
async def student_analysis(
    req: StudentAnalysisRequest,
) -> StudentAnalysisResponse:
    """Teacher-style diagnostic for one student. Returns 4 zh-CN fields:
    strengths, weaknesses, priority_actions, narrative_zh. Grounded in the
    caller-provided performance summary JSON."""
    try:
        return await analyze_student(req)
    except Exception as e:  # noqa: BLE001
        log.exception("student_analysis unexpected failure")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal error producing student analysis",
        ) from e


# ===== Diagnose v2 endpoints =====
# T11/T12/T13 agents wired up here. /v1/diagnose/generate returns 502 with a
# {failed_section, message} payload on DiagnoseGenerationError so the
# apps/web caller can decide whether to retry just the failed section. The
# analysis and summary endpoints return 500 on any agent failure.


@app.post(
    "/v1/diagnose/generate",
    response_model=DiagnoseAIGenerateResponse,
    dependencies=[Depends(verify_internal_auth)],
)
async def diagnose_generate(req: DiagnoseGenerateRequest) -> DiagnoseAIGenerateResponse:
    try:
        return await generate_diagnose_test(req)
    except DiagnoseGenerationError as exc:
        raise HTTPException(
            status_code=502,
            detail={"failed_section": exc.failed_section, "message": str(exc)[:500]},
        ) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)[:500]) from exc


@app.post(
    "/v1/diagnose/analysis",
    response_model=DiagnoseAnalysisResponse,
    dependencies=[Depends(verify_internal_auth)],
)
async def diagnose_analysis(req: DiagnoseAnalysisRequest) -> DiagnoseAnalysisResponse:
    try:
        return await analyze_diagnose(req)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)[:500]) from exc


@app.post(
    "/v1/diagnose/summary",
    response_model=DiagnoseSummaryResponse,
    dependencies=[Depends(verify_internal_auth)],
)
async def diagnose_summary(req: DiagnoseSummaryRequest) -> DiagnoseSummaryResponse:
    try:
        return await summarize_diagnose(req)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)[:500]) from exc


@app.post(
    "/v1/writing/grade",
    response_model=WritingGradeResponse,
    dependencies=[Depends(verify_internal_auth)],
)
async def writing_grade(req: WritingGradeRequest) -> WritingGradeResponse:
    """Grade a student's writing submission using DeepSeek R1 against the
    4-criteria Cambridge rubric. Returns scores (each 0-5) + total_band
    (0-20) + Chinese feedback + Chinese suggestions."""
    try:
        return await grade_writing_response(req)
    except UnsupportedWritingPart as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except Exception as e:  # noqa: BLE001
        log.exception("writing_grade unexpected failure")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal error grading writing",
        ) from e


@app.post(
    "/v1/listening/generate",
    response_model=ListeningTestResponse,
    dependencies=[Depends(verify_internal_auth)],
)
async def listening_generate(
    req: ListeningGenerateRequest,
) -> ListeningTestResponse:
    """Generate a fresh KET/PET listening test. Returns 400 on invalid
    scope/part combination, 422 if the generator cannot produce a valid
    test after MAX_ATTEMPTS."""
    if req.scope == "PART" and req.part is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="scope=PART requires a part number",
        )
    try:
        return await generate_listening_test(
            exam_type=req.exam_type,
            scope=req.scope,
            part=req.part,
            seed_exam_points=req.seed_exam_points,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "validation_failed", "message": str(e)},
        ) from e


# ---------------------------------------------------------------------------
# Phase 3 Speaking — generate / examiner / examiner-warmup / score
# ---------------------------------------------------------------------------


class SpeakingGenerateBody(BaseModel):
    level: str  # "KET" | "PET"
    photo_briefs: list[dict[str, Any]] = []


class SpeakingExaminerBody(BaseModel):
    prompts: SpeakingPrompts
    history: list[dict[str, str]]
    current_part: int
    # Number of examiner questions ALREADY ISSUED in current_part. Drives
    # the script-progression cursor inside the examiner agent so it picks
    # examinerScript[N] next instead of cycling back to script[0].
    current_part_question_count: int = 0


class SpeakingScoreBody(BaseModel):
    level: str
    transcript: list[dict[str, Any]]


@app.post(
    "/speaking/examiner-warmup",
    dependencies=[Depends(verify_internal_auth)],
)
async def speaking_examiner_warmup() -> dict:
    """No-op: primes the DeepSeek HTTP client on runner mount."""
    return {"ok": True}


@app.post(
    "/speaking/generate",
    response_model=SpeakingPrompts,
    dependencies=[Depends(verify_internal_auth)],
)
async def speaking_generate(body: SpeakingGenerateBody) -> SpeakingPrompts:
    return await generate_speaking_prompts(
        level=body.level, photo_briefs=body.photo_briefs
    )


@app.post(
    "/speaking/examiner",
    response_model=SpeakingExaminerReply,
    dependencies=[Depends(verify_internal_auth)],
)
async def speaking_examiner(body: SpeakingExaminerBody) -> SpeakingExaminerReply:
    return await run_examiner_turn(
        prompts=body.prompts,
        history=body.history,
        current_part=body.current_part,
        current_part_question_count=body.current_part_question_count,
    )


@app.post(
    "/speaking/score",
    response_model=SpeakingScore,
    dependencies=[Depends(verify_internal_auth)],
)
async def speaking_score(body: SpeakingScoreBody) -> SpeakingScore:
    return await score_speaking_attempt(
        level=body.level, transcript=body.transcript
    )


# ---------------------------------------------------------------------------
# Phase 4a Vocab — batch gloss generation for Cambridge wordlists
# ---------------------------------------------------------------------------


@app.post(
    "/vocab-gloss",
    response_model=VocabGlossResponse,
    dependencies=[Depends(verify_internal_auth)],
)
async def vocab_gloss_endpoint(req: VocabGlossRequest) -> VocabGlossResponse:
    """Batch-translate Cambridge wordlist entries to Chinese gloss + example.

    Called by the seed script `apps/web/scripts/generate-vocab-glosses.ts`
    one batch (≤100 words) per request. The agent retries up to 3 times on
    validator failure (coverage + per-item example-contains-headword).
    Returns 422 if generation fails after all retries.
    """
    try:
        return await run_vocab_gloss(req)
    except Exception as e:  # noqa: BLE001 — surface validator failure as 422
        log.exception("vocab_gloss endpoint failed after retries")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "vocab_gloss_failed", "message": str(e)},
        ) from e


# ---------------------------------------------------------------------------
# Phase 4b Grammar — per-topic MCQ generation for Cambridge grammar topics
# ---------------------------------------------------------------------------


@app.post(
    "/grammar-generate",
    response_model=GrammarGenerateResponse,
    dependencies=[Depends(verify_internal_auth)],
)
async def grammar_generate_endpoint(
    req: GrammarGenerateRequest,
) -> GrammarGenerateResponse:
    """Generate a batch of 4-option MCQ grammar items for one topic.

    Called by the seed script `apps/web/scripts/seed-grammar-questions.ts`
    one batch (count <= 30) per request. The agent retries up to 3 times on
    validator failure (blank-count + classification-reject + vocab-in-level
    + dedupe). Returns 422 on validator failure after all retries; 500 on
    unexpected errors (e.g., DeepSeek connectivity).
    """
    try:
        return await run_grammar_generate(req)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "grammar_generate_failed", "message": str(e)},
        ) from e
    except Exception as e:  # noqa: BLE001 — surface unexpected as 500
        log.exception("grammar_generate endpoint failed unexpectedly")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "grammar_generate_unexpected", "message": str(e)},
        ) from e
