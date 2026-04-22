"""Format validators for AI-generated reading tests.

Source of truth: Cambridge-official KET and PET format docs (see plan's
'Exam Ground Truth' section). These tables encode the spec as data; the
validator is a thin loop over them.
"""

from __future__ import annotations

from pydantic import BaseModel

from app.schemas.reading import ExamType, QuestionType, ReadingTestResponse


class ValidationError(BaseModel):
    code: str
    message: str


# Expected number of items per (exam_type, part).
# None = the validator has no reading rules for that part (e.g. Writing parts).
EXPECTED_ITEM_COUNT: dict[tuple[ExamType, int], int] = {
    # KET Reading & Writing — Reading parts (1-5); parts 6-7 are Writing
    ("KET", 1): 6,
    ("KET", 2): 7,
    ("KET", 3): 5,
    ("KET", 4): 4,
    ("KET", 5): 4,
    # PET Reading — 6 parts
    ("PET", 1): 5,
    ("PET", 2): 5,
    ("PET", 3): 5,
    ("PET", 4): 5,
    ("PET", 5): 6,
    ("PET", 6): 6,
}

# Allowed question.type values per (exam_type, part).
EXPECTED_TYPES: dict[tuple[ExamType, int], set[QuestionType]] = {
    ("KET", 1): {"MATCHING"},
    ("KET", 2): {"OPEN_CLOZE"},
    ("KET", 3): {"MCQ"},
    ("KET", 4): {"MATCHING"},
    ("KET", 5): {"MCQ_CLOZE"},
    ("PET", 1): {"MCQ"},
    ("PET", 2): {"MATCHING"},
    ("PET", 3): {"MCQ"},
    ("PET", 4): {"GAPPED_TEXT"},
    ("PET", 5): {"MCQ_CLOZE"},
    ("PET", 6): {"OPEN_CLOZE"},
}

# Required options count for MCQ-family types on each part (None = no options).
# Matches Cambridge-official formats: KET MCQs have 3 options; PET Part 1 has 5,
# Parts 3 and 5 have 3 and 4 respectively.
EXPECTED_OPTIONS_COUNT: dict[tuple[ExamType, int], int | None] = {
    ("KET", 1): None,  # matching
    ("KET", 2): None,  # open cloze
    ("KET", 3): 3,
    ("KET", 4): None,  # matching
    ("KET", 5): 3,
    ("PET", 1): 5,
    ("PET", 2): None,  # matching
    ("PET", 3): 3,
    ("PET", 4): None,  # gapped text
    ("PET", 5): 4,
    ("PET", 6): None,  # open cloze
}


def validate_reading_test(
    response: ReadingTestResponse,
    exam_type: ExamType,
    part: int,
) -> list[ValidationError]:
    """Return structured validation errors. Empty list means the response
    matches the Cambridge-official format for (exam_type, part)."""
    errors: list[ValidationError] = []
    key = (exam_type, part)

    # No rules registered for this part? Treat as out-of-scope (e.g. Writing).
    if key not in EXPECTED_ITEM_COUNT:
        return errors

    expected_count = EXPECTED_ITEM_COUNT[key]
    actual_count = len(response.questions)
    if actual_count != expected_count:
        errors.append(
            ValidationError(
                code="WRONG_ITEM_COUNT",
                message=(
                    f"{exam_type} Part {part} must have exactly {expected_count} "
                    f"items; got {actual_count}."
                ),
            )
        )

    allowed_types = EXPECTED_TYPES.get(key)
    if allowed_types:
        for q in response.questions:
            if q.type not in allowed_types:
                errors.append(
                    ValidationError(
                        code="WRONG_QUESTION_TYPE",
                        message=(
                            f"Question {q.id} has type '{q.type}'; "
                            f"expected one of {sorted(allowed_types)} "
                            f"for {exam_type} Part {part}."
                        ),
                    )
                )

    required_options = EXPECTED_OPTIONS_COUNT.get(key)
    if required_options is not None:
        for q in response.questions:
            if q.options is None:
                errors.append(
                    ValidationError(
                        code="MISSING_OPTIONS",
                        message=(
                            f"Question {q.id} has no options; "
                            f"{exam_type} Part {part} requires {required_options}."
                        ),
                    )
                )
            elif len(q.options) != required_options:
                errors.append(
                    ValidationError(
                        code="WRONG_OPTIONS_COUNT",
                        message=(
                            f"Question {q.id} has {len(q.options)} options; "
                            f"{exam_type} Part {part} requires exactly "
                            f"{required_options}."
                        ),
                    )
                )

    return errors
