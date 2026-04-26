"""Orchestrator agent for the Diagnose v2 weekly diagnose feature.

Composes the 4 AI-generated sections (Reading, Listening, Writing, Speaking)
by calling the existing per-kind generators in parallel via
``asyncio.gather(return_exceptions=True)``. Returns a
``DiagnoseAIGenerateResponse`` carrying the RAW generator outputs — apps/web
later extracts what it needs (e.g., speaking prompts for the Test row's
``speakingPrompts`` column, listening audio script for Edge-TTS rendering)
and composes the full ``Test.payload`` with the bank-sampled vocab + grammar.

Architectural decision (settled by the user 2026-04-26):
  * services/ai stays stateless — NO Postgres dep added here.
  * Vocab + Grammar bank-sampling happens in apps/web (T18 generate route),
    NOT in this orchestrator. The Cambridge wordlist and grammar topic
    tables live in apps/web's database, and pulling them through services/ai
    would either duplicate the DB connection or require ad-hoc HTTP calls
    back into apps/web — both worse than letting apps/web do it directly.
  * This orchestrator therefore wraps ONLY the 4 AI generators.

Output schema choice (per T11 spec):
  We use the "raw response schemas" approach — ``DiagnoseAIGenerateResponse``
  carries ``ReadingTestResponse`` / ``ListeningTestResponse`` /
  ``WritingTestResponse`` / ``SpeakingPrompts`` directly (lowercase field
  names). apps/web extracts and adapts these into the
  ``DiagnoseReadingContent`` / ``DiagnoseListeningContent`` / etc. shapes
  that ultimately land in ``Test.payload.sections.<KIND>``. This avoids
  data loss: speaking prompts, listening audio scripts, and per-question
  exam-point IDs all survive the orchestrator → apps/web hop.

Failure handling:
  ``asyncio.gather(return_exceptions=True)`` so one failing sub-generator
  doesn't cancel its siblings. After gather, we walk results in order and
  raise ``DiagnoseGenerationError(failed_section, original_exception)`` for
  the first failure encountered. Multiple failures are not surfaced —
  consistent with the failure model in ``analysis.py:188-212``, which
  accepts the first valid output it can produce. The caller (apps/web's
  T18 generate route) maps this exception to a 500 response.

Input mapping caveats (documented per T11 reporting requirement):
  * Reading: existing generator requires a specific ``part`` int. Diagnose
    has one consolidated reading section, so we pin Part 4 (KET R Part 4
    is MCQ_CLOZE on a passage; PET R Part 4 is MCQ on a passage). These
    are the most "diagnostic" parts — passage + multiple-choice — and they
    align with the diagnose UI's single-passage flow.
  * Writing: similarly pinned. KET → Part 6 (email with content points),
    PET → Part 1 (email with content points). Email tasks have explicit
    content points that fit the diagnose's writing UX best.
  * Listening: scope=FULL gets all parts; apps/web extracts the audio_script
    and renders Edge-TTS later. The generator's ``seed_exam_points`` carries
    the focus_area exam_point_ids.
  * Speaking: existing generator takes ``photo_briefs: list[dict]`` (no
    exam_points input). For diagnose, we pass an empty list — apps/web
    can supply photo briefs in a future enhancement, but the speaking
    generator's prompt happily produces sensible content with an empty
    list (defaults to generic-topic photo descriptions).
"""

from __future__ import annotations

import asyncio
import logging

from app.agents.listening_generator import generate_listening_test
from app.agents.reading import generate_reading_test
from app.agents.speaking_generator import generate_speaking_prompts
from app.agents.writing import generate_writing_test
from app.schemas.diagnose import DiagnoseAIGenerateResponse, DiagnoseGenerateRequest
from app.schemas.listening import ListeningTestResponse
from app.schemas.reading import ReadingTestRequest, ReadingTestResponse
from app.schemas.speaking import SpeakingPrompts
from app.schemas.writing import WritingTestRequest, WritingTestResponse

log = logging.getLogger(__name__)


# Section pinning — see module docstring for rationale.
_READING_PART_BY_EXAM = {"KET": 4, "PET": 4}
_WRITING_PART_BY_EXAM = {"KET": 6, "PET": 1}


class DiagnoseGenerationError(Exception):
    """Raised when one or more sub-generators failed during orchestration.

    Attributes:
        failed_section: the section name (READING/LISTENING/WRITING/SPEAKING)
            whose generator raised. Useful for structured error responses
            so the apps/web caller can hint to the user which section blew up.
        original_exception: the exception raised by the sub-generator.
    """

    def __init__(self, failed_section: str, original_exception: Exception):
        super().__init__(
            f"Diagnose section {failed_section} generation failed: "
            f"{original_exception!r}"
        )
        self.failed_section = failed_section
        self.original_exception = original_exception


def _focus_exam_points(req: DiagnoseGenerateRequest) -> list[str]:
    """Extract exam_point_ids from focus_areas for use as seed hints."""
    return [fa.exam_point_id for fa in req.focus_areas]


async def _generate_diagnose_reading(
    req: DiagnoseGenerateRequest,
) -> ReadingTestResponse:
    """Sub-orchestrator for the Reading section.

    Pins to Part 4 (passage + MCQ) for both KET and PET — the most
    diagnostic reading-comprehension format. Forwards focus_areas as
    seed_exam_points so the generated questions tilt toward the user's
    last-week weak points.
    """
    reading_req = ReadingTestRequest(
        exam_type=req.exam_type,
        part=_READING_PART_BY_EXAM[req.exam_type],
        mode="PRACTICE",
        seed_exam_points=_focus_exam_points(req),
    )
    return await generate_reading_test(reading_req)


async def _generate_diagnose_listening(
    req: DiagnoseGenerateRequest,
) -> ListeningTestResponse:
    """Sub-orchestrator for the Listening section.

    Uses scope=FULL so we get the whole listening exam (apps/web later
    extracts a subset for the diagnose's smaller question count when
    composing Test.payload). The audio_script lives inside the response;
    apps/web's T18 route renders it via Edge-TTS to populate the Test
    row's audio_r2_key column.
    """
    return await generate_listening_test(
        exam_type=req.exam_type,
        scope="FULL",
        part=None,
        seed_exam_points=_focus_exam_points(req),
    )


async def _generate_diagnose_writing(
    req: DiagnoseGenerateRequest,
) -> WritingTestResponse:
    """Sub-orchestrator for the Writing section.

    Pins to KET Part 6 / PET Part 1 — both are guided email tasks with
    explicit content points, which is the diagnose-writing UX shape.
    Forwards focus_areas as seed_exam_points.
    """
    writing_req = WritingTestRequest(
        exam_type=req.exam_type,
        part=_WRITING_PART_BY_EXAM[req.exam_type],
        seed_exam_points=_focus_exam_points(req),
    )
    return await generate_writing_test(writing_req)


async def _generate_diagnose_speaking(
    req: DiagnoseGenerateRequest,
) -> SpeakingPrompts:
    """Sub-orchestrator for the Speaking section.

    The existing speaking generator takes a level + photo_briefs list.
    There's no exam_points hook — speaking prompts are open-ended dialogue
    rather than discrete grammar/vocab probes. We pass an empty
    photo_briefs list; the generator defaults to generic-topic photo
    descriptions, which is fine for the diagnose's first pass.

    apps/web later splits this response onto the Test row:
      - SpeakingPrompts.parts → Test.speakingPrompts JSON column
      - SpeakingPrompts.initialGreeting → Test.speakingPersona / payload
      - per-part photoKey → Test.speakingPhotoKeys (resolved from R2)
    """
    return await generate_speaking_prompts(
        level=req.exam_type,
        photo_briefs=[],
    )


async def generate_diagnose_test(
    req: DiagnoseGenerateRequest,
) -> DiagnoseAIGenerateResponse:
    """Orchestrate generation of the 4 AI-generated diagnose sections in parallel.

    Calls the existing per-kind generators (reading, listening, writing,
    speaking) concurrently via ``asyncio.gather(return_exceptions=True)``.
    Each generator does its own DeepSeek call + retry loop internally;
    this orchestrator only sequences them.

    Returns a ``DiagnoseAIGenerateResponse`` carrying the RAW generator
    outputs. Truncation/adaptation to the diagnose-payload section shapes
    (3 questions, 1 prompt, etc.) happens in apps/web's T18 generate route,
    where the AI half is composed with bank-sampled vocab + grammar.

    Vocab + Grammar are bank-sampled in apps/web — NOT generated here.

    Failure handling: if any sub-generator raises, we propagate as a typed
    ``DiagnoseGenerationError`` with a ``failed_section`` attribute
    identifying which generator failed. ``return_exceptions=True`` ensures
    partial failures don't cancel siblings — every generator gets a chance
    to finish (and consume its DeepSeek tokens) so the user can retry just
    the failed sections in a future enhancement.
    """
    # Build the gather coroutines in a stable order so we can pair results
    # back to section names by index.
    coros = {
        "READING": _generate_diagnose_reading(req),
        "LISTENING": _generate_diagnose_listening(req),
        "WRITING": _generate_diagnose_writing(req),
        "SPEAKING": _generate_diagnose_speaking(req),
    }
    names = list(coros.keys())
    results = await asyncio.gather(*coros.values(), return_exceptions=True)

    # Walk results in order — first exception becomes the typed error.
    # Mirrors analysis.py:188-212: surface one structured failure rather
    # than aggregating every error (apps/web's UX shows a single retry
    # button, not a multi-section error list).
    for name, result in zip(names, results):
        if isinstance(result, Exception):
            log.exception(
                "diagnose_generator: section %s failed",
                name,
                exc_info=result,
            )
            raise DiagnoseGenerationError(name, result)

    # All four succeeded — pack into the response by index.
    reading_result, listening_result, writing_result, speaking_result = results
    return DiagnoseAIGenerateResponse(
        reading=reading_result,  # type: ignore[arg-type]
        listening=listening_result,  # type: ignore[arg-type]
        writing=writing_result,  # type: ignore[arg-type]
        speaking=speaking_result,  # type: ignore[arg-type]
    )
