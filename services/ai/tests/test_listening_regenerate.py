"""Tests for generate_listening_test regenerate-on-validator-fail logic."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.agents.listening_generator import generate_listening_test
from app.schemas.listening import (
    ListeningOption,
    ListeningPart,
    ListeningQuestion,
    ListeningTestResponse,
)


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
    """Pydantic AI run() returns an object whose .output is a JSON string.

    listening_generator now uses str output_type + manual JSON parsing
    (mirrors speaking_generator) to sidestep DeepSeek's tool-call
    trailing-character quirk. The mock therefore returns the response
    serialized to JSON, not the typed response object.
    """
    m = MagicMock()
    m.output = response.model_dump_json()
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
