"""Pydantic AI agent for Phase 2 listening generation.

Mirrors the DeepSeek wiring pattern established by ``app.agents.reading``
and ``app.agents.writing`` (OpenAI-compatible base URL, explicit
``OpenAIChatModel`` + ``OpenAIProvider``) rather than the string-form
``model="deepseek:..."`` shorthand — the latter requires
``DEEPSEEK_API_KEY`` at construction time, which would break test
collection when the env var is unset.

Unlike the reading/writing agents (which rebuild their Agent per-request
to inject a dynamic, request-parameterized system prompt), the listening
agent makes a SINGLE generation call per full test using the flat
``LISTENING_SYSTEM_PROMPT``; a module-level constant Agent is therefore
the natural shape. Reading the API key lazily via ``os.environ.get``
(rather than ``os.environ[...]``) keeps import side-effect-free — auth
failures surface at request time as an upstream 401, not at import.
"""

from __future__ import annotations

import os

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.prompts.listening_system import LISTENING_SYSTEM_PROMPT
from app.schemas.listening import ListeningTestResponse


def _build_deepseek_model() -> OpenAIChatModel:
    """Build the DeepSeek chat model via OpenAI-compatible endpoint.

    API key is read lazily: ``None`` is acceptable at construction time
    (``OpenAIProvider`` tolerates it); the DeepSeek API will surface a
    401 at request time if the key is still missing when the agent is
    actually invoked.
    """
    provider = OpenAIProvider(
        base_url="https://api.deepseek.com/v1",
        api_key=os.environ.get("DEEPSEEK_API_KEY"),
    )
    return OpenAIChatModel(model_name="deepseek-chat", provider=provider)


listening_generator: Agent[None, ListeningTestResponse] = Agent(
    model=_build_deepseek_model(),
    output_type=ListeningTestResponse,
    system_prompt=LISTENING_SYSTEM_PROMPT,
    retries=1,
)
