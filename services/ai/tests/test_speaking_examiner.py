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


@pytest.mark.asyncio
async def test_examiner_payload_includes_progression_cursor():
    """Regression guard: the user payload built for the LLM must include
    the script-progression cursor and next-part info so the model never
    cycles back to script[0] of an exhausted part. Captures the actual
    user_payload string that gets sent to _run_llm.
    """
    captured: dict[str, str] = {}

    async def fake_llm(*, system_prompt: str, user_payload: str, **_kwargs):
        captured["user"] = user_payload
        captured["system"] = system_prompt
        return "Where do you live?"

    with patch("app.agents.speaking_examiner._run_llm", new=fake_llm):
        await run_examiner_turn(
            prompts=_ket_prompts(),
            history=[
                {"role": "assistant", "content": "Hello, I'm Mina."},
                {"role": "assistant", "content": "What's your name?"},
                {"role": "user", "content": "My name is Li Wei."},
            ],
            current_part=1,
            current_part_question_count=1,  # script[0] already issued
        )
    payload = captured["user"]
    # Cursor + next-script-item are present and correct
    assert '"current_part_question_count": 1' in payload
    assert '"next_script_item": "Where do you live?"' in payload
    assert '"is_last_part": false' in payload
    assert '"script_remaining": 1' in payload
    # next_part info exposed for transition turns
    assert '"next_part"' in payload
    # System prompt has the cursor section
    assert "SCRIPT-PROGRESSION CURSOR" in captured["system"]


@pytest.mark.asyncio
async def test_examiner_payload_marks_last_part_complete():
    """When the script for the last part is exhausted, payload must show
    is_last_part=true, next_script_item=null, next_part=null — the
    signals the LLM uses to emit [[SESSION_END]].
    """
    captured: dict[str, str] = {}

    async def fake_llm(*, system_prompt: str, user_payload: str, **_kwargs):
        captured["user"] = user_payload
        return "Thank you. [[SESSION_END]]"

    with patch("app.agents.speaking_examiner._run_llm", new=fake_llm):
        out = await run_examiner_turn(
            prompts=_ket_prompts(),
            history=[{"role": "user", "content": "yes I enjoyed that"}],
            current_part=2,
            current_part_question_count=1,  # part 2 has 1 script item, exhausted
        )
    payload = captured["user"]
    assert '"is_last_part": true' in payload
    assert '"next_script_item": null' in payload
    assert '"next_part": null' in payload
    assert '"script_remaining": 0' in payload
    assert out.sessionEnd is True
