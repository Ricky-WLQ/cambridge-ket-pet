"""Pydantic AI agent for Phase 2 listening generation.

Uses the same "string output + json_object response_format + manual extract"
pattern as `speaking_generator.py` because pydantic-ai's tool-call output_type
mode trips on a known DeepSeek quirk: tool-call args occasionally include
trailing characters after the closing `}`, surfacing as
`pydantic_core.ValidationError: Invalid JSON: trailing characters` even though
the JSON itself is well-formed. Bypassing tool-call output and using
`extract_json_object` (which strips fences and trims to the first balanced
`{...}`) sidesteps that.

**Lazy-build note:** the Agent is built on first call to
`get_listening_generator()`, NOT at module import time. This ensures
`load_dotenv()` (called in app/main.py during FastAPI startup) has already
populated `DEEPSEEK_API_KEY` before we read it.
"""

from __future__ import annotations

import logging
import os
from typing import Literal

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.prompts.listening_system import LISTENING_SYSTEM_PROMPT
from app.schemas.listening import ListeningTestResponse
from app.validators.listening import validate_listening_response
from app.validators.reading import ValidationError
from app.validators.speaking import extract_json_object

log = logging.getLogger(__name__)


def _build_agent() -> Agent[None, str]:
    """Build a new listening generator Agent with DeepSeek backend.

    `output_type` is implicitly `str` — we don't use pydantic-ai's tool-call
    structured-output mode because DeepSeek emits trailing characters after
    the closing `}` of tool-call args, which fails strict JSON parsing. We
    parse + validate manually below via `extract_json_object`.

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
        system_prompt=LISTENING_SYSTEM_PROMPT,
    )


# DeepSeek's default max_tokens (~4096) is too small for the structured
# listening response: a single PART produces 5 questions × {prompt, 3 options,
# answer, explanation} + a multi-turn audio_script + per-part metadata. 8000
# is just under DeepSeek-chat's 8192 ceiling.
#
# `response_format: json_object` forces DeepSeek to emit only a JSON object
# (no surrounding prose), the prerequisite for `extract_json_object` to find
# a balanced `{...}` cleanly.
#
# IMPORTANT: pydantic-ai applies model_settings only when passed to
# `agent.run(...)`, NOT to `Agent(...)` constructor — see speaking_examiner.py:60.
LISTENING_MODEL_SETTINGS = {
    "max_tokens": 8000,
    "response_format": {"type": "json_object"},
}


_agent_cache: Agent[None, str] | None = None


def get_listening_generator() -> Agent[None, str]:
    """Return the cached listening generator Agent, building on first call."""
    global _agent_cache
    if _agent_cache is None:
        _agent_cache = _build_agent()
    return _agent_cache


MAX_ATTEMPTS = 3


async def generate_listening_test(
    exam_type: Literal["KET", "PET"],
    scope: Literal["FULL", "PART"],
    *,
    part: int | None = None,
    seed_exam_points: list[str] | None = None,
) -> ListeningTestResponse:
    """Generate + validate a listening test, retrying up to MAX_ATTEMPTS times.

    Each attempt produces a raw string from DeepSeek, extracts the first
    balanced JSON object (strips markdown fences and trailing characters
    from DeepSeek's "tool-call response" quirk), validates it as
    `ListeningTestResponse`, and runs format validators. Failure to parse
    OR validate triggers retry; final failure raises ValueError.
    """
    seed_exam_points = seed_exam_points or []

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
    last_parse_error: Exception | None = None

    for _attempt in range(MAX_ATTEMPTS):
        agent = get_listening_generator()
        run = await agent.run(prompt, model_settings=LISTENING_MODEL_SETTINGS)
        raw = str(run.output)

        # Step 1: extract the JSON object (handles trailing chars / fences).
        try:
            cleaned = extract_json_object(raw)
        except ValueError as e:
            last_parse_error = e
            log.warning(
                "generate_listening_test attempt %d: could not extract JSON object: %s",
                _attempt + 1,
                e,
            )
            continue

        # Step 2: validate against the Pydantic schema.
        try:
            response = ListeningTestResponse.model_validate_json(cleaned)
        except Exception as e:  # pydantic.ValidationError, etc.
            last_parse_error = e
            log.warning(
                "generate_listening_test attempt %d: schema validation failed: %s",
                _attempt + 1,
                str(e)[:500],
            )
            continue

        # Step 3: run format validators (validate_listening_response).
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
        log.warning(
            "generate_listening_test attempt %d failed format checks: %s",
            _attempt + 1,
            [f"{e.code}: {e.message}" for e in errors],
        )

    if last_errors is None:
        # All attempts failed at parse/schema, never reached format validation.
        raise ValueError(
            f"Listening generation failed after {MAX_ATTEMPTS} attempts; "
            f"last parse/schema error: {last_parse_error}"
        )
    error_msgs = "; ".join(f"{e.code}: {e.message}" for e in last_errors)
    log.error(
        "generate_listening_test gave up after %d attempts; last response: %s",
        MAX_ATTEMPTS,
        last_response.model_dump_json()[:2000] if last_response else "None",
    )
    raise ValueError(
        f"Listening generation validation failed after {MAX_ATTEMPTS} attempts: {error_msgs}"
    )
