"""Validator tests for the student-analysis output."""

from __future__ import annotations

import pytest

from app.schemas.analysis import (
    RecentAttemptSummary,
    StudentAnalysisRequest,
    StudentAnalysisResponse,
    StudentStats,
    WritingAveragesSummary,
)
from app.validators.analysis import validate_student_analysis


def _sample_req() -> StudentAnalysisRequest:
    return StudentAnalysisRequest(
        student_name="ho Bao",
        class_name="2026 春季 KET",
        stats=StudentStats(
            total_graded=2, avg_score=13, best_score=25, worst_score=0
        ),
        recent_attempts=[
            RecentAttemptSummary(
                date="2026-04-23",
                exam_type="KET",
                kind="READING",
                part=5,
                mode="PRACTICE",
                score=25,
            ),
            RecentAttemptSummary(
                date="2026-04-23",
                exam_type="KET",
                kind="READING",
                part=5,
                mode="PRACTICE",
                score=0,
            ),
        ],
    )


def _resp(
    *,
    strengths: list[str] | None = None,
    weaknesses: list[str] | None = None,
    priority_actions: list[str] | None = None,
    narrative_zh: str = "正常段落。",
) -> StudentAnalysisResponse:
    return StudentAnalysisResponse(
        strengths=strengths or ["学生阅读主旨把握较好"],
        weaknesses=weaknesses or ["Writing Organisation 平均仅 2.3/5"],
        priority_actions=priority_actions or ["每天练习", "强化连接词"],
        narrative_zh=narrative_zh,
    )


def test_clean_output_passes() -> None:
    req = _sample_req()
    resp = _resp(
        strengths=["KET Reading Part 5 最高一次 25%，已理解题型基本要求"],
        narrative_zh="该生 KET Reading Part 5 平均 13%，最高一次 25%，最低 0%，整体偏低。",
    )
    assert validate_student_analysis(resp, req) == []


def test_detects_pct_written_as_points() -> None:
    req = _sample_req()
    resp = _resp(
        strengths=["在 KET Reading Part 5 的第一次练习中获得了 25 分（满分 25）。"],
    )
    errors = validate_student_analysis(resp, req)
    assert any(e.code == "PCT_AS_POINTS_25" for e in errors)


def test_detects_bad_full_marks_denominator() -> None:
    req = _sample_req()
    resp = _resp(
        narrative_zh="学生一次满分 25 分，另一次 0 分。",
    )
    errors = validate_student_analysis(resp, req)
    codes = {e.code for e in errors}
    assert "BAD_FULL_MARKS_DENOMINATOR" in codes


def test_allows_rubric_band_phrasing() -> None:
    req = _sample_req()
    resp = _resp(
        weaknesses=[
            "Writing Organisation 平均仅 2.3/5",
            "Content 3 分（满分 5 分），仍有提升空间",
        ],
    )
    errors = validate_student_analysis(resp, req)
    # '3 分（满分 5 分）' should be allowed, '满分 5' is allowed.
    assert errors == []


def test_detects_invented_teacher_name() -> None:
    req = _sample_req()
    resp = _resp(narrative_zh="王老师您好，ho Bao 同学的情况如下。")
    errors = validate_student_analysis(resp, req)
    codes = {e.code for e in errors}
    assert "INVENTED_TEACHER_NAME" in codes


def test_allows_generic_teacher_address() -> None:
    req = _sample_req()
    resp = _resp(narrative_zh="老师您好，ho Bao 同学整体情况偏弱，建议您重点关注 Part 5。")
    errors = validate_student_analysis(resp, req)
    assert errors == []


def test_score_0_is_ignored() -> None:
    """The score 0 alone shouldn't trigger false positives (0 分 is rare but
    a '0 分' phrase would still be caught; however '0 次' / '0 个' shouldn't)."""
    req = _sample_req()
    resp = _resp(
        strengths=["学生在 0 次 Writing 练习中暂无数据"],  # '0 次' = 0 times, not '0 分'
    )
    errors = validate_student_analysis(resp, req)
    assert errors == []


def test_score_5_not_flagged_as_pct() -> None:
    """Score 5 would collide with rubric band 5; we skip it (rare edge case;
    unlikely a percent score is exactly 5)."""
    req = StudentAnalysisRequest(
        student_name="x",
        class_name="y",
        stats=StudentStats(total_graded=1, avg_score=5, best_score=5, worst_score=5),
    )
    resp = _resp(weaknesses=["Writing Content 5 分（满分 5 分）表现突出"])
    errors = validate_student_analysis(resp, req)
    # '5 分（满分 5 分）' is legitimate rubric phrasing.
    assert errors == []


def test_rubric_slash_phrasing_allowed() -> None:
    req = _sample_req()
    resp = _resp(
        weaknesses=["Organisation 平均 2.3/5 分，偏低"],
    )
    errors = validate_student_analysis(resp, req)
    assert errors == []


@pytest.mark.parametrize("bad_denom", [25, 40, 100, 32])
def test_bad_full_marks_denom_catches_common_wrong_values(bad_denom: int) -> None:
    req = _sample_req()
    resp = _resp(narrative_zh=f"学生这次拿到满分 {bad_denom}。")
    errors = validate_student_analysis(resp, req)
    assert any(e.code == "BAD_FULL_MARKS_DENOMINATOR" for e in errors)
