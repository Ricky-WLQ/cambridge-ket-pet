"""Request/response schemas for the teacher-style student analysis agent."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class RecentAttemptSummary(BaseModel):
    date: str
    exam_type: Literal["KET", "PET"]
    kind: str
    part: int | None = None
    mode: Literal["PRACTICE", "MOCK"]
    score: int = Field(description="scaledScore 0-100")


class WritingAveragesSummary(BaseModel):
    content: float
    communicative: float
    organisation: float
    language: float
    count: int


class ErrorExamPointSummary(BaseModel):
    id: str
    label_zh: str
    description_zh: str | None = None
    count: int


class WritingSample(BaseModel):
    exam_type: Literal["KET", "PET"]
    part: int
    prompt: str
    response: str
    scores: dict[str, int] = Field(
        description="keys: content, communicative, organisation, language"
    )
    feedback_zh: str | None = None


class StudentStats(BaseModel):
    total_graded: int
    avg_score: int | None = None
    best_score: int | None = None
    worst_score: int | None = None


class StudentAnalysisRequest(BaseModel):
    student_name: str
    class_name: str
    stats: StudentStats
    recent_attempts: list[RecentAttemptSummary] = Field(default_factory=list)
    writing_averages: WritingAveragesSummary | None = None
    top_error_exam_points: list[ErrorExamPointSummary] = Field(
        default_factory=list
    )
    recent_writing_samples: list[WritingSample] = Field(default_factory=list)
    focus_exam_type: Literal["KET", "PET"] | None = None


class StudentAnalysisResponse(BaseModel):
    strengths: list[str] = Field(
        description=(
            "1-3 specific, data-grounded strengths in Simplified Chinese. "
            "Each item is one complete sentence, e.g. "
            "'Reading Part 3 的 MCQ 稳定拿分，主旨把握较好'."
        ),
    )
    weaknesses: list[str] = Field(
        description=(
            "1-3 specific, data-grounded weaknesses in Simplified Chinese. "
            "Each item cites the data, e.g. "
            "'Writing Organisation 平均仅 2.3/5，段落连接词使用不足'."
        ),
    )
    priority_actions: list[str] = Field(
        description=(
            "2-4 concrete, actionable next-step practice recommendations in "
            "Simplified Chinese. Each names a specific drill or focus area."
        ),
    )
    narrative_zh: str = Field(
        description=(
            "150-260 字的综合评语段落 in Simplified Chinese, addressed to the "
            "teacher, integrating the strengths/weaknesses/actions above."
        ),
    )
