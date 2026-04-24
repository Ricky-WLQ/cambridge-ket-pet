"""speaking_scorer - post-session rubric scorer."""

from __future__ import annotations

import json
import os

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.prompts.speaking_scorer_system import SCORER_SYSTEM_PROMPT
from app.schemas.speaking import SpeakingScore


def _build_deepseek_model() -> OpenAIChatModel:
    """Construct the DeepSeek chat model. Mirrors Phase 1/2 agents."""
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY is not set; cannot build scorer model")
    return OpenAIChatModel(
        model_name="deepseek-chat",
        provider=OpenAIProvider(base_url="https://api.deepseek.com", api_key=api_key),
    )


# Indirection so tests can patch this symbol.
async def _run_scorer_agent(
    *, level: str, transcript: list[dict]
) -> SpeakingScore:
    agent = Agent(
        model=_build_deepseek_model(),
        output_type=SpeakingScore,
        system_prompt=SCORER_SYSTEM_PROMPT.format(level=level),
    )
    user_prompt = json.dumps(
        {"level": level, "transcript": transcript},
        ensure_ascii=False,
    )
    result = await agent.run(user_prompt)
    return result.output


async def score_speaking_attempt(
    *, level: str, transcript: list[dict]
) -> SpeakingScore:
    """Public entry point; wraps the Pydantic AI agent call."""
    return await _run_scorer_agent(level=level, transcript=transcript)
