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
from typing import Annotated

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, status

from app.agents.reading import generate_reading_test
from app.prompts.reading import UnsupportedReadingPart
from app.schemas.reading import ReadingTestRequest, ReadingTestResponse
from app.validators.reading import validate_reading_test

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
