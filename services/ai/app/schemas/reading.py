"""Pydantic request/response schemas for the reading-test generator."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ExamType = Literal["KET", "PET"]
Mode = Literal["PRACTICE", "MOCK"]
QuestionType = Literal["MCQ", "OPEN_CLOZE", "MATCHING", "MCQ_CLOZE", "GAPPED_TEXT"]


class ReadingTestRequest(BaseModel):
    exam_type: ExamType
    part: int = Field(..., ge=1, le=7, description="Part number (KET RW: 1-7, PET R: 1-6)")
    mode: Mode = "PRACTICE"
    seed_exam_points: list[str] = Field(default_factory=list)
    seed_difficulty_points: list[str] = Field(default_factory=list)


class ReadingQuestion(BaseModel):
    id: str = Field(..., description="Stable per-test question id, e.g. 'q1'")
    type: QuestionType
    prompt: str = Field(..., description="The question stem shown to the student")
    options: list[str] | None = Field(
        default=None,
        description="Answer options for MCQ-family types; null for matching/cloze",
    )
    answer: str = Field(
        ...,
        description="The correct answer. For MCQ, letter like 'A'; for cloze, the word.",
    )
    explanation_zh: str = Field(..., description="Brief Chinese explanation of the answer")
    exam_point_id: str = Field(..., description="Reference to ExamPoint.id")
    difficulty_point_id: str | None = Field(
        default=None, description="Optional reference to DifficultyPoint.id"
    )


class ReadingTestResponse(BaseModel):
    passage: str | None = Field(
        default=None,
        description=(
            "The reading passage the questions are based on. "
            "May be null for Part 1 (discrete signs/notices items)."
        ),
    )
    questions: list[ReadingQuestion]
    time_limit_sec: int = Field(
        ...,
        ge=0,
        description="Recommended seconds for this Part (0 means untimed practice).",
    )
