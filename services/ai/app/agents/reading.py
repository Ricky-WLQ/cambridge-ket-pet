"""Pydantic AI agent that generates KET/PET reading tests via DeepSeek."""

from __future__ import annotations

import os

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.prompts.reading import build_system_prompt
from app.schemas.reading import ReadingTestRequest, ReadingTestResponse


def _build_deepseek_model() -> OpenAIChatModel:
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError(
            "DEEPSEEK_API_KEY is not set; cannot call the reading generator."
        )
    provider = OpenAIProvider(
        base_url="https://api.deepseek.com/v1",
        api_key=api_key,
    )
    return OpenAIChatModel(model_name="deepseek-chat", provider=provider)


async def generate_reading_test(req: ReadingTestRequest) -> ReadingTestResponse:
    """Generate a single reading test. May raise ValidationError (pydantic)
    or any upstream HTTP error; callers should wrap with a retry loop that
    also runs format validators."""
    model = _build_deepseek_model()
    agent: Agent[None, ReadingTestResponse] = Agent(
        model=model,
        output_type=ReadingTestResponse,
        system_prompt=build_system_prompt(req.exam_type, req.part),
    )

    pinning_lines: list[str] = []
    if req.seed_exam_points:
        pinning_lines.append(
            f"Anchor items specifically to these exam-point IDs: {req.seed_exam_points}."
        )
    if req.seed_difficulty_points:
        pinning_lines.append(
            f"Emphasize these difficulty points (难点): {req.seed_difficulty_points}."
        )
    pinning_block = ("\n" + "\n".join(pinning_lines)) if pinning_lines else ""

    user_message = (
        f"Generate a {req.exam_type} Reading Part {req.part} practice test. "
        f"Mode: {req.mode}.{pinning_block}"
    )

    result = await agent.run(user_message)
    return result.output
