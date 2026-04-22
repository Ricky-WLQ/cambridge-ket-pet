"""Pydantic AI agent that generates KET/PET writing tasks via DeepSeek."""

from __future__ import annotations

import os

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.prompts.writing import build_system_prompt
from app.schemas.writing import WritingTestRequest, WritingTestResponse


def _build_deepseek_model() -> OpenAIChatModel:
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError(
            "DEEPSEEK_API_KEY is not set; cannot call the writing generator."
        )
    provider = OpenAIProvider(
        base_url="https://api.deepseek.com/v1",
        api_key=api_key,
    )
    return OpenAIChatModel(model_name="deepseek-chat", provider=provider)


async def generate_writing_test(req: WritingTestRequest) -> WritingTestResponse:
    """Generate a single writing task."""
    model = _build_deepseek_model()
    agent: Agent[None, WritingTestResponse] = Agent(
        model=model,
        output_type=WritingTestResponse,
        system_prompt=build_system_prompt(req.exam_type, req.part),
    )

    pinning: list[str] = []
    if req.seed_exam_points:
        pinning.append(
            f"Anchor the task specifically to these exam-point IDs: {req.seed_exam_points}."
        )
    if req.seed_difficulty_points:
        pinning.append(
            f"Design the task so it gives practice on these difficulty points: {req.seed_difficulty_points}."
        )
    pinning_block = ("\n" + "\n".join(pinning)) if pinning else ""

    user_message = (
        f"Generate a {req.exam_type} Writing Part {req.part} practice task.{pinning_block}"
    )

    result = await agent.run(user_message)
    return result.output
