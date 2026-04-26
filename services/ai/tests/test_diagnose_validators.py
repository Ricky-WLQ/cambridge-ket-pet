"""Validator tests for the Diagnose v2 outputs (T9).

Mirror of ``test_analysis_validators.py``. We don't hit DeepSeek — we feed
hand-crafted ``DiagnoseAnalysisResponse`` and ``DiagnoseSummaryResponse``
objects into the validators and check the returned error list.

Key cases:
  - 8-category whitelist (rejects unknown / legacy ``translation_skill``).
  - Mandatory-field emptiness (knowledge_point, mini_lesson, why_wrong).
  - example_sentences must have >=1 entry.
  - section enum on each question.
  - 4-digit year token in narrative_zh (with the regex-fix verification:
    Chinese context like "本周2026年..." must match because Python str-mode
    ``\\b`` treats CJK as word chars; we use digit-boundary lookarounds).
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.diagnose import (
    DiagnoseAnalysisResponse,
    DiagnoseSummaryRequest,
    DiagnoseSummaryResponse,
    KnowledgePointGroup,
    KnowledgePointQuestion,
    PerSectionScores,
)
from app.validators.diagnose import (
    validate_diagnose_analysis,
    validate_diagnose_summary,
)


# ─── Helpers ─────────────────────────────────────────────────────────────


def _q(
    *,
    section: str = "GRAMMAR",
    why_wrong: str = "since marks unfinished past — present perfect required.",
) -> KnowledgePointQuestion:
    return KnowledgePointQuestion(
        section=section,  # type: ignore[arg-type]
        question_text="She _____ here since 2018.",
        user_answer="A. works",
        correct_answer="C. has worked",
        why_wrong=why_wrong,
        rule="since + past time → present perfect",
    )


def _kp(
    *,
    knowledge_point: str = "present perfect with since",
    category: str = "grammar",
    mini_lesson: str = "Use have/has + past participle for unfinished past actions.",
    rule: str = "since + 过去时间点 → has/have done",
    example_sentences: list[str] | None = None,
    questions: list[KnowledgePointQuestion] | None = None,
    severity: str = "moderate",
) -> KnowledgePointGroup:
    # NOTE: use ``is None`` (not ``or``) — caller may pass empty list
    # intentionally to test the "must have >=1" branch.
    if example_sentences is None:
        example_sentences = ["I have lived here since 2020."]
    if questions is None:
        questions = [_q()]
    return KnowledgePointGroup(
        knowledge_point=knowledge_point,
        category=category,  # type: ignore[arg-type]
        mini_lesson=mini_lesson,
        rule=rule,
        example_sentences=example_sentences,
        questions=questions,
        severity=severity,  # type: ignore[arg-type]
    )


def _summary(
    *,
    strengths: list[str] | None = None,
    weaknesses: list[str] | None = None,
    priority_actions: list[str] | None = None,
    narrative_zh: str = "本周（2026-04-20 至 2026-04-26）你的整体表现稳定，达成 72%。",
) -> DiagnoseSummaryResponse:
    return DiagnoseSummaryResponse(
        strengths=strengths if strengths is not None else ["阅读主旨把握较好"],
        weaknesses=weaknesses if weaknesses is not None else ["写作结构松散"],
        priority_actions=priority_actions
        if priority_actions is not None
        else ["每天 1 篇限时写作", "强化连接词使用"],
        narrative_zh=narrative_zh,
    )


# ─── validate_diagnose_analysis ──────────────────────────────────────────


def test_validate_analysis_accepts_valid_8_category_response() -> None:
    """One group per each of the 8 valid categories — should pass clean."""
    categories = [
        "grammar",
        "collocation",
        "vocabulary",
        "sentence_pattern",
        "reading_skill",
        "listening_skill",
        "cambridge_strategy",
        "writing_skill",
    ]
    resp = DiagnoseAnalysisResponse(
        knowledge_points=[_kp(category=c) for c in categories]
    )
    assert validate_diagnose_analysis(resp) == []


def test_validate_analysis_rejects_unknown_category() -> None:
    """Unknown category — must blow up before reaching the validator
    (pydantic's Literal enforcement). This documents that the first line
    of defense is the schema, not the validator."""
    with pytest.raises(ValidationError):
        DiagnoseAnalysisResponse(
            knowledge_points=[_kp(category="some_made_up_category")]
        )


def test_validate_analysis_rejects_empty_knowledge_point() -> None:
    resp = DiagnoseAnalysisResponse(
        knowledge_points=[_kp(knowledge_point="   ")]  # whitespace-only
    )
    errors = validate_diagnose_analysis(resp)
    assert any("knowledge_point" in e and "empty" in e for e in errors)


def test_validate_analysis_rejects_empty_mini_lesson() -> None:
    resp = DiagnoseAnalysisResponse(
        knowledge_points=[_kp(mini_lesson="")]
    )
    errors = validate_diagnose_analysis(resp)
    assert any("mini_lesson" in e and "empty" in e for e in errors)


def test_validate_analysis_rejects_zero_example_sentences() -> None:
    resp = DiagnoseAnalysisResponse(
        knowledge_points=[_kp(example_sentences=[])]
    )
    errors = validate_diagnose_analysis(resp)
    assert any("example_sentences" in e and ">=1" in e for e in errors)


def test_validate_analysis_rejects_empty_why_wrong_on_question() -> None:
    bad_q = _q(why_wrong="   ")  # whitespace-only
    resp = DiagnoseAnalysisResponse(
        knowledge_points=[_kp(questions=[bad_q])]
    )
    errors = validate_diagnose_analysis(resp)
    assert any("why_wrong" in e and "empty" in e for e in errors)


def test_validate_analysis_rejects_invalid_section_enum() -> None:
    """Section must be one of the 6 DiagnoseSectionKind values; an unknown
    section is rejected by pydantic at construction time."""
    with pytest.raises(ValidationError):
        _q(section="MATHS")  # not a valid section


# ─── validate_diagnose_summary ───────────────────────────────────────────


def test_validate_summary_accepts_valid_with_year_token() -> None:
    resp = _summary(
        narrative_zh="本周（2026-04-20 至 2026-04-26）你的整体表现稳定，达成 72%。"
    )
    assert validate_diagnose_summary(resp) == []


def test_validate_summary_rejects_empty_narrative_zh() -> None:
    resp = _summary(narrative_zh="   ")  # whitespace-only
    errors = validate_diagnose_summary(resp)
    assert any("narrative_zh is empty" in e for e in errors)


def test_validate_summary_rejects_narrative_without_year_token() -> None:
    """No 4-digit year token like 20XX → must flag missing-year-token."""
    resp = _summary(
        narrative_zh="本周表现稳定，整体达成合格线，请继续保持。"
    )
    errors = validate_diagnose_summary(resp)
    assert any("year token" in e for e in errors)


def test_validate_summary_accepts_chinese_context_year_token() -> None:
    """Regex-fix verification: ``\\b20\\d{2}\\b`` would FAIL here because
    Python str-mode ``\\b`` treats CJK characters as word chars, so the
    pattern would NOT match "本周2026年..." (the trailing 年 suppresses
    the boundary).

    The current implementation uses digit-boundary lookarounds
    ``(?<!\\d)20\\d{2}(?!\\d)`` which DO match in CJK context. This test
    locks in that behavior — if someone reverts to ``\\b``, this fails.
    """
    # Tight CJK context — no spaces around the year. Old buggy regex
    # would not match this.
    resp = _summary(narrative_zh="本周2026年4月你的整体表现稳定，达成 72%。")
    errors = validate_diagnose_summary(resp)
    assert errors == [], f"expected no errors, got: {errors}"


def test_validate_summary_rejects_empty_strengths() -> None:
    resp = _summary(strengths=[])
    errors = validate_diagnose_summary(resp)
    assert any("strengths" in e for e in errors)


def test_validate_summary_rejects_empty_priority_actions() -> None:
    resp = _summary(priority_actions=[])
    errors = validate_diagnose_summary(resp)
    assert any("priority_actions" in e for e in errors)


# ─── validate_diagnose_summary — score-misreading checks ─────────────────
#
# These tests mirror ``test_analysis_validators.py``'s percent/full-marks
# checks. The same LLM failure modes apply to diagnose summaries because
# ``narrative_zh`` references ``per_section_scores`` + ``overall_score``.


def _summary_req(
    *,
    listening: float | None = 25.0,
    reading: float | None = 60.0,
    overall: float = 45.0,
) -> DiagnoseSummaryRequest:
    """Build a minimal DiagnoseSummaryRequest with given percentage scores."""
    return DiagnoseSummaryRequest(
        exam_type="KET",
        week_start="2026-04-20",
        week_end="2026-04-26",
        per_section_scores=PerSectionScores(
            READING=reading,
            LISTENING=listening,
            WRITING=None,
            SPEAKING=None,
            VOCAB=None,
            GRAMMAR=None,
        ),
        overall_score=overall,
        knowledge_points=[],
        weak_count=0,
    )


def test_validate_summary_detects_pct_written_as_points() -> None:
    """'听力得了 25 分' when the actual score was 25% must flag PCT_AS_POINTS."""
    req = _summary_req(listening=25.0)
    resp = _summary(
        narrative_zh=(
            "本周（2026-04-20 至 2026-04-26）你的听力得了 25 分，"
            "需要重点提升。"
        ),
    )
    errors = validate_diagnose_summary(resp, req)
    assert any("PCT_AS_POINTS_25" in e for e in errors), (
        f"expected PCT_AS_POINTS_25, got: {errors}"
    )


def test_validate_summary_detects_bad_full_marks_denominator() -> None:
    """'满分 100' (or 25, 40, 50 etc.) is a hallucination — only 满分 5 is valid."""
    req = _summary_req()
    resp = _summary(
        narrative_zh=(
            "本周（2026-04-20 至 2026-04-26）你的整体得分 45 分（满分 100），"
            "仍需努力。"
        ),
    )
    errors = validate_diagnose_summary(resp, req)
    assert any("BAD_FULL_MARKS_DENOMINATOR" in e for e in errors), (
        f"expected BAD_FULL_MARKS_DENOMINATOR, got: {errors}"
    )


def test_validate_summary_accepts_correct_percentage_phrasing() -> None:
    """'听力得分 25%' (using the % sign) must NOT flag — it's the correct form."""
    req = _summary_req(listening=25.0, reading=60.0, overall=45.0)
    resp = _summary(
        narrative_zh=(
            "本周（2026-04-20 至 2026-04-26）你的听力得分 25%，"
            "阅读 60%，整体 45%，需要继续加油。"
        ),
    )
    errors = validate_diagnose_summary(resp, req)
    assert errors == [], f"expected no errors, got: {errors}"


def test_validate_summary_allows_rubric_band_phrasing() -> None:
    """'X 分（满分 5 分）' (rubric band score) must remain legal."""
    req = _summary_req()
    resp = _summary(
        weaknesses=[
            "Writing Content 3 分（满分 5 分），段落连接词不足",
        ],
        narrative_zh=(
            "本周（2026-04-20 至 2026-04-26）写作仅得 3/5 分，"
            "建议加强。"
        ),
    )
    errors = validate_diagnose_summary(resp, req)
    assert errors == [], f"expected no errors, got: {errors}"


def test_validate_summary_skips_score_checks_without_request() -> None:
    """When called without a request, score-misreading checks must NOT run.

    This documents the test-only / structural-check pathway: passing only
    the response argument runs only the year-token + emptiness checks.
    """
    resp = _summary(
        narrative_zh=(
            "本周（2026-04-20 至 2026-04-26）你的听力得了 25 分（满分 100），"
            "需要重点提升。"  # Would flag if req were provided.
        ),
    )
    errors = validate_diagnose_summary(resp)
    # No PCT_AS_POINTS / BAD_FULL_MARKS errors when req is omitted.
    assert not any("PCT_AS_POINTS" in e for e in errors)
    assert not any("BAD_FULL_MARKS" in e for e in errors)
