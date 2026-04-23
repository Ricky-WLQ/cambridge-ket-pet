import pytest

from app.schemas.listening import (
    ListeningOption,
    ListeningPart,
    ListeningQuestion,
    ListeningTestResponse,
)
from app.validators.listening import (
    ListeningValidationError,
    validate_listening_response,
)


def _mk_ket_full_mock() -> ListeningTestResponse:
    """Minimal well-formed KET full-mock payload for validation tests."""
    parts = []
    # Part 1: 5 questions, MCQ_3_PICTURE
    parts.append(
        ListeningPart(
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
    )
    # Part 2: 5 gap-fill questions, monologue
    parts.append(
        ListeningPart(
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
    )
    # Part 3: 5 MCQ text, dialogue
    parts.append(
        ListeningPart(
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
    )
    # Part 4: 5 MCQ scenario
    parts.append(
        ListeningPart(
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
    )
    # Part 5: 5 matching (5 people to 8 roles)
    parts.append(
        ListeningPart(
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
    )

    return ListeningTestResponse(
        version=2,
        exam_type="KET",
        scope="FULL",
        parts=parts,
        cefr_level="A2",
    )


def test_ket_full_mock_passes():
    validate_listening_response(_mk_ket_full_mock())  # no raise


def test_ket_rejects_wrong_part_count():
    r = _mk_ket_full_mock()
    r.parts = r.parts[:4]  # drop Part 5
    with pytest.raises(ListeningValidationError, match="KET full-mock must have 5 parts"):
        validate_listening_response(r)


def test_ket_rejects_wrong_question_count_in_part1():
    r = _mk_ket_full_mock()
    r.parts[0].questions = r.parts[0].questions[:4]  # 4 instead of 5
    with pytest.raises(ListeningValidationError, match="Part 1 must have 5 questions"):
        validate_listening_response(r)


def test_ket_part1_rejects_wrong_option_count():
    r = _mk_ket_full_mock()
    r.parts[0].questions[0].options = r.parts[0].questions[0].options[:2]
    with pytest.raises(ListeningValidationError, match="MCQ_3_PICTURE must have 3 options"):
        validate_listening_response(r)


def test_ket_part5_rejects_wrong_option_count():
    r = _mk_ket_full_mock()
    r.parts[4].questions[0].options = r.parts[4].questions[0].options[:7]
    with pytest.raises(ListeningValidationError, match="MATCHING_5_TO_8 must have 8 options"):
        validate_listening_response(r)
