"""Format validators for AI-generated writing tests.

Encodes the per-part Cambridge spec: expected task_type, required content-
point count (KET P6 / PET P1), required scene-description count (KET P7),
and the minimum word count. Mirrors the data-driven pattern of
app/validators/reading.py.
"""

from __future__ import annotations

from dataclasses import dataclass

from pydantic import BaseModel

from app.schemas.writing import ExamType, WritingTaskType, WritingTestResponse


class WritingValidationError(BaseModel):
    code: str
    message: str


@dataclass(frozen=True)
class WritingSpec:
    task_type: WritingTaskType
    content_points: int  # 0 if not applicable
    scene_descriptions: int  # 0 if not applicable
    min_words: int


# Cambridge-official writing spec per part (see plan Exam Ground Truth):
#   KET Part 6: guided email,    3 content points, >= 25 words
#   KET Part 7: picture story,   3 scene descriptions, >= 35 words
#   PET Part 1: email response,  3 content points, >= 100 words
#   PET Part 2: letter OR story, free composition, >= 100 words
SPECS: dict[tuple[ExamType, int], WritingSpec] = {
    ("KET", 6): WritingSpec(task_type="EMAIL", content_points=3, scene_descriptions=0, min_words=25),
    ("KET", 7): WritingSpec(task_type="PICTURE_STORY", content_points=0, scene_descriptions=3, min_words=35),
    ("PET", 1): WritingSpec(task_type="EMAIL", content_points=3, scene_descriptions=0, min_words=100),
    ("PET", 2): WritingSpec(task_type="LETTER_OR_STORY", content_points=0, scene_descriptions=0, min_words=100),
}


def validate_writing_test(
    response: WritingTestResponse,
    exam_type: ExamType,
    part: int,
) -> list[WritingValidationError]:
    errors: list[WritingValidationError] = []
    key = (exam_type, part)

    spec = SPECS.get(key)
    if spec is None:
        return errors

    if response.task_type != spec.task_type:
        errors.append(
            WritingValidationError(
                code="WRONG_TASK_TYPE",
                message=(
                    f"{exam_type} Part {part} must have task_type='{spec.task_type}'; "
                    f"got '{response.task_type}'."
                ),
            )
        )

    if spec.content_points > 0 and len(response.content_points) != spec.content_points:
        errors.append(
            WritingValidationError(
                code="WRONG_CONTENT_POINTS_COUNT",
                message=(
                    f"{exam_type} Part {part} requires exactly {spec.content_points} "
                    f"content points; got {len(response.content_points)}."
                ),
            )
        )

    if spec.scene_descriptions > 0 and len(response.scene_descriptions) != spec.scene_descriptions:
        errors.append(
            WritingValidationError(
                code="WRONG_SCENE_COUNT",
                message=(
                    f"{exam_type} Part {part} requires exactly {spec.scene_descriptions} "
                    f"scene descriptions; got {len(response.scene_descriptions)}."
                ),
            )
        )

    if response.min_words < spec.min_words:
        errors.append(
            WritingValidationError(
                code="MIN_WORDS_TOO_LOW",
                message=(
                    f"{exam_type} Part {part} requires min_words >= {spec.min_words} "
                    f"per Cambridge spec; got {response.min_words}."
                ),
            )
        )

    return errors
