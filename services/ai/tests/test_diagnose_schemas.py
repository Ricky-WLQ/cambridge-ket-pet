"""Schema contract tests for the Diagnose v2 schemas (T9).

Mirrors ``test_analysis_schemas.py``. We don't hit DeepSeek in unit tests —
this file verifies the request/response shapes accept realistic payloads and
reject the documented edge cases (8-category Literal closed set, MCQ vs
free-text wrong-answer shapes, max_length=40 cap on analysis input, etc.).
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.diagnose import (
    DiagnoseAnalysisRequest,
    DiagnoseGenerateRequest,
    DiagnoseSummaryRequest,
    FocusArea,
    KnowledgePointGroup,
    KnowledgePointQuestion,
    PerSectionScores,
    WrongAnswer,
)


# ─── KnowledgePointCategory (8 valid values, replaces translation_skill) ──

@pytest.mark.parametrize(
    "category",
    [
        "grammar",
        "collocation",
        "vocabulary",
        "sentence_pattern",
        "reading_skill",
        "listening_skill",
        "cambridge_strategy",
        "writing_skill",
    ],
)
def test_knowledge_point_group_accepts_each_valid_category(category: str) -> None:
    group = KnowledgePointGroup(
        knowledge_point="present perfect with since",
        category=category,  # type: ignore[arg-type]
        mini_lesson="Use have/has + past participle for unfinished past actions.",
        rule="since + 过去时间点 → has/have done",
        example_sentences=["I have lived here since 2020."],
        questions=[
            KnowledgePointQuestion(
                section="GRAMMAR",
                question_text="She _____ here since 2018.",
                user_answer="A. works",
                correct_answer="C. has worked",
                why_wrong="since marks unfinished past — present perfect required.",
                rule="since + past time → present perfect",
            )
        ],
        severity="moderate",
    )
    assert group.category == category


def test_knowledge_point_group_rejects_translation_skill_legacy() -> None:
    """``translation_skill`` is the pretco-app legacy value; we replaced it
    with ``cambridge_strategy`` since KET/PET have no translation paper."""
    with pytest.raises(ValidationError):
        KnowledgePointGroup(
            knowledge_point="x",
            category="translation_skill",  # type: ignore[arg-type]
            mini_lesson="...",
            rule="...",
            example_sentences=["..."],
            questions=[],
            severity="moderate",
        )


# ─── KnowledgePointGroup field-level requirements ────────────────────────


def test_knowledge_point_group_requires_severity() -> None:
    with pytest.raises(ValidationError):
        KnowledgePointGroup(  # type: ignore[call-arg]
            knowledge_point="x",
            category="grammar",
            mini_lesson="...",
            rule="...",
            example_sentences=["..."],
            questions=[],
            # severity missing
        )


def test_knowledge_point_group_requires_all_fields() -> None:
    """Smoke check: dropping any required field raises ValidationError."""
    with pytest.raises(ValidationError):
        KnowledgePointGroup(  # type: ignore[call-arg]
            category="grammar",
            mini_lesson="...",
            rule="...",
            example_sentences=["..."],
            questions=[],
            severity="moderate",
            # knowledge_point missing
        )


# ─── WrongAnswer: MCQ shape vs free-text shape ───────────────────────────


def test_wrong_answer_accepts_mcq_shape_with_options() -> None:
    wa = WrongAnswer(
        section="READING",
        question_text="The boy _____ to the park yesterday.",
        user_answer="A. go",
        correct_answer="B. went",
        options=["A. go", "B. went", "C. goes", "D. going"],
    )
    assert wa.options is not None
    assert len(wa.options) == 4


def test_wrong_answer_accepts_free_text_shape_without_options() -> None:
    wa = WrongAnswer(
        section="WRITING",
        question_text="Write an email to your friend describing your weekend.",
        user_answer="(student's email response)",
        correct_answer="(rubric — no single correct answer)",
        # options omitted → defaults to None
    )
    assert wa.options is None


# ─── DiagnoseGenerateRequest ─────────────────────────────────────────────


def test_diagnose_generate_request_validates_exam_type_literal() -> None:
    """exam_type is Literal["KET", "PET"] — anything else must reject."""
    with pytest.raises(ValidationError):
        DiagnoseGenerateRequest(
            exam_type="TOEFL",  # type: ignore[arg-type]
            week_start="2026-04-20",
        )


def test_diagnose_generate_request_accepts_empty_focus_areas() -> None:
    """Cold-start: empty focus_areas list (week 1, no prior data)."""
    req = DiagnoseGenerateRequest(
        exam_type="KET",
        week_start="2026-04-20",
        focus_areas=[],
    )
    assert req.focus_areas == []
    # default sections: 4 AI-generated kinds.
    assert set(req.sections) == {"READING", "LISTENING", "WRITING", "SPEAKING"}


# ─── DiagnoseAnalysisRequest: max_length=40 ────────────────────────────


def test_diagnose_analysis_request_caps_wrong_answers_at_40() -> None:
    """Schema enforces max_length=40 on wrong_answers (T9 contract)."""
    valid_wa = WrongAnswer(
        section="READING",
        question_text="q",
        user_answer="a",
        correct_answer="b",
    )

    # 40 entries → OK.
    req = DiagnoseAnalysisRequest(
        exam_type="KET",
        wrong_answers=[valid_wa] * 40,
    )
    assert len(req.wrong_answers) == 40

    # 41 entries → ValidationError.
    with pytest.raises(ValidationError):
        DiagnoseAnalysisRequest(
            exam_type="KET",
            wrong_answers=[valid_wa] * 41,
        )


# ─── DiagnoseSummaryRequest ──────────────────────────────────────────────


def test_diagnose_summary_request_accepts_realistic_input() -> None:
    req = DiagnoseSummaryRequest(
        exam_type="PET",
        week_start="2026-04-20",
        week_end="2026-04-26",
        per_section_scores=PerSectionScores(
            READING=82,
            LISTENING=75,
            WRITING=60,
            SPEAKING=70,
            VOCAB=80,
            GRAMMAR=65,
        ),
        overall_score=72,
        knowledge_points=[],
        weak_count=0,
    )
    assert req.exam_type == "PET"
    assert req.overall_score == pytest.approx(72)
    assert req.per_section_scores.READING == pytest.approx(82)


# ─── PerSectionScores ────────────────────────────────────────────────────


def test_per_section_scores_accepts_none_for_any_section() -> None:
    """All six section scores are optional (sections may not be attempted)."""
    s = PerSectionScores()
    assert s.READING is None
    assert s.LISTENING is None
    assert s.WRITING is None
    assert s.SPEAKING is None
    assert s.VOCAB is None
    assert s.GRAMMAR is None

    # Mix of present + missing.
    s2 = PerSectionScores(READING=80, GRAMMAR=50)
    assert s2.READING == pytest.approx(80)
    assert s2.LISTENING is None
    assert s2.GRAMMAR == pytest.approx(50)


# ─── FocusArea: wrong_count >= 1 ─────────────────────────────────────────


def test_focus_area_rejects_zero_wrong_count() -> None:
    with pytest.raises(ValidationError):
        FocusArea(exam_point_id="KET.RW.P5", wrong_count=0)


def test_focus_area_rejects_negative_wrong_count() -> None:
    with pytest.raises(ValidationError):
        FocusArea(exam_point_id="KET.RW.P5", wrong_count=-3)
