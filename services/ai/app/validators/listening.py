"""Format validators for Phase 2 listening generation.

Enforces Cambridge 2020-format structural rules. Runs after Pydantic
type validation; catches shape issues that require cross-field checks.
"""

from __future__ import annotations

from app.schemas.listening import (
    ListeningPart,
    ListeningTestResponse,
    QuestionType,
)


class ListeningValidationError(ValueError):
    """Raised when a generated listening response fails format validation."""


# Per-question-type option count (None = no options expected).
_OPTION_COUNTS: dict[QuestionType, int | None] = {
    "MCQ_3_PICTURE": 3,
    "MCQ_3_TEXT": 3,
    "MCQ_3_TEXT_SCENARIO": 3,
    "MCQ_3_TEXT_DIALOGUE": 3,
    "MCQ_3_TEXT_INTERVIEW": 3,
    "MATCHING_5_TO_8": 8,
    "GAP_FILL_OPEN": None,
}

# Expected question counts per (exam_type, part_number) for FULL scope.
_QUESTION_COUNTS: dict[tuple[str, int], int] = {
    ("KET", 1): 5, ("KET", 2): 5, ("KET", 3): 5, ("KET", 4): 5, ("KET", 5): 5,
    ("PET", 1): 7, ("PET", 2): 6, ("PET", 3): 6, ("PET", 4): 6,
}

# Expected question-type per (exam_type, part_number).
_PART_KIND: dict[tuple[str, int], QuestionType] = {
    ("KET", 1): "MCQ_3_PICTURE",
    ("KET", 2): "GAP_FILL_OPEN",
    ("KET", 3): "MCQ_3_TEXT",
    ("KET", 4): "MCQ_3_TEXT_SCENARIO",
    ("KET", 5): "MATCHING_5_TO_8",
    ("PET", 1): "MCQ_3_PICTURE",
    ("PET", 2): "MCQ_3_TEXT_DIALOGUE",
    ("PET", 3): "GAP_FILL_OPEN",
    ("PET", 4): "MCQ_3_TEXT_INTERVIEW",
}


def _validate_part_options(part: ListeningPart) -> None:
    expected = _OPTION_COUNTS[part.kind]
    for q in part.questions:
        if expected is None:
            if q.options:
                raise ListeningValidationError(
                    f"{part.kind} must not have options (question {q.id})"
                )
            continue
        if not q.options or len(q.options) != expected:
            raise ListeningValidationError(
                f"{part.kind} must have {expected} options (question {q.id})"
            )


def _validate_part(exam_type: str, part: ListeningPart) -> None:
    key = (exam_type, part.part_number)
    expected_q = _QUESTION_COUNTS.get(key)
    if expected_q is None:
        raise ListeningValidationError(
            f"Unknown part {part.part_number} for {exam_type}"
        )
    if len(part.questions) != expected_q:
        raise ListeningValidationError(
            f"Part {part.part_number} must have {expected_q} questions, got {len(part.questions)}"
        )
    expected_kind = _PART_KIND[key]
    if part.kind != expected_kind:
        raise ListeningValidationError(
            f"Part {part.part_number} must be {expected_kind}, got {part.kind}"
        )
    _validate_part_options(part)


def validate_listening_response(r: ListeningTestResponse) -> None:
    """Validate a ListeningTestResponse against Cambridge format rules.

    Raises ListeningValidationError on any rule violation.
    """
    if r.scope == "FULL":
        if r.exam_type == "KET" and len(r.parts) != 5:
            raise ListeningValidationError(
                f"KET full-mock must have 5 parts, got {len(r.parts)}"
            )
        if r.exam_type == "PET" and len(r.parts) != 4:
            raise ListeningValidationError(
                f"PET full-mock must have 4 parts, got {len(r.parts)}"
            )
    elif r.scope == "PART":
        if len(r.parts) != 1:
            raise ListeningValidationError(
                f"PART scope must have exactly 1 part, got {len(r.parts)}"
            )
        if r.part is None or r.parts[0].part_number != r.part:
            raise ListeningValidationError(
                "PART scope: r.part must match parts[0].part_number"
            )

    for part in r.parts:
        _validate_part(r.exam_type, part)
