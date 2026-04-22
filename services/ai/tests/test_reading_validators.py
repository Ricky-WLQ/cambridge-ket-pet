"""TDD suite for app.validators.reading.validate_reading_test.

Every test here MUST be written + watched fail BEFORE the matching piece of
validator logic is added to app/validators/reading.py.
"""

from __future__ import annotations

from app.schemas.reading import (
    QuestionType,
    ReadingQuestion,
    ReadingTestResponse,
)
from app.validators.reading import validate_reading_test


def _stub_q(
    q_id: str = "q1",
    q_type: QuestionType = "MATCHING",
    options: list[str] | None = None,
    answer: str = "A",
) -> ReadingQuestion:
    return ReadingQuestion(
        id=q_id,
        type=q_type,
        prompt="dummy prompt",
        options=options,
        answer=answer,
        explanation_zh="测试解释",
        exam_point_id="KET.RW.P1",
        difficulty_point_id=None,
    )


def _stub_response(
    questions: list[ReadingQuestion],
    passage: str | None = "A passage.",
    time_limit_sec: int = 600,
) -> ReadingTestResponse:
    return ReadingTestResponse(
        passage=passage,
        questions=questions,
        time_limit_sec=time_limit_sec,
    )


# ========== RED 1: item count ==========
def test_ket_rw_part_1_requires_exactly_6_items():
    response = _stub_response([_stub_q(f"q{i}") for i in range(5)])  # only 5
    errors = validate_reading_test(response, "KET", 1)
    assert any(e.code == "WRONG_ITEM_COUNT" for e in errors)


def test_ket_rw_part_1_with_exactly_6_items_passes_count_check():
    response = _stub_response([_stub_q(f"q{i}") for i in range(6)])
    errors = validate_reading_test(response, "KET", 1)
    assert not any(e.code == "WRONG_ITEM_COUNT" for e in errors)


def test_pet_reading_part_5_requires_6_items():
    response = _stub_response(
        [_stub_q(f"q{i}", "MCQ_CLOZE", options=["a", "b", "c", "d"]) for i in range(7)]
    )
    errors = validate_reading_test(response, "PET", 5)
    assert any(e.code == "WRONG_ITEM_COUNT" for e in errors)


# ========== RED 2: question type ==========
def test_ket_rw_part_1_must_be_matching_type():
    bad = [_stub_q("q1", q_type="MCQ", options=["a", "b", "c"])]
    bad += [_stub_q(f"q{i}") for i in range(5)]
    response = _stub_response(bad)
    errors = validate_reading_test(response, "KET", 1)
    assert any(e.code == "WRONG_QUESTION_TYPE" for e in errors)


# ========== RED 3: options count for MCQ-family ==========
def test_pet_reading_part_1_requires_5_options_per_mcq():
    # 5 items, each MCQ but only 3 options instead of the 5 PET P1 requires
    qs = [_stub_q(f"q{i}", "MCQ", options=["a", "b", "c"]) for i in range(5)]
    response = _stub_response(qs)
    errors = validate_reading_test(response, "PET", 1)
    assert any(e.code == "WRONG_OPTIONS_COUNT" for e in errors)


def test_pet_reading_part_5_requires_4_options_per_mcq_cloze():
    qs = [_stub_q(f"q{i}", "MCQ_CLOZE", options=["a", "b"]) for i in range(6)]
    response = _stub_response(qs)
    errors = validate_reading_test(response, "PET", 5)
    assert any(e.code == "WRONG_OPTIONS_COUNT" for e in errors)


# ========== RED 4: happy path — valid response has no errors ==========
def test_valid_ket_rw_part_1_returns_no_errors():
    qs = [_stub_q(f"q{i}", q_type="MATCHING") for i in range(6)]
    response = _stub_response(qs)
    errors = validate_reading_test(response, "KET", 1)
    assert errors == []


def test_valid_pet_reading_part_5_returns_no_errors():
    qs = [
        _stub_q(f"q{i}", "MCQ_CLOZE", options=["a", "b", "c", "d"]) for i in range(6)
    ]
    response = _stub_response(qs)
    errors = validate_reading_test(response, "PET", 5)
    assert errors == []


# ========== RED 5: unknown part (e.g. Writing) — no errors ==========
def test_unknown_part_returns_no_errors():
    # KET Part 6 is Writing, not Reading — validator has no reading rules
    response = _stub_response([_stub_q("q1")])
    errors = validate_reading_test(response, "KET", 6)
    assert errors == []


# ========== RED 6: passage required for MATCHING / GAPPED_TEXT parts ==========
def test_ket_rw_part_1_without_passage_fails():
    """KET Part 1 MATCHING requires a passage containing the 8 A-H description bank."""
    qs = [_stub_q(f"q{i}", q_type="MATCHING") for i in range(6)]
    response = _stub_response(qs, passage=None)
    errors = validate_reading_test(response, "KET", 1)
    assert any(e.code == "MISSING_PASSAGE" for e in errors)


def test_pet_reading_part_4_without_passage_fails():
    """PET Part 4 GAPPED_TEXT requires a passage with the gapped text + 8 candidate sentences."""
    qs = [_stub_q(f"q{i}", q_type="GAPPED_TEXT") for i in range(5)]
    response = _stub_response(qs, passage=None)
    errors = validate_reading_test(response, "PET", 4)
    assert any(e.code == "MISSING_PASSAGE" for e in errors)


def test_pet_reading_part_1_without_passage_is_ok():
    """PET Part 1 is MCQ on DISCRETE short texts; no shared passage is needed."""
    qs = [_stub_q(f"q{i}", q_type="MCQ", options=["a", "b", "c", "d", "e"]) for i in range(5)]
    response = _stub_response(qs, passage=None)
    errors = validate_reading_test(response, "PET", 1)
    assert not any(e.code == "MISSING_PASSAGE" for e in errors)
