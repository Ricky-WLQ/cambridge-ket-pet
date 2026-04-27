"""Post-generation validators for the Diagnose v2 AI agents.

Pattern mirrors ``app/validators/analysis.py``: each validator returns a list
of error-string descriptions; an empty list means the AI output is acceptable
and the caller may proceed. A non-empty list lets the caller choose to retry
the generation, log a warning, or fail loudly.

Two validators here:
  - ``validate_diagnose_analysis`` — checks the 8-category knowledge-point
    report shape (category whitelist, mandatory fields, section enum).
  - ``validate_diagnose_summary`` — checks the 4-field summary, with the
    weekly-specific rule that ``narrative_zh`` must reference the week date
    (a 4-digit year token, since Chinese narrative usually opens with
    "本周（2026年X月X日—X月X日）……") plus the same score-misreading
    checks (PCT_AS_POINTS_*, BAD_FULL_MARKS_DENOMINATOR) used by the
    student-analysis validator. Both validators delegate to the shared
    ``_score_misreading.check_score_misreading`` helper.
"""

from __future__ import annotations

import re
from typing import get_args

from app.schemas.diagnose import (
    DiagnoseAnalysisResponse,
    DiagnoseSectionKind,
    DiagnoseSummaryRequest,
    DiagnoseSummaryResponse,
    KnowledgePointCategory,
)
from app.validators._score_misreading import check_score_misreading

# Derive the closed-set whitelists from the Literal types in schemas so
# taxonomy edits happen in ONE place. ``typing.get_args`` returns the tuple
# of literal values declared on the alias — exactly what frozenset wants.
ALLOWED_CATEGORIES: frozenset[str] = frozenset(get_args(KnowledgePointCategory))
ALLOWED_SECTIONS: frozenset[str] = frozenset(get_args(DiagnoseSectionKind))

# 4-digit year token starting with "20" — matches 2024–2099. Used to enforce
# that the weekly narrative names the week date in its opening sentence.
#
# We use digit-boundary lookarounds (?<!\d) / (?!\d) instead of \b because
# Python's str-mode \b treats CJK characters as word characters, so the
# pattern \b20\d{2}\b would FAIL to match the canonical Chinese form
# "2026年4月27日" (the trailing 年 is a word char, suppressing the boundary).
# Digit-boundary lookarounds give the same closed-set semantics ("not a
# longer numeric run") while working regardless of surrounding language.
_YEAR_TOKEN_PATTERN = re.compile(r"(?<!\d)20\d{2}(?!\d)")


def validate_diagnose_analysis(response: DiagnoseAnalysisResponse) -> list[str]:
    """Return a list of validation error strings; empty list = valid."""
    errors: list[str] = []

    for i, group in enumerate(response.knowledge_points):
        if group.category not in ALLOWED_CATEGORIES:
            errors.append(
                f"knowledge_points[{i}].category invalid: {group.category!r}"
            )

        if not group.knowledge_point.strip():
            errors.append(f"knowledge_points[{i}].knowledge_point is empty")

        if not group.mini_lesson.strip():
            errors.append(f"knowledge_points[{i}].mini_lesson is empty")

        if len(group.example_sentences) < 1:
            errors.append(
                f"knowledge_points[{i}].example_sentences must have >=1 entry"
            )

        for j, q in enumerate(group.questions):
            if q.section not in ALLOWED_SECTIONS:
                errors.append(
                    f"knowledge_points[{i}].questions[{j}].section invalid: "
                    f"{q.section!r}"
                )
            if not q.why_wrong.strip():
                errors.append(
                    f"knowledge_points[{i}].questions[{j}].why_wrong is empty"
                )

    return errors


def _collect_percentage_scores(req: DiagnoseSummaryRequest) -> set[int]:
    """All 0-100 percentage scores referenced in the diagnose summary input.

    Pulls from ``per_section_scores`` (six possibly-null section scores) and
    ``overall_score`` (always present, since the schema has it as ``float``).
    Floats are floored to int via ``int()`` because the score-misreading
    checks rely on whole-number string matches like '25 分'.
    """
    scores: set[int] = set()
    pss = req.per_section_scores
    for v in (
        pss.READING,
        pss.LISTENING,
        pss.WRITING,
        pss.SPEAKING,
        pss.VOCAB,
        pss.GRAMMAR,
    ):
        if v is not None:
            scores.add(int(v))
    scores.add(int(req.overall_score))
    return scores


def _all_summary_text(response: DiagnoseSummaryResponse) -> str:
    """Combined haystack for score-misreading scan: narrative + bullet lists."""
    return "\n".join(
        [
            *response.strengths,
            *response.weaknesses,
            *response.priority_actions,
            response.narrative_zh,
        ]
    )


def validate_diagnose_summary(
    response: DiagnoseSummaryResponse,
    request: DiagnoseSummaryRequest | None = None,
) -> list[str]:
    """Validate the 4-field summary.

    Args:
        response: Agent output to validate.
        request: Optional request — when provided, the validator runs the
            score-misreading checks against the percentage scores referenced
            in ``per_section_scores`` + ``overall_score``. When omitted (e.g.,
            from a unit test that only cares about structural checks), the
            score-misreading checks are skipped.

    Returns:
        Empty list when the output is acceptable; a list of human-readable
        error strings otherwise. The caller may choose to retry, log, or
        return-anyway based on its retry budget.

    Checks:
      - ``narrative_zh`` non-empty + contains a 4-digit year token
        (enforces "first sentence names the week" rule).
      - ``strengths`` and ``priority_actions`` each have >= 1 entry.
      - When ``request`` is provided: PCT_AS_POINTS_* and
        BAD_FULL_MARKS_DENOMINATOR checks via the shared
        ``check_score_misreading`` helper. Same failure modes the
        ``validate_student_analysis`` validator catches — the LLM
        sometimes confuses the 0-100 percentage scores with raw point
        totals (e.g., emitting "听力得了 25 分（满分 100）" when the
        actual score was 25%).
    """
    errors: list[str] = []

    if not response.narrative_zh.strip():
        errors.append("narrative_zh is empty")
    elif not _YEAR_TOKEN_PATTERN.search(response.narrative_zh):
        errors.append(
            "narrative_zh missing 4-digit year token "
            "(must reference the week date)"
        )

    if not response.strengths:
        errors.append(
            "strengths must have >=1 entry "
            "(use a generic positive remark for empty-week)"
        )

    if not response.priority_actions:
        errors.append("priority_actions must have >=1 entry")

    # Score-misreading checks — only when caller provided the request so
    # we know which percentages to scan for.
    if request is not None:
        text = _all_summary_text(response)
        percent_scores = _collect_percentage_scores(request)
        errors.extend(check_score_misreading(text, percent_scores))

    return errors
