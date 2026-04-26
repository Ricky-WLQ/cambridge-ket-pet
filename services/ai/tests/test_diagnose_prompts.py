"""Prompt-builder tests for the Diagnose v2 agents (T10).

We don't hit DeepSeek — we render the prompts and assert on the produced
strings. Coverage:
  - System prompts are Cambridge-framed (KET = A2 Key, PET = B1 Preliminary;
    NOT PRETCO).
  - Analysis user prompt lists all 8 categories and embeds wrong-answer fields.
  - Summary system prompt contains the year-token rule.
  - Summary user prompt uses the labeled-units block format.
  - Per-section score lines use the "<n> 分 (满分 100) — <level>" format.
  - Knowledge-point lines tag severity.
  - F-string injection safety: WrongAnswer with adversarial text
    ({x}, {{...}}, backslashes) renders without crashing.
  - cambridge_strategy is present; translation_skill is NOT (or only as a
    "do-not-use" reminder in the analysis user prompt).
"""

from __future__ import annotations

from app.schemas.diagnose import (
    DiagnoseSummaryRequest,
    KnowledgePointGroup,
    KnowledgePointQuestion,
    PerSectionScores,
    WrongAnswer,
)
from app.prompts.diagnose_analysis import (
    build_diagnose_analysis_system_prompt,
    build_diagnose_analysis_user_prompt,
)
from app.prompts.diagnose_summary import (
    build_diagnose_summary_system_prompt,
    build_diagnose_summary_user_prompt,
)


# ─── Analysis system prompt ──────────────────────────────────────────────


def test_analysis_system_prompt_ket_is_cambridge_framed() -> None:
    sp = build_diagnose_analysis_system_prompt("KET")
    assert "剑桥英语KET" in sp
    assert "A2 Key" in sp
    assert "PRETCO" not in sp
    # Must NOT leak the unfilled placeholder.
    assert "{exam_type}" not in sp


def test_analysis_system_prompt_pet_is_cambridge_framed() -> None:
    sp = build_diagnose_analysis_system_prompt("PET")
    assert "剑桥英语PET" in sp
    assert "B1 Preliminary" in sp
    assert "PRETCO" not in sp
    assert "{exam_type}" not in sp


# ─── Analysis user prompt ────────────────────────────────────────────────


def _wa_mcq() -> WrongAnswer:
    return WrongAnswer(
        section="READING",
        question_text="The boy _____ to the park yesterday.",
        user_answer="A. go",
        correct_answer="B. went",
        options=["A. go", "B. went", "C. goes", "D. going"],
    )


def _wa_free_text() -> WrongAnswer:
    return WrongAnswer(
        section="WRITING",
        question_text="Write an email to your friend about your weekend.",
        user_answer="(student response text)",
        correct_answer="(rubric — no single correct answer)",
    )


def test_analysis_user_prompt_renders_all_8_categories() -> None:
    up = build_diagnose_analysis_user_prompt("KET", [_wa_mcq()])
    # All 8 valid category enum values must appear in the bullet list.
    for cat in [
        "grammar",
        "collocation",
        "vocabulary",
        "sentence_pattern",
        "reading_skill",
        "listening_skill",
        "cambridge_strategy",
        "writing_skill",
    ]:
        assert f"`{cat}`" in up, f"missing category bullet for {cat}"


def test_analysis_user_prompt_embeds_wrong_answer_fields() -> None:
    wa = _wa_mcq()
    up = build_diagnose_analysis_user_prompt("KET", [wa])
    assert wa.question_text in up
    assert wa.user_answer in up
    assert wa.correct_answer in up
    # Section appears in the per-question header.
    assert "(READING)" in up
    # Options inline rendering with the " | " separator.
    assert "A. go | B. went | C. goes | D. going" in up


def test_analysis_user_prompt_omits_options_for_free_text() -> None:
    wa = _wa_free_text()
    up = build_diagnose_analysis_user_prompt("KET", [wa])
    assert wa.question_text in up
    # No "选项:" line for free-text wrong answers.
    # Match exact line prefix to avoid false positives from the category
    # bullet list ("如A/B/C/D" appears in '要求' section).
    assert "选项: " not in up


def test_analysis_user_prompt_translation_skill_only_in_avoid_reminder() -> None:
    """``cambridge_strategy`` MUST be in the prompt; ``translation_skill``
    may appear only inside the "use cambridge_strategy NOT translation_skill"
    reminder. Verify cambridge_strategy is mentioned more than once
    (categories list + reminder), and that translation_skill, if it appears,
    is co-located with the avoid reminder."""
    up = build_diagnose_analysis_user_prompt("KET", [_wa_mcq()])
    assert "cambridge_strategy" in up
    if "translation_skill" in up:
        # Must be in the "use ... not translation_skill" warning context.
        assert "cambridge_strategy" in up
        # Reminder text mentions both side-by-side.
        idx_translation = up.index("translation_skill")
        # cambridge_strategy must appear within 200 chars of the warning,
        # confirming it's the avoid reminder rather than a stray legacy ref.
        window = up[max(0, idx_translation - 200) : idx_translation + 200]
        assert "cambridge_strategy" in window


# ─── Summary system prompt ───────────────────────────────────────────────


def test_summary_system_prompt_ket_is_cambridge_framed_with_year_rule() -> None:
    sp = build_diagnose_summary_system_prompt("KET")
    assert "剑桥英语KET" in sp
    assert "周测分析专家" in sp
    # Year-token rule is the load-bearing CRITICAL: narrative must name week.
    assert "4 位年份" in sp or "yyyy-MM-dd" in sp
    assert "{exam_type}" not in sp


def test_summary_system_prompt_pet_renders() -> None:
    sp = build_diagnose_summary_system_prompt("PET")
    assert "剑桥英语PET" in sp
    assert "周测分析专家" in sp
    assert "{exam_type}" not in sp


# ─── Summary user prompt: labeled-units block format ─────────────────────


def _sample_summary_request(
    *,
    knowledge_points: list[KnowledgePointGroup] | None = None,
) -> DiagnoseSummaryRequest:
    return DiagnoseSummaryRequest(
        exam_type="PET",
        week_start="2026-04-20",
        week_end="2026-04-26",
        per_section_scores=PerSectionScores(
            READING=82,
            LISTENING=75,
            WRITING=60,
            SPEAKING=70.5,
            VOCAB=80,
            GRAMMAR=None,
        ),
        overall_score=72,
        knowledge_points=knowledge_points or [],
        weak_count=len(knowledge_points or []),
    )


def test_summary_user_prompt_renders_labeled_units_blocks() -> None:
    up = build_diagnose_summary_user_prompt(_sample_summary_request())
    assert "=== 学生信息 ===" in up
    assert "=== 六项能力本周得分 ===" in up
    assert "=== 本周知识点弱项分析 ===" in up
    assert "=== 输出要求 ===" in up
    # Week date appears.
    assert "2026-04-20" in up
    assert "2026-04-26" in up


def test_summary_user_prompt_per_section_score_format() -> None:
    """Each section line uses '<n> 分 (满分 100) — <level>' format."""
    up = build_diagnose_summary_user_prompt(_sample_summary_request())
    # Whole-number formatting (READING=82).
    assert "Reading): 82 分 (满分 100) — 高 (达标)" in up
    # Decimal formatting (SPEAKING=70.5).
    assert "Speaking): 70.5 分 (满分 100) — 高 (达标)" in up
    # Mid band (WRITING=60).
    assert "Writing): 60 分 (满分 100) — 中 (待提升)" in up
    # Missing data (GRAMMAR=None) renders as "暂无数据".
    assert "Grammar): 暂无数据" in up


def test_summary_user_prompt_renders_knowledge_points_with_severity_tag() -> None:
    kp_critical = KnowledgePointGroup(
        knowledge_point="present perfect with since",
        category="grammar",
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
        severity="critical",
    )
    up = build_diagnose_summary_user_prompt(
        _sample_summary_request(knowledge_points=[kp_critical])
    )
    # Severity bracket-tag at the head of each entry.
    assert "[critical] present perfect with since (grammar)" in up
    assert "错题数: 1" in up


def test_summary_user_prompt_empty_knowledge_points_renders_placeholder() -> None:
    up = build_diagnose_summary_user_prompt(_sample_summary_request())
    assert "（本周无弱项知识点" in up


# ─── F-string injection safety ───────────────────────────────────────────


def test_analysis_user_prompt_handles_adversarial_curly_braces() -> None:
    """A WrongAnswer carrying f-string-like text ({x}, {{...}}, etc.) must
    render without crashing. Single-curly text passing through ``str.format``
    would raise KeyError. We verify the builder uses an f-string + plain
    interpolation (no .format(...) on user data)."""
    wa = WrongAnswer(
        section="READING",
        question_text="What does {x} mean in {{template}} syntax?",
        user_answer="A. {answer}",
        correct_answer="B. \\n\\t escape",
        options=["A. {answer}", "B. \\n\\t escape", "C. {y}", "D. {{z}}"],
    )
    # Must not raise (no .format() blowup).
    up = build_diagnose_analysis_user_prompt("KET", [wa])
    # Verbatim adversarial fragments are present.
    assert "{x}" in up
    assert "{{template}}" in up
    assert "{answer}" in up
    assert "\\n\\t escape" in up


def test_summary_user_prompt_handles_adversarial_knowledge_point_names() -> None:
    """Same f-string safety check on the summary user prompt — knowledge_point
    names with curlies / backslashes must render verbatim."""
    kp = KnowledgePointGroup(
        knowledge_point="{adversarial} with \\n in name",
        category="grammar",
        mini_lesson="lesson body {x}",
        rule="rule body {{y}}",
        example_sentences=["example {z}"],
        questions=[
            KnowledgePointQuestion(
                section="GRAMMAR",
                question_text="q",
                user_answer="a",
                correct_answer="b",
                why_wrong="why",
                rule="r",
            )
        ],
        severity="moderate",
    )
    up = build_diagnose_summary_user_prompt(
        _sample_summary_request(knowledge_points=[kp])
    )
    assert "{adversarial} with \\n in name" in up


# ─── translation_skill must NOT leak as a usable category ────────────────


def test_summary_system_prompt_does_not_mention_translation_skill() -> None:
    """The summary system prompt frames KET/PET as Cambridge papers; the
    legacy ``translation_skill`` label from the pretco-app source must not
    leak through."""
    sp_ket = build_diagnose_summary_system_prompt("KET")
    sp_pet = build_diagnose_summary_system_prompt("PET")
    assert "translation_skill" not in sp_ket
    assert "translation_skill" not in sp_pet
