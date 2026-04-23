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

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.prompts.listening_system import LISTENING_SYSTEM_PROMPT
from app.schemas.listening import ListeningTestResponse


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
