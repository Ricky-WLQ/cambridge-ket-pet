from __future__ import annotations

from app.schemas.listening import (
    ListeningOption,
    ListeningPart,
    ListeningQuestion,
    ListeningTestResponse,
)
from app.validators.listening import validate_listening_response


def _mk_pet_part1() -> ListeningPart:
    return ListeningPart(
        part_number=1,
        kind="MCQ_3_PICTURE",
        instruction_zh="为每个问题，选择正确的图片。",
        preview_sec=5,
        play_rule="PER_ITEM",
        audio_script=[],
        questions=[
            ListeningQuestion(
                id=f"p1q{i}",
                prompt=f"Q{i}",
                type="MCQ_3_PICTURE",
                options=[
                    ListeningOption(id="A"),
                    ListeningOption(id="B"),
                    ListeningOption(id="C"),
                ],
                answer="A",
                explanation_zh="...",
                exam_point_id="PET.L.Part1.gist",
            )
            for i in range(1, 8)
        ],
    )


def _mk_pet_part2() -> ListeningPart:
    return ListeningPart(
        part_number=2,
        kind="MCQ_3_TEXT_DIALOGUE",
        instruction_zh="选择正确答案。",
        preview_sec=8,
        play_rule="PER_ITEM",
        audio_script=[],
        questions=[
            ListeningQuestion(
                id=f"p2q{i}",
                prompt=f"Q{i}",
                type="MCQ_3_TEXT_DIALOGUE",
                options=[
                    ListeningOption(id="A", text="o1"),
                    ListeningOption(id="B", text="o2"),
                    ListeningOption(id="C", text="o3"),
                ],
                answer="B",
                explanation_zh="...",
                exam_point_id="PET.L.Part2.gist",
            )
            for i in range(1, 7)
        ],
    )


def _mk_pet_part3() -> ListeningPart:
    return ListeningPart(
        part_number=3,
        kind="GAP_FILL_OPEN",
        instruction_zh="写下正确答案。",
        preview_sec=20,
        play_rule="PER_PART",
        audio_script=[],
        questions=[
            ListeningQuestion(
                id=f"p3q{i}",
                prompt=f"Gap {i}",
                type="GAP_FILL_OPEN",
                answer="london",
                explanation_zh="...",
                exam_point_id="PET.L.Part3.detail",
            )
            for i in range(1, 7)
        ],
    )


def _mk_pet_part4() -> ListeningPart:
    return ListeningPart(
        part_number=4,
        kind="MCQ_3_TEXT_INTERVIEW",
        instruction_zh="选择正确答案。",
        preview_sec=45,
        play_rule="PER_PART",
        audio_script=[],
        questions=[
            ListeningQuestion(
                id=f"p4q{i}",
                prompt=f"Q{i}",
                type="MCQ_3_TEXT_INTERVIEW",
                options=[
                    ListeningOption(id="A", text="o1"),
                    ListeningOption(id="B", text="o2"),
                    ListeningOption(id="C", text="o3"),
                ],
                answer="C",
                explanation_zh="...",
                exam_point_id="PET.L.Part4.gist",
            )
            for i in range(1, 7)
        ],
    )


def _mk_pet_full_mock() -> ListeningTestResponse:
    """Minimal well-formed PET full-mock payload for validation tests."""
    return ListeningTestResponse(
        version=2,
        exam_type="PET",
        scope="FULL",
        parts=[
            _mk_pet_part1(),
            _mk_pet_part2(),
            _mk_pet_part3(),
            _mk_pet_part4(),
        ],
        cefr_level="B1",
    )


# ---------------------------------------------------------------------------
# Happy path + FULL-scope structural checks
# ---------------------------------------------------------------------------

def test_pet_full_mock_passes():
    errors = validate_listening_response(_mk_pet_full_mock())
    assert errors == []


def test_pet_rejects_3_parts():
    r = _mk_pet_full_mock()
    r.parts = r.parts[:3]  # drop Part 4
    errors = validate_listening_response(r)
    assert any(e.code == "WRONG_PART_COUNT" for e in errors)


def test_pet_part1_rejects_5_questions():
    r = _mk_pet_full_mock()
    r.parts[0].questions = r.parts[0].questions[:5]  # 5 instead of 7
    errors = validate_listening_response(r)
    assert any(e.code == "WRONG_QUESTION_COUNT" for e in errors)


# ---------------------------------------------------------------------------
# PART-scope mismatch
# ---------------------------------------------------------------------------

def test_pet_part_scope_number_mismatch():
    # r.part = 3 but parts[0].part_number = 2
    r = ListeningTestResponse(
        version=2,
        exam_type="PET",
        scope="PART",
        part=3,
        parts=[_mk_pet_part2()],
        cefr_level="B1",
    )
    errors = validate_listening_response(r)
    assert any(e.code == "PART_SCOPE_NUMBER_MISMATCH" for e in errors)


# ---------------------------------------------------------------------------
# Option-count rules
# ---------------------------------------------------------------------------

def test_pet_part4_rejects_wrong_option_count():
    r = _mk_pet_full_mock()
    # Part 4 MCQ_3_TEXT_INTERVIEW needs 3 options; cut to 2.
    r.parts[3].questions[0].options = r.parts[3].questions[0].options[:2]
    errors = validate_listening_response(r)
    assert any(e.code == "MISSING_OPTIONS" for e in errors)


def test_pet_part3_rejects_stray_options():
    r = _mk_pet_full_mock()
    # Part 3 is GAP_FILL_OPEN; stray options on one question is invalid.
    r.parts[2].questions[0].options = [
        ListeningOption(id="A", text="o1"),
        ListeningOption(id="B", text="o2"),
        ListeningOption(id="C", text="o3"),
    ]
    errors = validate_listening_response(r)
    assert any(e.code == "UNEXPECTED_OPTIONS" for e in errors)


# ---------------------------------------------------------------------------
# Part-kind + unknown-part coverage
# ---------------------------------------------------------------------------

def test_pet_rejects_wrong_part_kind():
    r = _mk_pet_full_mock()
    # Part 1 should be MCQ_3_PICTURE; mark as GAP_FILL_OPEN.
    r.parts[0].kind = "GAP_FILL_OPEN"
    errors = validate_listening_response(r)
    assert any(e.code == "WRONG_PART_KIND" for e in errors)


def test_pet_unknown_part_number():
    # Part number 99 has no entry in _QUESTION_COUNTS/_PART_KIND.
    # Use PART scope + matching r.part=99 so only UNKNOWN_PART triggers.
    part99 = _mk_pet_part1()
    part99.part_number = 99
    r = ListeningTestResponse(
        version=2,
        exam_type="PET",
        scope="PART",
        part=99,
        parts=[part99],
        cefr_level="B1",
    )
    errors = validate_listening_response(r)
    assert any(e.code == "UNKNOWN_PART" for e in errors)
