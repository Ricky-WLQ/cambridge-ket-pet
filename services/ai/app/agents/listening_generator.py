"""Pydantic AI agent for Phase 2 listening generation.

Mirrors the pattern from reading_generator and writing_generator in Phase 1.

**Lazy-build note:** the Agent is built on first call to
`get_listening_generator()`, NOT at module import time. This ensures
`load_dotenv()` (called in app/main.py during FastAPI startup) has already
populated `DEEPSEEK_API_KEY` before we read it. A previous version of
this module built the Agent at import time, which captured None for the
key in environments where `.env` provided it, causing silent 401s at
request time.

The built Agent is cached on first call; subsequent calls return the
cached instance. For tests, patch `get_listening_generator` to return
a mock Agent.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Literal

from pydantic_ai import Agent, UnexpectedModelBehavior
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.prompts.listening_system import LISTENING_SYSTEM_PROMPT
from app.schemas.listening import ListeningTestResponse
from app.validators.listening import validate_listening_response
from app.validators.reading import ValidationError

log = logging.getLogger(__name__)


def _build_agent() -> Agent[None, ListeningTestResponse]:
    """Build a new listening generator Agent with DeepSeek backend.

    Reads `DEEPSEEK_API_KEY` from env at call time (not at import time).
    """
    model = OpenAIChatModel(
        model_name="deepseek-chat",
        provider=OpenAIProvider(
            base_url="https://api.deepseek.com/v1",
            api_key=os.environ.get("DEEPSEEK_API_KEY"),
        ),
    )
    return Agent(
        model=model,
        output_type=ListeningTestResponse,
        system_prompt=LISTENING_SYSTEM_PROMPT,
        # Two pydantic-ai-side retries (3 total LLM attempts per agent.run)
        # for the rare case where DeepSeek's tool-call args have trailing
        # characters or malformed JSON. The outer MAX_ATTEMPTS loop below
        # also catches UnexpectedModelBehavior to give us further headroom.
        retries=2,
    )


# DeepSeek's default max_tokens (~4096) is too small for the structured
# listening response: a single PART produces 5 questions × {prompt, 3 options,
# answer, explanation} + a multi-turn audio_script + per-part metadata. The
# pydantic-ai tool-call wrapping easily pushes output past 4k. When truncated
# mid-tool-call, pydantic-ai raises IncompleteToolCall and the diagnose
# orchestrator surfaces 502. 8000 is just under DeepSeek-chat's 8192 ceiling.
# IMPORTANT: pydantic-ai applies model_settings only when passed to
# `agent.run(...)`, NOT when passed to `Agent(...)` constructor — see the
# working pattern in speaking_examiner.py:60.
LISTENING_MODEL_SETTINGS = {"max_tokens": 8000}


_agent_cache: Agent[None, ListeningTestResponse] | None = None


def get_listening_generator() -> Agent[None, ListeningTestResponse]:
    """Return the cached listening generator Agent, building on first call.

    Cached at module scope after first successful build.
    """
    global _agent_cache
    if _agent_cache is None:
        _agent_cache = _build_agent()
    return _agent_cache


MAX_ATTEMPTS = 3

# Number of parts in a FULL listening test, by exam type. Mirrors the canonical
# counts in app.validators.listening._QUESTION_COUNTS / _PART_KIND.
_FULL_PART_COUNT: dict[str, int] = {"KET": 5, "PET": 4}


async def generate_listening_test(
    exam_type: Literal["KET", "PET"],
    scope: Literal["FULL", "PART"],
    *,
    part: int | None = None,
    seed_exam_points: list[str] | None = None,
) -> ListeningTestResponse:
    """Generate + validate a listening test.

    For ``scope="PART"``: a single DeepSeek call generates the requested part,
    with the existing retry orchestration (pydantic-ai retries=2 + outer
    MAX_ATTEMPTS=3 with try/except UnexpectedModelBehavior).

    For ``scope="FULL"``: fans out to ``N`` parallel ``scope="PART"`` calls
    (N=5 for KET, N=4 for PET) and merges the per-part responses. This avoids
    the DeepSeek 8000-token output-cap that consistently truncates whole-test
    generations and surfaces as ``UnexpectedModelBehavior(IncompleteToolCall)``.
    Each per-part call comfortably fits in 8000 tokens.

    Raises ValueError when generation or merged validation fails.
    """
    seed_exam_points = seed_exam_points or []
    if scope == "FULL":
        return await _generate_full_via_parts(exam_type, seed_exam_points)
    return await _generate_single_part(
        exam_type, scope, part=part, seed_exam_points=seed_exam_points
    )


async def _generate_full_via_parts(
    exam_type: Literal["KET", "PET"],
    seed_exam_points: list[str],
) -> ListeningTestResponse:
    """Fan out FULL generation to N parallel per-part calls and merge."""
    part_count = _FULL_PART_COUNT[exam_type]
    log.info(
        "generate_listening_test scope=FULL fanning out to %d parallel "
        "per-part calls (exam_type=%s)",
        part_count,
        exam_type,
    )
    tasks = [
        _generate_single_part(
            exam_type, "PART", part=part_num, seed_exam_points=seed_exam_points
        )
        for part_num in range(1, part_count + 1)
    ]
    # Fail-fast: if any per-part call raises ValueError after its own retry
    # budget, the first such exception propagates. The other in-flight tasks
    # are not cancelled by default — they run to completion in the background
    # but their results are discarded. This matches the diagnose orchestrator's
    # pattern (services/ai/app/agents/diagnose_generator.py).
    part_responses: list[ListeningTestResponse] = await asyncio.gather(*tasks)

    merged_parts = [r.parts[0] for r in part_responses]
    merged = ListeningTestResponse(
        version=2,
        exam_type=exam_type,
        scope="FULL",
        part=None,
        parts=merged_parts,
        cefr_level="A2" if exam_type == "KET" else "B1",
    )

    # Sanity-check the merged shape (catches duplicate part_numbers, wrong
    # ordering, or a per-part response that somehow returned the wrong part).
    merge_errors = validate_listening_response(merged)
    if merge_errors:
        error_msgs = "; ".join(f"{e.code}: {e.message}" for e in merge_errors)
        log.error(
            "generate_listening_test FULL merge validation failed "
            "(exam_type=%s): %s",
            exam_type,
            error_msgs,
        )
        raise ValueError(
            f"Listening FULL merge validation failed: {error_msgs}"
        )
    return merged


async def _generate_single_part(
    exam_type: Literal["KET", "PET"],
    scope: Literal["FULL", "PART"],
    *,
    part: int | None,
    seed_exam_points: list[str],
) -> ListeningTestResponse:
    """One-shot generation for a single part (or, legacy, FULL scope when
    callers bypass the fan-out path — currently no callers do).

    Implements the retry orchestration: pydantic-ai's internal retries=2 plus
    an outer MAX_ATTEMPTS loop that catches ``UnexpectedModelBehavior``
    (commonly from DeepSeek's tool-call output truncation or trailing chars)
    and treats it the same as a Cambridge-format-check failure.
    """
    prompt = (
        f"Generate a {exam_type} listening test. "
        f"scope={scope}. "
        + (f"part={part}. " if part is not None else "")
        + (
            f"Emphasize these exam points: {seed_exam_points}. "
            if seed_exam_points
            else ""
        )
    )

    last_errors: list[ValidationError] | None = None
    last_response: ListeningTestResponse | None = None
    last_pydantic_error: UnexpectedModelBehavior | None = None
    last_failure_kind: Literal["pydantic", "format"] | None = None

    for _attempt in range(MAX_ATTEMPTS):
        agent = get_listening_generator()
        try:
            run = await agent.run(prompt, model_settings=LISTENING_MODEL_SETTINGS)
        except UnexpectedModelBehavior as e:
            last_pydantic_error = e
            last_failure_kind = "pydantic"
            log.warning(
                "generate_listening_test attempt %d (exam_type=%s scope=%s "
                "part=%s) raised UnexpectedModelBehavior: %s",
                _attempt + 1,
                exam_type,
                scope,
                part,
                repr(e)[:500],
            )
            continue

        response: ListeningTestResponse = run.output
        errors = validate_listening_response(response)
        if not errors:
            if _attempt > 0:
                log.info(
                    "generate_listening_test succeeded on attempt %d (after %d failed attempts)",
                    _attempt + 1,
                    _attempt,
                )
            return response
        last_errors = errors
        last_response = response
        last_failure_kind = "format"
        log.warning(
            "generate_listening_test attempt %d failed format checks: %s",
            _attempt + 1,
            [f"{e.code}: {e.message}" for e in errors],
        )

    if last_failure_kind == "pydantic" and last_pydantic_error is not None:
        log.error(
            "generate_listening_test gave up after %d attempts (last failure: "
            "pydantic-ai schema validation; exam_type=%s scope=%s part=%s): %s",
            MAX_ATTEMPTS,
            exam_type,
            scope,
            part,
            repr(last_pydantic_error)[:500],
        )
        raise ValueError(
            f"Listening generation pydantic schema validation failed after "
            f"{MAX_ATTEMPTS} attempts: {last_pydantic_error}"
        ) from last_pydantic_error

    assert last_errors is not None
    error_msgs = "; ".join(f"{e.code}: {e.message}" for e in last_errors)
    log.error(
        "generate_listening_test gave up after %d attempts; last response: %s",
        MAX_ATTEMPTS,
        last_response.model_dump_json()[:2000] if last_response else "None",
    )
    raise ValueError(
        f"Listening generation validation failed after {MAX_ATTEMPTS} attempts: {error_msgs}"
    )
