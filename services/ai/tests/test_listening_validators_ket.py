from app.schemas.listening import (
    ListeningOption,
    ListeningPart,
    ListeningQuestion,
    ListeningTestResponse,
)
from app.validators.listening import validate_listening_response


def _mk_ket_part1() -> ListeningPart:
    return ListeningPart(
        part_number=1,
        kind="MCQ_3_PICTURE",
        instruction_zh="为每个问题，选择正确的图片。",
        preview_sec=5,
        play_rule="PER_ITEM",
        audio_script=[],
        questions=[
            ListeningQuestion(
                id=f"k1q{i}",
                prompt=f"Q{i}",
                type="MCQ_3_PICTURE",
                options=[
                    ListeningOption(id="A"),
                    ListeningOption(id="B"),
                    ListeningOption(id="C"),
                ],
                answer="A",
                explanation_zh="...",
                exam_point_id="KET.L.Part1.gist",
            )
            for i in range(1, 6)
        ],
    )


def _mk_ket_part2() -> ListeningPart:
    return ListeningPart(
        part_number=2,
        kind="GAP_FILL_OPEN",
        instruction_zh="写下正确答案。",
        preview_sec=10,
        play_rule="PER_PART",
        audio_script=[],
        questions=[
            ListeningQuestion(
                id=f"k2q{i}",
                prompt=f"Gap {i}",
                type="GAP_FILL_OPEN",
                answer="fairford",
                explanation_zh="...",
                exam_point_id="KET.L.Part2.detail",
            )
            for i in range(1, 6)
        ],
    )


def _mk_ket_part3() -> ListeningPart:
    return ListeningPart(
        part_number=3,
        kind="MCQ_3_TEXT",
        instruction_zh="选择正确答案。",
        preview_sec=20,
        play_rule="PER_PART",
        audio_script=[],
        questions=[
            ListeningQuestion(
                id=f"k3q{i}",
                prompt=f"Q{i}",
                type="MCQ_3_TEXT",
                options=[
                    ListeningOption(id="A", text="o1"),
                    ListeningOption(id="B", text="o2"),
                    ListeningOption(id="C", text="o3"),
                ],
                answer="B",
                explanation_zh="...",
                exam_point_id="KET.L.Part3.gist",
            )
            for i in range(1, 6)
        ],
    )


def _mk_ket_part4() -> ListeningPart:
    return ListeningPart(
        part_number=4,
        kind="MCQ_3_TEXT_SCENARIO",
        instruction_zh="选择正确答案。",
        preview_sec=5,
        play_rule="PER_ITEM",
        audio_script=[],
        questions=[
            ListeningQuestion(
                id=f"k4q{i}",
                prompt=f"Q{i}",
                type="MCQ_3_TEXT_SCENARIO",
                options=[
                    ListeningOption(id="A", text="o1"),
                    ListeningOption(id="B", text="o2"),
                    ListeningOption(id="C", text="o3"),
                ],
                answer="C",
                explanation_zh="...",
                exam_point_id="KET.L.Part4.gist",
            )
            for i in range(1, 6)
        ],
    )


def _mk_ket_part5() -> ListeningPart:
    return ListeningPart(
        part_number=5,
        kind="MATCHING_5_TO_8",
        instruction_zh="为每个人选择正确的任务。",
        preview_sec=15,
        play_rule="PER_PART",
        audio_script=[],
        questions=[
            ListeningQuestion(
                id=f"k5q{i}",
                prompt=f"Person {i}",
                type="MATCHING_5_TO_8",
                options=[
                    ListeningOption(id=chr(65 + j))
                    for j in range(8)
                ],
                answer=chr(65 + i - 1),
                explanation_zh="...",
                exam_point_id="KET.L.Part5.detail",
            )
            for i in range(1, 6)
        ],
    )


def _mk_ket_full_mock() -> ListeningTestResponse:
    """Minimal well-formed KET full-mock payload for validation tests."""
    return ListeningTestResponse(
        version=2,
        exam_type="KET",
        scope="FULL",
        parts=[
            _mk_ket_part1(),
            _mk_ket_part2(),
            _mk_ket_part3(),
            _mk_ket_part4(),
            _mk_ket_part5(),
        ],
        cefr_level="A2",
    )


# ---------------------------------------------------------------------------
# Existing tests (refactored to collect-all + structured codes)
# ---------------------------------------------------------------------------

def test_ket_full_mock_passes():
    errors = validate_listening_response(_mk_ket_full_mock())
    assert errors == []


def test_ket_rejects_wrong_part_count():
    r = _mk_ket_full_mock()
    r.parts = r.parts[:4]  # drop Part 5
    errors = validate_listening_response(r)
    assert any(e.code == "WRONG_PART_COUNT" for e in errors)


def test_ket_rejects_wrong_question_count_in_part1():
    r = _mk_ket_full_mock()
    r.parts[0].questions = r.parts[0].questions[:4]  # 4 instead of 5
    errors = validate_listening_response(r)
    assert any(e.code == "WRONG_QUESTION_COUNT" for e in errors)


def test_ket_part1_rejects_wrong_option_count():
    r = _mk_ket_full_mock()
    r.parts[0].questions[0].options = r.parts[0].questions[0].options[:2]
    errors = validate_listening_response(r)
    assert any(e.code == "MISSING_OPTIONS" for e in errors)


def test_ket_part5_rejects_wrong_option_count():
    r = _mk_ket_full_mock()
    r.parts[4].questions[0].options = r.parts[4].questions[0].options[:7]
    errors = validate_listening_response(r)
    assert any(e.code == "MISSING_OPTIONS" for e in errors)


# ---------------------------------------------------------------------------
# New tests: additional coverage gaps from review
# ---------------------------------------------------------------------------

def test_ket_rejects_wrong_part_kind():
    r = _mk_ket_full_mock()
    # Part 1 should be MCQ_3_PICTURE; mark as GAP_FILL_OPEN.
    r.parts[0].kind = "GAP_FILL_OPEN"
    errors = validate_listening_response(r)
    assert any(e.code == "WRONG_PART_KIND" for e in errors)


def test_ket_part2_rejects_stray_options():
    r = _mk_ket_full_mock()
    # Part 2 is GAP_FILL_OPEN; stray options on one question is invalid.
    r.parts[1].questions[0].options = [
        ListeningOption(id="A"),
        ListeningOption(id="B"),
        ListeningOption(id="C"),
    ]
    errors = validate_listening_response(r)
    assert any(e.code == "UNEXPECTED_OPTIONS" for e in errors)


def test_ket_rejects_full_scope_with_part_set():
    r = _mk_ket_full_mock()
    r.part = 3  # FULL scope must have part=None
    errors = validate_listening_response(r)
    assert any(e.code == "FULL_SCOPE_HAS_PART" for e in errors)


def test_ket_part_scope_happy_path():
    r = ListeningTestResponse(
        version=2,
        exam_type="KET",
        scope="PART",
        part=1,
        parts=[_mk_ket_part1()],
        cefr_level="A2",
    )
    errors = validate_listening_response(r)
    assert errors == []


# ---------------------------------------------------------------------------
# PART-scope error-path tests
# ---------------------------------------------------------------------------

def test_ket_part_scope_wrong_len():
    r = ListeningTestResponse(
        version=2,
        exam_type="KET",
        scope="PART",
        part=1,
        parts=[_mk_ket_part1(), _mk_ket_part2()],  # 2 parts — invalid
        cefr_level="A2",
    )
    errors = validate_listening_response(r)
    assert any(e.code == "PART_SCOPE_WRONG_LEN" for e in errors)


def test_ket_part_scope_number_mismatch():
    # r.part = 1 but parts[0].part_number = 2
    r = ListeningTestResponse(
        version=2,
        exam_type="KET",
        scope="PART",
        part=1,
        parts=[_mk_ket_part2()],
        cefr_level="A2",
    )
    errors = validate_listening_response(r)
    assert any(e.code == "PART_SCOPE_NUMBER_MISMATCH" for e in errors)
