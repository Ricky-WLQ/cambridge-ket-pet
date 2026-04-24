"""speaking_generator — produces a per-attempt Speaking test script.

Mirrors the Phase 2 `listening_generator` / Phase 1 `reading` pattern: the
DeepSeek-backed `Agent` is constructed inside the async function so that
env vars (`DEEPSEEK_API_KEY`) are read at call time, not at module import.
This keeps module import side-effect-free, which lets tests patch
`run_pydantic_agent` without ever triggering a DeepSeek client build.
"""

from __future__ import annotations

import json
import os

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.prompts.speaking_generator_system import GENERATOR_SYSTEM_PROMPT
from app.schemas.speaking import SpeakingPrompts


def _build_deepseek_model() -> OpenAIChatModel:
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError(
            "DEEPSEEK_API_KEY is not set; cannot call the speaking generator."
        )
    provider = OpenAIProvider(
        base_url="https://api.deepseek.com/v1",
        api_key=api_key,
    )
    return OpenAIChatModel(model_name="deepseek-chat", provider=provider)


# Indirection so tests can patch this symbol.
async def run_pydantic_agent(
    level: str,
    photo_briefs: list[dict],
) -> SpeakingPrompts:
    agent: Agent[None, SpeakingPrompts] = Agent(
        model=_build_deepseek_model(),
        output_type=SpeakingPrompts,
        system_prompt=GENERATOR_SYSTEM_PROMPT.format(level=level),
    )
    user_prompt = json.dumps(
        {"level": level, "photo_briefs": photo_briefs},
        ensure_ascii=False,
    )
    result = await agent.run(user_prompt)
    return result.output


async def generate_speaking_prompts(
    *, level: str, photo_briefs: list[dict]
) -> SpeakingPrompts:
    """Public entry point; wraps the Pydantic AI agent call."""
    return await run_pydantic_agent(level, photo_briefs)
