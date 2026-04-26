"""Pydantic AI agent that generates KET/PET writing tasks via DeepSeek."""

from __future__ import annotations

import os

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.prompts.writing import build_grader_system_prompt, build_system_prompt
from app.schemas.writing import (
    WritingGradeRequest,
    WritingGradeResponse,
    WritingTestRequest,
    WritingTestResponse,
)


def _build_deepseek_provider() -> OpenAIProvider:
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError(
            "DEEPSEEK_API_KEY is not set; cannot call the writing generator/grader."
        )
    return OpenAIProvider(
        base_url="https://api.deepseek.com/v1",
        api_key=api_key,
    )


def _build_deepseek_model() -> OpenAIChatModel:
    return OpenAIChatModel(
        model_name="deepseek-chat", provider=_build_deepseek_provider()
    )


def _build_grader_model() -> OpenAIChatModel:
    """Model used by the writing grader.

    Plan originally picked deepseek-reasoner (R1) for its analytical
    strength, but R1 rejects the `tool_choice` parameter pydantic-ai uses
    to force structured output (verified 2026-04-23: returns 400
    'deepseek-reasoner does not support this tool_choice'). deepseek-chat
    (V3.2) supports structured output cleanly and is strong enough at
    rubric-based grading for KET/PET; switching here.
    """
    return OpenAIChatModel(
        model_name="deepseek-chat", provider=_build_deepseek_provider()
    )


async def generate_writing_test(req: WritingTestRequest) -> WritingTestResponse:
    """Generate a single writing task."""
    model = _build_deepseek_model()
    agent: Agent[None, WritingTestResponse] = Agent(
        model=model,
        output_type=WritingTestResponse,
        system_prompt=build_system_prompt(req.exam_type, req.part),
    )
    # IMPORTANT: pydantic-ai applies model_settings only at agent.run(...)
    # call time. max_tokens=8000 (under DeepSeek-chat's 8192 ceiling)
    # is needed for the structured WritingTestResponse.

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

    result = await agent.run(
        user_message, model_settings={"max_tokens": 8000}
    )
    return result.output


async def grade_writing_response(req: WritingGradeRequest) -> WritingGradeResponse:
    """Grade a student's writing submission."""
    model = _build_grader_model()
    agent: Agent[None, WritingGradeResponse] = Agent(
        model=model,
        output_type=WritingGradeResponse,
        system_prompt=build_grader_system_prompt(
            exam_type=req.exam_type,
            part=req.part,
            prompt_text=req.prompt,
            content_points=req.content_points,
            scene_descriptions=req.scene_descriptions,
            chosen_option=req.chosen_option,
        ),
    )
    # IMPORTANT: model_settings only applies at agent.run(...) — see below.
    user_message = (
        "Grade the student's response below using the 4 criteria in the system prompt. "
        "Return JSON matching the output schema.\n\n"
        "STUDENT RESPONSE:\n"
        f"{req.student_response}"
    )
    result = await agent.run(
        user_message, model_settings={"max_tokens": 8000}
    )
    return result.output
