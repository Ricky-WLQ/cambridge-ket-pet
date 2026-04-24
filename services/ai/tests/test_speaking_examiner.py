from unittest.mock import AsyncMock, patch

import pytest

from app.agents.speaking_examiner import run_examiner_turn
from app.schemas.speaking import SpeakingExaminerReply, SpeakingPrompts


def _ket_prompts() -> SpeakingPrompts:
    return SpeakingPrompts(
        level="KET",
        initialGreeting="Hello, I'm Mina.",
        parts=[
            {
                "partNumber": 1,
                "title": "Interview",
                "targetMinutes": 3,
                "examinerScript": ["What's your name?", "Where do you live?"],
                "coachingHints": "Encourage full sentences.",
                "photoKey": None,
            },
            {
                "partNumber": 2,
                "title": "Photo",
                "targetMinutes": 5,
                "examinerScript": ["Describe this photo."],
                "coachingHints": "",
                "photoKey": "speaking/photos/park-01.jpg",
            },
        ],
    )


@pytest.mark.asyncio
async def test_examiner_returns_plain_reply():
    fake_raw_output = "Nice to meet you. Where do you live?"
    with patch("app.agents.speaking_examiner._run_llm", new=AsyncMock(return_value=fake_raw_output)):
        out = await run_examiner_turn(
            prompts=_ket_prompts(),
            history=[{"role": "user", "content": "My name is Li Wei."}],
            current_part=1,
        )
    assert isinstance(out, SpeakingExaminerReply)
    assert out.reply == fake_raw_output
    assert out.advancePart is None
    assert out.sessionEnd is False


@pytest.mark.asyncio
async def test_examiner_advances_part():
    raw = "Great, thank you. [[PART:2]] Now, I'd like you to describe this photo."
    with patch("app.agents.speaking_examiner._run_llm", new=AsyncMock(return_value=raw)):
        out = await run_examiner_turn(
            prompts=_ket_prompts(),
            history=[{"role": "user", "content": "I live in Beijing."}],
            current_part=1,
        )
    assert out.advancePart == 2
    assert "[[PART:2]]" not in out.reply


@pytest.mark.asyncio
async def test_examiner_emits_session_end():
    raw = "Thank you, that's the end of the test. [[SESSION_END]]"
    with patch("app.agents.speaking_examiner._run_llm", new=AsyncMock(return_value=raw)):
        out = await run_examiner_turn(
            prompts=_ket_prompts(),
            history=[{"role": "user", "content": "Yes, I enjoyed that."}],
            current_part=2,
        )
    assert out.sessionEnd is True


@pytest.mark.asyncio
async def test_examiner_enforces_reply_word_cap():
    raw = " ".join(["word"] * 80)
    with patch("app.agents.speaking_examiner._run_llm", new=AsyncMock(return_value=raw)):
        out = await run_examiner_turn(
            prompts=_ket_prompts(),
            history=[{"role": "user", "content": "hi"}],
            current_part=1,
        )
    assert len(out.reply.split()) <= 40


@pytest.mark.asyncio
async def test_examiner_recovers_from_malformed_sentinel():
    raw = "Good answer. [[PART:abc]] Tell me more."
    with patch("app.agents.speaking_examiner._run_llm", new=AsyncMock(return_value=raw)):
        out = await run_examiner_turn(
            prompts=_ket_prompts(),
            history=[{"role": "user", "content": "hi"}],
            current_part=1,
        )
    assert isinstance(out, SpeakingExaminerReply)
    assert out.reply.strip() != ""
    assert out.advancePart is None
    assert out.sessionEnd is False
    assert "[[" not in out.reply


@pytest.mark.asyncio
async def test_examiner_recovers_from_multiple_part_sentinels():
    raw = "[[PART:3]] Good. [[PART:2]] Now photo."
    with patch("app.agents.speaking_examiner._run_llm", new=AsyncMock(return_value=raw)):
        out = await run_examiner_turn(
            prompts=_ket_prompts(),
            history=[{"role": "user", "content": "hi"}],
            current_part=1,
        )
    assert isinstance(out, SpeakingExaminerReply)
    assert out.reply.strip() != ""
    assert out.advancePart is None
    assert out.sessionEnd is False
    assert "[[PART" not in out.reply


@pytest.mark.asyncio
async def test_examiner_recovers_when_strip_leaves_empty():
    raw = "[[PART:abc]]"
    with patch("app.agents.speaking_examiner._run_llm", new=AsyncMock(return_value=raw)):
        out = await run_examiner_turn(
            prompts=_ket_prompts(),
            history=[{"role": "user", "content": "hi"}],
            current_part=1,
        )
    assert out.reply == "Could you say that again, please?"
    assert out.advancePart is None
    assert out.sessionEnd is False


@pytest.mark.asyncio
async def test_examiner_recovery_avoids_word_welding():
    raw = "Thank[[SESSION_END]]you very much. Oops [[PART:abc]] there."
    with patch("app.agents.speaking_examiner._run_llm", new=AsyncMock(return_value=raw)):
        out = await run_examiner_turn(
            prompts=_ket_prompts(),
            history=[{"role": "user", "content": "hi"}],
            current_part=1,
        )
    assert "Thankyou" not in out.reply
    assert "Thank you" in out.reply
