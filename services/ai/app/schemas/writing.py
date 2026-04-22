"""Pydantic schemas for the writing-test generator."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ExamType = Literal["KET", "PET"]
WritingTaskType = Literal["EMAIL", "PICTURE_STORY", "LETTER_OR_STORY"]


class WritingTestRequest(BaseModel):
    exam_type: ExamType
    part: int = Field(
        ...,
        ge=1,
        le=7,
        description="KET Writing parts: 6 or 7. PET Writing parts: 1 or 2.",
    )
    seed_exam_points: list[str] = Field(default_factory=list)
    seed_difficulty_points: list[str] = Field(default_factory=list)


class RubricScores(BaseModel):
    content: int = Field(..., ge=0, le=5, description="Content (0-5)")
    communicative: int = Field(
        ..., ge=0, le=5, description="Communicative Achievement (0-5)"
    )
    organisation: int = Field(..., ge=0, le=5, description="Organisation (0-5)")
    language: int = Field(..., ge=0, le=5, description="Language (0-5)")


class WritingGradeRequest(BaseModel):
    exam_type: ExamType
    part: int = Field(..., ge=1, le=7)
    prompt: str = Field(..., description="The original task prompt")
    content_points: list[str] = Field(default_factory=list)
    scene_descriptions: list[str] = Field(default_factory=list)
    chosen_option: Literal["A", "B"] | None = Field(
        default=None, description="For PET Part 2 LETTER_OR_STORY — which choice"
    )
    student_response: str = Field(..., description="What the student wrote")


class WritingGradeResponse(BaseModel):
    scores: RubricScores
    total_band: int = Field(..., ge=0, le=20, description="Sum of 4 criteria")
    feedback_zh: str = Field(
        ...,
        description="1-3 sentence honest, encouraging Chinese feedback",
    )
    specific_suggestions_zh: list[str] = Field(
        ...,
        description="2-4 concrete Chinese improvement suggestions",
    )


class WritingTestResponse(BaseModel):
    task_type: WritingTaskType = Field(
        ...,
        description=(
            "EMAIL = guided email with content points (KET P6, PET P1). "
            "PICTURE_STORY = write a story based on 3 text scene descriptions "
            "(KET P7; images in Phase 2+). "
            "LETTER_OR_STORY = student chooses one option (PET P2)."
        ),
    )
    prompt: str = Field(..., description="The main task description shown to the student")
    content_points: list[str] = Field(
        default_factory=list,
        description="Required content bullet points (3 for KET P6 / PET P1)",
    )
    scene_descriptions: list[str] = Field(
        default_factory=list,
        description="3 text scene descriptions for KET Part 7 picture story",
    )
    min_words: int = Field(..., ge=0, description="Minimum words the student must write")
    topic_context: str | None = Field(
        default=None,
        description="Optional setup context (e.g. email being replied to)",
    )
    exam_point_id: str = Field(..., description="Reference to ExamPoint.id")
