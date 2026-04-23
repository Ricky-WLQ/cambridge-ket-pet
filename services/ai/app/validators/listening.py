"""Format validators for Phase 2 listening generation.

Enforces Cambridge 2020-format structural rules. Runs after Pydantic
type validation; catches shape issues that require cross-field checks.

The ``ValidationError`` class is imported from ``app.validators.reading`` so
listening and reading share the same error shape (``code`` + ``message``).
This lets callers (retry orchestrator, telemetry, tests) treat Phase 1 and
Phase 2 validation errors uniformly. ``validate_listening_response`` follows
the Phase 1 collect-all pattern: it returns a ``list[ValidationError]``
instead of raising on the first failure, so a single LLM retry can see every
structural issue at once.
"""

from __future__ import annotations

from app.schemas.listening import (
    ListeningPart,
    ListeningTestResponse,
    QuestionType,
)
from app.validators.reading import ValidationError

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


def _validate_part_options(
    part: ListeningPart,
    errors: list[ValidationError],
) -> None:
    expected = _OPTION_COUNTS[part.kind]
    for q in part.questions:
        if expected is None:
            if q.options:
                errors.append(
                    ValidationError(
                        code="UNEXPECTED_OPTIONS",
                        message=(
                            f"{part.kind} must not have options "
                            f"(question {q.id})"
                        ),
                    )
                )
            continue
        if not q.options or len(q.options) != expected:
            actual = 0 if not q.options else len(q.options)
            errors.append(
                ValidationError(
                    code="MISSING_OPTIONS",
                    message=(
                        f"{part.kind} must have {expected} options "
                        f"(question {q.id}); got {actual}"
                    ),
                )
            )


def _validate_part(
    exam_type: str,
    part: ListeningPart,
    errors: list[ValidationError],
) -> None:
    key = (exam_type, part.part_number)
    expected_q = _QUESTION_COUNTS.get(key)
    if expected_q is None:
        errors.append(
            ValidationError(
                code="UNKNOWN_PART",
                message=f"Unknown part {part.part_number} for {exam_type}",
            )
        )
        # No further checks possible without a known expected shape.
        return
    # Order below preserves the original raise-order: count -> kind -> options.
    if len(part.questions) != expected_q:
        errors.append(
            ValidationError(
                code="WRONG_QUESTION_COUNT",
                message=(
                    f"Part {part.part_number} must have {expected_q} "
                    f"questions, got {len(part.questions)}"
                ),
            )
        )
    expected_kind = _PART_KIND[key]
    if part.kind != expected_kind:
        errors.append(
            ValidationError(
                code="WRONG_PART_KIND",
                message=(
                    f"Part {part.part_number} must be {expected_kind}, "
                    f"got {part.kind}"
                ),
            )
        )
    _validate_part_options(part, errors)


def validate_listening_response(
    r: ListeningTestResponse,
) -> list[ValidationError]:
    """Return structured validation errors. Empty list means the response
    matches the Cambridge-official listening format for its (exam_type, scope).

    Mirrors ``app.validators.reading.validate_reading_test`` (collect-all +
    structured codes) so callers can handle Phase 1 and Phase 2 uniformly.
    """
    errors: list[ValidationError] = []

    if r.scope == "FULL":
        if r.part is not None:
            errors.append(
                ValidationError(
                    code="FULL_SCOPE_HAS_PART",
                    message=(
                        f"FULL scope must have part=None, got {r.part}"
                    ),
                )
            )
        if r.exam_type == "KET" and len(r.parts) != 5:
            errors.append(
                ValidationError(
                    code="WRONG_PART_COUNT",
                    message=(
                        f"KET full-mock must have 5 parts, got {len(r.parts)}"
                    ),
                )
            )
        if r.exam_type == "PET" and len(r.parts) != 4:
            errors.append(
                ValidationError(
                    code="WRONG_PART_COUNT",
                    message=(
                        f"PET full-mock must have 4 parts, got {len(r.parts)}"
                    ),
                )
            )
    elif r.scope == "PART":
        if len(r.parts) != 1:
            errors.append(
                ValidationError(
                    code="PART_SCOPE_WRONG_LEN",
                    message=(
                        f"PART scope must have exactly 1 part, "
                        f"got {len(r.parts)}"
                    ),
                )
            )
        elif r.part is None or r.parts[0].part_number != r.part:
            errors.append(
                ValidationError(
                    code="PART_SCOPE_NUMBER_MISMATCH",
                    message=(
                        "PART scope: r.part must match parts[0].part_number"
                    ),
                )
            )

    for part in r.parts:
        _validate_part(r.exam_type, part, errors)

    return errors
