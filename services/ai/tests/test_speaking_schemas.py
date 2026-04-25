import pytest
from pydantic import ValidationError

from app.schemas.speaking import (
    SpeakingPrompts,
    SpeakingPromptPart,
    SpeakingTurn,
    SpeakingExaminerReply,
    SpeakingScore,
    SpeakingWeakPoint,
)


def _valid_part(partNumber: int = 1, photoKey: str | None = None) -> dict:
    return {
        "partNumber": partNumber,
        "title": "Interview",
        "targetMinutes": 2,
        "examinerScript": ["What's your name?", "Where do you live?"],
        "coachingHints": "Encourage full sentences.",
        "photoKey": photoKey,
    }


class TestSpeakingPrompts:
    def test_happy_path(self):
        p = SpeakingPrompts(
            level="KET",
            initialGreeting="Hello, I'm Mina.",
            parts=[_valid_part(1), _valid_part(2, photoKey="speaking/photos/park-01.jpg")],
        )
        assert p.level == "KET"
        assert len(p.parts) == 2
        assert p.parts[1].photoKey == "speaking/photos/park-01.jpg"

    def test_rejects_unknown_level(self):
        with pytest.raises(ValidationError):
            SpeakingPrompts(level="IELTS", initialGreeting="Hi", parts=[_valid_part()])

    def test_rejects_empty_parts(self):
        with pytest.raises(ValidationError):
            SpeakingPrompts(level="KET", initialGreeting="Hi", parts=[])

    def test_rejects_empty_examiner_script(self):
        bad = _valid_part()
        bad["examinerScript"] = []
        with pytest.raises(ValidationError):
            SpeakingPrompts(level="KET", initialGreeting="Hi", parts=[bad])


class TestSpeakingTurn:
    def test_user_turn(self):
        t = SpeakingTurn(role="user", content="My name is Li Wei.", part=1)
        assert t.role == "user"

    def test_rejects_unknown_role(self):
        with pytest.raises(ValidationError):
            SpeakingTurn(role="system", content="x", part=1)


class TestSpeakingExaminerReply:
    def test_happy_path(self):
        r = SpeakingExaminerReply(
            reply="Nice to meet you. Where do you live?",
            advancePart=None,
            sessionEnd=False,
        )
        assert r.sessionEnd is False

    def test_reply_length_enforced(self):
        # 40 words is the cap (spec §12). >40 should fail validation.
        too_long = " ".join(["word"] * 80)
        with pytest.raises(ValidationError):
            SpeakingExaminerReply(reply=too_long, advancePart=None, sessionEnd=False)


class TestSpeakingScore:
    def test_happy_path(self):
        s = SpeakingScore(
            grammarVocab=3,
            discourseManagement=4,
            pronunciation=3,
            interactive=4,
            overall=3.5,
            justification="Good range, some past-tense slips.",
            weakPoints=[
                SpeakingWeakPoint(
                    tag="grammar.past_simple",
                    quote="I go to school yesterday",
                    suggestion="went",
                )
            ],
        )
        assert s.overall == 3.5

    def test_score_bounds_enforced(self):
        with pytest.raises(ValidationError):
            SpeakingScore(
                grammarVocab=6,
                discourseManagement=3,
                pronunciation=3,
                interactive=3,
                overall=3.0,
                justification="x",
                weakPoints=[],
            )
