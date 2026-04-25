"""speaking_scorer - post-session rubric scorer."""

from __future__ import annotations

import json
import os

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.prompts.speaking_scorer_system import SCORER_SYSTEM_PROMPT
from app.schemas.speaking import SpeakingScore
from app.validators.speaking import extract_json_object


def _build_deepseek_model() -> OpenAIChatModel:
    """Construct the DeepSeek chat model. Mirrors Phase 1/2 agents."""
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY is not set; cannot build scorer model")
    return OpenAIChatModel(
        model_name="deepseek-chat",
        provider=OpenAIProvider(base_url="https://api.deepseek.com/v1", api_key=api_key),
    )


# Indirection so tests can patch this symbol.
async def _run_scorer_agent(
    *, level: str, transcript: list[dict]
) -> SpeakingScore:
    """Same plain-JSON-mode + manual-extraction pattern as speaking_generator —
    DeepSeek's tool-call output for nested-object schemas occasionally emits a
    trailing `}` that strict tool-call validation rejects.
    """
    agent: Agent[None, str] = Agent(
        model=_build_deepseek_model(),
        system_prompt=SCORER_SYSTEM_PROMPT.format(level=level),
    )
    user_prompt = json.dumps(
        {"level": level, "transcript": transcript},
        ensure_ascii=False,
    )

    last_error: Exception | None = None
    for _attempt in range(3):
        try:
            result = await agent.run(
                user_prompt,
                model_settings={"response_format": {"type": "json_object"}},
            )
            raw = str(result.output)
            cleaned = extract_json_object(raw)
            return SpeakingScore.model_validate_json(cleaned)
        except (ValueError, Exception) as e:  # noqa: BLE001
            last_error = e
            continue

    raise RuntimeError(
        f"speaking_scorer failed after 3 attempts: {last_error}"
    )


async def score_speaking_attempt(
    *, level: str, transcript: list[dict]
) -> SpeakingScore:
    """Public entry point; wraps the Pydantic AI agent call."""
    return await _run_scorer_agent(level=level, transcript=transcript)
