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
    "本周（2026年X月X日—X月X日）……").
"""

from __future__ import annotations

import re

from app.schemas.diagnose import (
    DiagnoseAnalysisResponse,
    DiagnoseSummaryResponse,
)

ALLOWED_CATEGORIES: frozenset[str] = frozenset({
    "grammar",
    "collocation",
    "vocabulary",
    "sentence_pattern",
    "reading_skill",
    "listening_skill",
    "cambridge_strategy",
    "writing_skill",
})

ALLOWED_SECTIONS: frozenset[str] = frozenset({
    "READING",
    "LISTENING",
    "WRITING",
    "SPEAKING",
    "VOCAB",
    "GRAMMAR",
})

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


def validate_diagnose_summary(response: DiagnoseSummaryResponse) -> list[str]:
    """Validate the 4-field summary. Reuses the analyze_student validator
    semantics but adds the weekly-specific rule: ``narrative_zh`` must contain
    a 4-digit year token (enforces the "first sentence names the week" rule).
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

    return errors
