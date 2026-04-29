"""
Per-portal length caps for AI-generated user-visible Chinese narratives.

Source: docs/superpowers/specs/2026-04-29-ket-pet-redesign-design.md §5.1
"""
from __future__ import annotations

from typing import Literal

# narrative_zh char caps
KET_NARRATIVE_CAP: int = 90  # kid voice — Leo
PET_NARRATIVE_CAP: int = 110  # teen voice — Aria
PROFESSIONAL_NARRATIVE_CAP: int = 160  # teacher view — analysis.py

# list cardinality caps (apply to all portals)
MAX_STRENGTHS: int = 2
MAX_WEAKNESSES: int = 2
MAX_PRIORITY_ACTIONS: int = 3

# per-item char caps within lists
MAX_STRENGTH_ITEM: int = 20
MAX_WEAKNESS_ITEM: int = 25
MAX_PRIORITY_ACTION_ITEM: int = 30


def narrative_cap_for(exam_type: Literal["KET", "PET"]) -> int:
    """Return the narrative_zh char cap for the given portal."""
    return KET_NARRATIVE_CAP if exam_type == "KET" else PET_NARRATIVE_CAP
