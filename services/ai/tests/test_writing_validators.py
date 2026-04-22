"""TDD suite for app.validators.writing.validate_writing_test."""

from __future__ import annotations

from typing import Any

from app.schemas.writing import WritingTaskType, WritingTestResponse
from app.validators.writing import validate_writing_test


def _stub(
    *,
    task_type: WritingTaskType = "EMAIL",
    prompt: str = "Write something.",
    content_points: list[str] | None = None,
    scene_descriptions: list[str] | None = None,
    min_words: int = 25,
    exam_point_id: str = "KET.RW.P6",
    **extra: Any,
) -> WritingTestResponse:
    return WritingTestResponse(
        task_type=task_type,
        prompt=prompt,
        content_points=content_points or [],
        scene_descriptions=scene_descriptions or [],
        min_words=min_words,
        exam_point_id=exam_point_id,
        **extra,
    )


# ========== KET Part 6: guided email, 3 content points, min 25 words ==========
def test_ket_part_6_requires_exactly_3_content_points_too_few():
    resp = _stub(task_type="EMAIL", content_points=["A", "B"], min_words=30)
    errors = validate_writing_test(resp, "KET", 6)
    assert any(e.code == "WRONG_CONTENT_POINTS_COUNT" for e in errors)


def test_ket_part_6_requires_exactly_3_content_points_too_many():
    resp = _stub(
        task_type="EMAIL",
        content_points=["A", "B", "C", "D"],
        min_words=30,
    )
    errors = validate_writing_test(resp, "KET", 6)
    assert any(e.code == "WRONG_CONTENT_POINTS_COUNT" for e in errors)


def test_ket_part_6_min_words_too_low():
    resp = _stub(
        task_type="EMAIL",
        content_points=["A", "B", "C"],
        min_words=10,  # Cambridge KET Part 6 = 25+
    )
    errors = validate_writing_test(resp, "KET", 6)
    assert any(e.code == "MIN_WORDS_TOO_LOW" for e in errors)


def test_ket_part_6_wrong_task_type():
    resp = _stub(
        task_type="PICTURE_STORY",
        content_points=["A", "B", "C"],
        min_words=30,
    )
    errors = validate_writing_test(resp, "KET", 6)
    assert any(e.code == "WRONG_TASK_TYPE" for e in errors)


def test_valid_ket_part_6_returns_no_errors():
    resp = _stub(
        task_type="EMAIL",
        content_points=["Say when you'll arrive", "What to bring", "Ask about the food"],
        min_words=30,
        exam_point_id="KET.RW.P6",
    )
    errors = validate_writing_test(resp, "KET", 6)
    assert errors == []


# ========== KET Part 7: picture story, 3 scene descriptions, min 35 words ==========
def test_ket_part_7_requires_3_scene_descriptions_too_few():
    resp = _stub(
        task_type="PICTURE_STORY",
        scene_descriptions=["Scene 1", "Scene 2"],
        min_words=40,
        exam_point_id="KET.RW.P7",
    )
    errors = validate_writing_test(resp, "KET", 7)
    assert any(e.code == "WRONG_SCENE_COUNT" for e in errors)


def test_ket_part_7_min_words_too_low():
    resp = _stub(
        task_type="PICTURE_STORY",
        scene_descriptions=["Scene 1", "Scene 2", "Scene 3"],
        min_words=20,
        exam_point_id="KET.RW.P7",
    )
    errors = validate_writing_test(resp, "KET", 7)
    assert any(e.code == "MIN_WORDS_TOO_LOW" for e in errors)


def test_ket_part_7_wrong_task_type():
    resp = _stub(
        task_type="EMAIL",
        scene_descriptions=["Scene 1", "Scene 2", "Scene 3"],
        min_words=40,
        exam_point_id="KET.RW.P7",
    )
    errors = validate_writing_test(resp, "KET", 7)
    assert any(e.code == "WRONG_TASK_TYPE" for e in errors)


def test_valid_ket_part_7_returns_no_errors():
    resp = _stub(
        task_type="PICTURE_STORY",
        scene_descriptions=[
            "A boy is watching TV at home.",
            "The boy sees a cat in the garden.",
            "The boy and the cat are playing together.",
        ],
        min_words=40,
        exam_point_id="KET.RW.P7",
    )
    errors = validate_writing_test(resp, "KET", 7)
    assert errors == []


# ========== PET Part 1: email response, 3 content points, min 100 words ==========
def test_pet_part_1_requires_3_content_points():
    resp = _stub(
        task_type="EMAIL",
        content_points=["A", "B"],
        min_words=120,
        exam_point_id="PET.W.P1",
    )
    errors = validate_writing_test(resp, "PET", 1)
    assert any(e.code == "WRONG_CONTENT_POINTS_COUNT" for e in errors)


def test_pet_part_1_min_words_too_low():
    resp = _stub(
        task_type="EMAIL",
        content_points=["A", "B", "C"],
        min_words=50,  # Cambridge PET Part 1 = ~100+
        exam_point_id="PET.W.P1",
    )
    errors = validate_writing_test(resp, "PET", 1)
    assert any(e.code == "MIN_WORDS_TOO_LOW" for e in errors)


def test_valid_pet_part_1_returns_no_errors():
    resp = _stub(
        task_type="EMAIL",
        content_points=["Thank him", "Explain why", "Suggest a time"],
        min_words=100,
        exam_point_id="PET.W.P1",
    )
    errors = validate_writing_test(resp, "PET", 1)
    assert errors == []


# ========== PET Part 2: letter OR story, min 100 words ==========
def test_pet_part_2_requires_letter_or_story_task_type():
    resp = _stub(
        task_type="EMAIL",
        min_words=120,
        exam_point_id="PET.W.P2",
    )
    errors = validate_writing_test(resp, "PET", 2)
    assert any(e.code == "WRONG_TASK_TYPE" for e in errors)


def test_pet_part_2_min_words_too_low():
    resp = _stub(
        task_type="LETTER_OR_STORY",
        min_words=60,
        exam_point_id="PET.W.P2",
    )
    errors = validate_writing_test(resp, "PET", 2)
    assert any(e.code == "MIN_WORDS_TOO_LOW" for e in errors)


def test_valid_pet_part_2_returns_no_errors():
    resp = _stub(
        task_type="LETTER_OR_STORY",
        prompt="Choose ONE: (A) Letter... OR (B) Story starting...",
        min_words=100,
        exam_point_id="PET.W.P2",
    )
    errors = validate_writing_test(resp, "PET", 2)
    assert errors == []


# ========== Out of scope: reading parts / unsupported ==========
def test_reading_part_returns_no_errors():
    resp = _stub()
    errors = validate_writing_test(resp, "KET", 3)  # P3 is Reading
    assert errors == []


def test_unknown_exam_part_combo_returns_no_errors():
    resp = _stub()
    errors = validate_writing_test(resp, "PET", 5)  # PET P5 is Reading
    assert errors == []
