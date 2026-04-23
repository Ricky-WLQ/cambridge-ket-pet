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

import os
from typing import Literal

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.prompts.listening_system import LISTENING_SYSTEM_PROMPT
from app.schemas.listening import ListeningTestResponse
from app.validators.listening import validate_listening_response
from app.validators.reading import ValidationError


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
        retries=1,
    )


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


async def generate_listening_test(
    exam_type: Literal["KET", "PET"],
    scope: Literal["FULL", "PART"],
    *,
    part: int | None = None,
    seed_exam_points: list[str] | None = None,
) -> ListeningTestResponse:
    """Generate + validate a listening test, retrying up to MAX_ATTEMPTS on validation failure.

    Raises ValueError if all MAX_ATTEMPTS attempts fail validation.
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
    for _attempt in range(MAX_ATTEMPTS):
        agent = get_listening_generator()
        run = await agent.run(prompt)
        response: ListeningTestResponse = run.output
        errors = validate_listening_response(response)
        if not errors:
            return response
        last_errors = errors

    assert last_errors is not None
    error_msgs = "; ".join(f"{e.code}: {e.message}" for e in last_errors)
    raise ValueError(
        f"Listening generation validation failed after {MAX_ATTEMPTS} attempts: {error_msgs}"
    )
