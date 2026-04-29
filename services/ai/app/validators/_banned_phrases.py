"""
Banned-phrase regex enforcement for user-visible AI Chinese output.

Mirrored in TS at apps/web/src/i18n/banned-phrases.ts. KEEP THE TWO LISTS
IN SYNC.

These phrases appear in the existing diagnose summary / analysis prompts
and produce the exam-cram-school register that the 2026-04-29 redesign is
explicitly designed to eliminate. Validators reject any AI response that
contains them, triggering the existing 3-retry loop with the error fed back
to the prompt so the model self-corrects.
"""
from __future__ import annotations

BANNED_PHRASES: list[str] = [
    "决定通过率",
    "属于低分段",
    "未达标",
    "短板",
    "critical 弱项",
    "moderate 弱项",
    "minor 弱项",
    "请重视",
    "切记",
    "不容忽视",
    "亟待提升",
    "[critical]",
    "[moderate]",
    "[minor]",
]


def find_banned(text: str) -> list[str]:
    """Return the list of banned phrases that appear in `text`."""
    return [p for p in BANNED_PHRASES if p in text]
