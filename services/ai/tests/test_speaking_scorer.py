from unittest.mock import AsyncMock, patch

import pytest

from app.agents.speaking_scorer import score_speaking_attempt
from app.schemas.speaking import SpeakingScore, SpeakingWeakPoint


def _mixed_transcript() -> list[dict]:
    return [
        {"role": "assistant", "content": "Hello, what's your name?", "part": 1},
        {"role": "user", "content": "My name is Li Wei.", "part": 1},
        {"role": "assistant", "content": "Where do you live?", "part": 1},
        {"role": "user", "content": "I live in Beijing. I go to school yesterday.", "part": 1},
        {"role": "assistant", "content": "Thank you. [[SESSION_END]]", "part": 2},
    ]


@pytest.mark.asyncio
async def test_scorer_returns_valid_score():
    fake = SpeakingScore(
        grammarVocab=3,
        discourseManagement=3,
        pronunciation=3,
        interactive=4,
        overall=3.25,
        justification="Range is ok; one past-simple slip.",
        weakPoints=[
            SpeakingWeakPoint(
                tag="grammar.past_simple",
                quote="I go to school yesterday",
                suggestion="went",
            ),
        ],
    )
    with patch("app.agents.speaking_scorer._run_scorer_agent", new=AsyncMock(return_value=fake)):
        out = await score_speaking_attempt(level="KET", transcript=_mixed_transcript())
    assert out.overall == pytest.approx(3.25)
    assert len(out.weakPoints) == 1
    assert out.weakPoints[0].tag == "grammar.past_simple"


@pytest.mark.asyncio
async def test_scorer_handles_empty_student_turns():
    """If the student never spoke, the scorer should still return a valid score with 0s."""
    fake = SpeakingScore(
        grammarVocab=0,
        discourseManagement=0,
        pronunciation=0,
        interactive=0,
        overall=0.0,
        justification="No student speech captured.",
        weakPoints=[],
    )
    transcript = [{"role": "assistant", "content": "Hello, are you there?", "part": 1}]
    with patch("app.agents.speaking_scorer._run_scorer_agent", new=AsyncMock(return_value=fake)):
        out = await score_speaking_attempt(level="KET", transcript=transcript)
    assert out.overall == 0
    assert out.weakPoints == []
