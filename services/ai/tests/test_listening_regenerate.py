"""Tests for generate_listening_test regenerate-on-validator-fail logic."""

from __future__ import annotations

import re
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic_ai import UnexpectedModelBehavior

from app.agents.listening_generator import generate_listening_test
from app.schemas.listening import (
    ListeningOption,
    ListeningPart,
    ListeningQuestion,
    ListeningTestResponse,
)

# Spec mirrors validators/listening.py — kept independent so a wrong validator
# change can't accidentally satisfy these fan-out tests.
_PART_SPEC: dict[tuple[str, int], tuple[str, int, int | None]] = {
    ("KET", 1): ("MCQ_3_PICTURE", 5, 3),
    ("KET", 2): ("GAP_FILL_OPEN", 5, None),
    ("KET", 3): ("MCQ_3_TEXT", 5, 3),
    ("KET", 4): ("MCQ_3_TEXT_SCENARIO", 5, 3),
    ("KET", 5): ("MATCHING_5_TO_8", 5, 8),
    ("PET", 1): ("MCQ_3_PICTURE", 7, 3),
    ("PET", 2): ("MCQ_3_TEXT_DIALOGUE", 6, 3),
    ("PET", 3): ("GAP_FILL_OPEN", 6, None),
    ("PET", 4): ("MCQ_3_TEXT_INTERVIEW", 6, 3),
}


def _valid_listening_part(exam_type: str, part_number: int) -> ListeningPart:
    kind, n_questions, n_options = _PART_SPEC[(exam_type, part_number)]
    if n_options is None:
        opts: list[ListeningOption] | None = None
    else:
        ids = "ABC" if n_options == 3 else "ABCDEFGH"
        opts = [ListeningOption(id=c) for c in ids[:n_options]]
    return ListeningPart(
        part_number=part_number,
        kind=kind,  # type: ignore[arg-type]
        instruction_zh="...",
        preview_sec=5,
        play_rule="PER_ITEM",
        audio_script=[],
        questions=[
            ListeningQuestion(
                id=f"p{part_number}q{i}",
                prompt=f"Q{i}",
                type=kind,  # type: ignore[arg-type]
                options=opts,
                answer="A",
                explanation_zh="...",
                exam_point_id=f"{exam_type}.L.P{part_number}.gist",
            )
            for i in range(1, n_questions + 1)
        ],
    )


def _valid_part_response(exam_type: str, part_number: int) -> ListeningTestResponse:
    return ListeningTestResponse(
        version=2,
        exam_type=exam_type,  # type: ignore[arg-type]
        scope="PART",
        part=part_number,
        parts=[_valid_listening_part(exam_type, part_number)],
        cefr_level="A2" if exam_type == "KET" else "B1",
    )


def _part_dispatching_side_effect(exam_type: str):
    """Returns a side_effect callable that inspects the prompt and returns
    the right part response — used for fan-out tests where 5 parallel calls
    all hit the same mocked agent."""

    def fn(prompt: str, **kwargs):
        m = re.search(r"part=(\d+)", prompt)
        if not m:
            raise AssertionError(
                f"fan-out should always specify part=N in prompt, got: {prompt!r}"
            )
        part_num = int(m.group(1))
        return _mock_run_result(_valid_part_response(exam_type, part_num))

    return fn


def _valid_ket_part1() -> ListeningPart:
    return ListeningPart(
        part_number=1,
        kind="MCQ_3_PICTURE",
        instruction_zh="...",
        preview_sec=5,
        play_rule="PER_ITEM",
        audio_script=[],
        questions=[
            ListeningQuestion(
                id=f"q{i}",
                prompt=f"Q{i}",
                type="MCQ_3_PICTURE",
                options=[
                    ListeningOption(id="A"),
                    ListeningOption(id="B"),
                    ListeningOption(id="C"),
                ],
                answer="A",
                explanation_zh="...",
                exam_point_id="KET.L.P1.gist",
            )
            for i in range(1, 6)
        ],
    )


def _invalid_ket_part1() -> ListeningPart:
    """KET Part 1 with 0 questions — fails validator."""
    return ListeningPart(
        part_number=1,
        kind="MCQ_3_PICTURE",
        instruction_zh="...",
        preview_sec=5,
        play_rule="PER_ITEM",
        audio_script=[],
        questions=[],
    )


def _invalid_response() -> ListeningTestResponse:
    return ListeningTestResponse(
        version=2,
        exam_type="KET",
        scope="PART",
        part=1,
        parts=[_invalid_ket_part1()],
        cefr_level="A2",
    )


def _valid_response() -> ListeningTestResponse:
    return ListeningTestResponse(
        version=2,
        exam_type="KET",
        scope="PART",
        part=1,
        parts=[_valid_ket_part1()],
        cefr_level="A2",
    )


def _mock_run_result(response: ListeningTestResponse) -> MagicMock:
    """Pydantic AI run() returns an object whose .output is the typed response."""
    m = MagicMock()
    m.output = response
    return m


async def test_generate_retries_on_validator_fail_then_succeeds() -> None:
    """If the agent returns invalid output twice then valid on the 3rd try, succeed."""
    invalid = _invalid_response()
    valid = _valid_response()

    mock_agent = MagicMock()
    mock_agent.run = AsyncMock(
        side_effect=[
            _mock_run_result(invalid),
            _mock_run_result(invalid),
            _mock_run_result(valid),
        ]
    )

    with patch(
        "app.agents.listening_generator.get_listening_generator",
        return_value=mock_agent,
    ):
        result = await generate_listening_test("KET", "PART", part=1)

    assert result.parts[0].questions  # non-empty = valid payload
    assert mock_agent.run.call_count == 3


async def test_generate_gives_up_after_3_retries() -> None:
    """If the agent returns invalid output 3 times, raise ValueError with the errors."""
    invalid = _invalid_response()

    mock_agent = MagicMock()
    mock_agent.run = AsyncMock(return_value=_mock_run_result(invalid))

    with (
        patch(
            "app.agents.listening_generator.get_listening_generator",
            return_value=mock_agent,
        ),
        pytest.raises(ValueError, match="validation failed"),
    ):
        await generate_listening_test("KET", "PART", part=1)

    assert mock_agent.run.call_count == 3


async def test_generate_retries_on_pydantic_unexpected_model_behavior() -> None:
    """If pydantic-ai raises UnexpectedModelBehavior on attempt 1, the outer
    loop catches it and retries — succeeding on attempt 2."""
    valid = _valid_response()

    mock_agent = MagicMock()
    mock_agent.run = AsyncMock(
        side_effect=[
            UnexpectedModelBehavior("Exceeded maximum retries (1) for output validation"),
            _mock_run_result(valid),
        ]
    )

    with patch(
        "app.agents.listening_generator.get_listening_generator",
        return_value=mock_agent,
    ):
        result = await generate_listening_test("KET", "PART", part=1)

    assert result.parts[0].questions
    assert mock_agent.run.call_count == 2


async def test_generate_gives_up_after_3_pydantic_failures() -> None:
    """If pydantic-ai raises UnexpectedModelBehavior every attempt, raise
    ValueError mentioning pydantic schema validation."""
    mock_agent = MagicMock()
    mock_agent.run = AsyncMock(
        side_effect=UnexpectedModelBehavior(
            "Exceeded maximum retries (1) for output validation"
        )
    )

    with (
        patch(
            "app.agents.listening_generator.get_listening_generator",
            return_value=mock_agent,
        ),
        pytest.raises(ValueError, match="pydantic schema validation failed"),
    ):
        await generate_listening_test("KET", "PART", part=1)

    assert mock_agent.run.call_count == 3


async def test_generate_mixed_pydantic_then_format_then_succeeds() -> None:
    """attempt 1 raises UnexpectedModelBehavior, attempt 2 fails format check,
    attempt 3 succeeds — full coverage of the outer loop's two failure modes."""
    invalid = _invalid_response()
    valid = _valid_response()

    mock_agent = MagicMock()
    mock_agent.run = AsyncMock(
        side_effect=[
            UnexpectedModelBehavior("schema validation failed"),
            _mock_run_result(invalid),
            _mock_run_result(valid),
        ]
    )

    with patch(
        "app.agents.listening_generator.get_listening_generator",
        return_value=mock_agent,
    ):
        result = await generate_listening_test("KET", "PART", part=1)

    assert result.parts[0].questions
    assert mock_agent.run.call_count == 3


# -------- FULL-scope fan-out tests --------


async def test_full_scope_fans_out_to_5_parts_for_ket() -> None:
    """KET FULL fans out to 5 parallel scope=PART calls and merges the
    per-part responses into a single FULL response with all 5 parts in order."""
    mock_agent = MagicMock()
    mock_agent.run = AsyncMock(side_effect=_part_dispatching_side_effect("KET"))

    with patch(
        "app.agents.listening_generator.get_listening_generator",
        return_value=mock_agent,
    ):
        result = await generate_listening_test("KET", "FULL")

    assert result.scope == "FULL"
    assert result.exam_type == "KET"
    assert result.part is None
    assert result.cefr_level == "A2"
    assert [p.part_number for p in result.parts] == [1, 2, 3, 4, 5]
    assert [p.kind for p in result.parts] == [
        "MCQ_3_PICTURE",
        "GAP_FILL_OPEN",
        "MCQ_3_TEXT",
        "MCQ_3_TEXT_SCENARIO",
        "MATCHING_5_TO_8",
    ]
    assert mock_agent.run.call_count == 5


async def test_full_scope_fans_out_to_4_parts_for_pet() -> None:
    """PET FULL fans out to 4 parallel scope=PART calls."""
    mock_agent = MagicMock()
    mock_agent.run = AsyncMock(side_effect=_part_dispatching_side_effect("PET"))

    with patch(
        "app.agents.listening_generator.get_listening_generator",
        return_value=mock_agent,
    ):
        result = await generate_listening_test("PET", "FULL")

    assert result.scope == "FULL"
    assert result.exam_type == "PET"
    assert result.part is None
    assert result.cefr_level == "B1"
    assert [p.part_number for p in result.parts] == [1, 2, 3, 4]
    assert [p.kind for p in result.parts] == [
        "MCQ_3_PICTURE",
        "MCQ_3_TEXT_DIALOGUE",
        "GAP_FILL_OPEN",
        "MCQ_3_TEXT_INTERVIEW",
    ]
    assert mock_agent.run.call_count == 4


async def test_full_scope_propagates_per_part_failure() -> None:
    """If one of the per-part calls exhausts retries, FULL raises ValueError."""
    mock_agent = MagicMock()
    mock_agent.run = AsyncMock(
        side_effect=UnexpectedModelBehavior(
            "Exceeded maximum retries (1) for output validation"
        )
    )

    with (
        patch(
            "app.agents.listening_generator.get_listening_generator",
            return_value=mock_agent,
        ),
        pytest.raises(ValueError, match="pydantic schema validation failed"),
    ):
        await generate_listening_test("KET", "FULL")
