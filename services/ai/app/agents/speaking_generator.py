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
from app.validators.speaking import extract_json_object


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
    """Call DeepSeek for SpeakingPrompts via plain JSON-mode output.

    We bypass pydantic-ai's tool-call output_type because DeepSeek's
    tool-call args occasionally include trailing characters after the
    closing `}` (observed live: one stray `}` after `"parts": [...]}`).
    Strict json validation rejects them. Instead we ask DeepSeek for a
    plain JSON-mode string, strip any markdown fences and trailing junk
    via brace-counting, then validate against SpeakingPrompts manually.
    Retries up to 3 attempts on parse/validation failure.
    """
    # Plain string output — no output_type → no tool-call validation.
    agent: Agent[None, str] = Agent(
        model=_build_deepseek_model(),
        system_prompt=GENERATOR_SYSTEM_PROMPT.format(level=level),
    )
    user_prompt = json.dumps(
        {"level": level, "photo_briefs": photo_briefs},
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
            return SpeakingPrompts.model_validate_json(cleaned)
        except (ValueError, Exception) as e:  # noqa: BLE001 — pydantic ValidationError is intentional
            last_error = e
            continue

    raise RuntimeError(
        f"speaking_generator failed after 3 attempts: {last_error}"
    )


async def generate_speaking_prompts(
    *, level: str, photo_briefs: list[dict]
) -> SpeakingPrompts:
    """Public entry point; wraps the Pydantic AI agent call."""
    return await run_pydantic_agent(level, photo_briefs)
