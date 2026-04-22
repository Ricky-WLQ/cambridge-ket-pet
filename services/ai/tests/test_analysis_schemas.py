"""Schema contract tests for the student-analysis agent.

We don't hit DeepSeek in unit tests — that's a network call. Here we verify:
  * Request schema accepts a realistic payload.
  * Response schema enforces the promised shape.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.analysis import (
    ErrorExamPointSummary,
    RecentAttemptSummary,
    StudentAnalysisRequest,
    StudentAnalysisResponse,
    StudentStats,
    WritingAveragesSummary,
    WritingSample,
)


def _sample_request(**overrides) -> StudentAnalysisRequest:
    base = StudentAnalysisRequest(
        student_name="Alice Liu",
        class_name="2026 Spring KET",
        stats=StudentStats(
            total_graded=4, avg_score=62, best_score=80, worst_score=40
        ),
        recent_attempts=[
            RecentAttemptSummary(
                date="2026-04-20T09:00:00",
                exam_type="KET",
                kind="READING",
                part=3,
                mode="PRACTICE",
                score=60,
            ),
            RecentAttemptSummary(
                date="2026-04-21T09:00:00",
                exam_type="KET",
                kind="READING",
                part=3,
                mode="PRACTICE",
                score=80,
            ),
        ],
        writing_averages=WritingAveragesSummary(
            content=3.5,
            communicative=3.0,
            organisation=2.3,
            language=3.0,
            count=2,
        ),
        top_error_exam_points=[
            ErrorExamPointSummary(
                id="KET.RW.P5",
                label_zh="MCQ cloze",
                description_zh="选择填空",
                count=7,
            ),
        ],
        recent_writing_samples=[
            WritingSample(
                exam_type="KET",
                part=6,
                prompt="Write an email to your friend...",
                response="Hi Sam, I will come...",
                scores={
                    "content": 3,
                    "communicative": 3,
                    "organisation": 2,
                    "language": 3,
                },
                feedback_zh="整体结构不错，但段落衔接欠佳。",
            )
        ],
    )
    return base.model_copy(update=overrides)


def test_request_accepts_realistic_payload() -> None:
    req = _sample_request()
    assert req.student_name == "Alice Liu"
    assert req.stats.total_graded == 4
    assert len(req.recent_attempts) == 2
    assert req.writing_averages is not None
    assert req.writing_averages.organisation == pytest.approx(2.3)


def test_request_minimal_payload_works() -> None:
    req = StudentAnalysisRequest(
        student_name="新生",
        class_name="PET 冲刺班",
        stats=StudentStats(total_graded=0),
    )
    assert req.recent_attempts == []
    assert req.writing_averages is None
    assert req.top_error_exam_points == []


def test_request_rejects_invalid_exam_type() -> None:
    with pytest.raises(ValidationError):
        StudentAnalysisRequest(
            student_name="x",
            class_name="y",
            stats=StudentStats(total_graded=1),
            recent_attempts=[
                {
                    "date": "2026-01-01",
                    "exam_type": "TOEFL",  # not allowed
                    "kind": "READING",
                    "mode": "PRACTICE",
                    "score": 50,
                }
            ],  # type: ignore[list-item]
        )


def test_response_shape_is_enforced() -> None:
    resp = StudentAnalysisResponse(
        strengths=["Reading 主旨把握较好"],
        weaknesses=["Writing Organisation 平均仅 2.3/5"],
        priority_actions=[
            "每天 1 篇 KET Part 6 限时练习",
            "强化段落连接词使用",
        ],
        narrative_zh="该学生在阅读方面表现稳定，但写作结构有待加强。建议以 Organisation 为重点，结合段落连接词的专项练习。",
    )
    assert len(resp.strengths) == 1
    assert len(resp.priority_actions) == 2
    assert "写作" in resp.narrative_zh
