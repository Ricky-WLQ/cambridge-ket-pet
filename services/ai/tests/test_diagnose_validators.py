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
    DiagnoseSummaryResponse,
    KnowledgePointGroup,
    KnowledgePointQuestion,
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
