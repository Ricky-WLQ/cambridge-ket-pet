import pytest

from app.validators.speaking import (
    parse_examiner_output,
    enforce_reply_caps,
    SentinelParseError,
)


class TestParseExaminerOutput:
    def test_plain_reply_no_sentinels(self):
        raw = "Nice to meet you. Where do you live?"
        parsed = parse_examiner_output(raw, current_part=1, last_part=2)
        assert parsed.reply == raw
        assert parsed.advancePart is None
        assert parsed.sessionEnd is False

    def test_advance_part_sentinel(self):
        raw = "Great. [[PART:2]] Now, let's look at a photo."
        parsed = parse_examiner_output(raw, current_part=1, last_part=2)
        assert parsed.advancePart == 2
        assert "[[PART:2]]" not in parsed.reply
        assert parsed.reply == "Great. Now, let's look at a photo."
        assert parsed.sessionEnd is False

    def test_session_end_sentinel(self):
        raw = "Thank you, that's the end of the test. [[SESSION_END]]"
        parsed = parse_examiner_output(raw, current_part=2, last_part=2)
        assert parsed.sessionEnd is True
        assert "[[SESSION_END]]" not in parsed.reply

    def test_both_sentinels_same_turn(self):
        raw = "[[PART:2]] That's all, thank you. [[SESSION_END]]"
        parsed = parse_examiner_output(raw, current_part=1, last_part=2)
        assert parsed.advancePart == 2
        assert parsed.sessionEnd is True
        assert parsed.reply.strip() == "That's all, thank you."

    def test_rejects_advance_part_beyond_last(self):
        with pytest.raises(SentinelParseError):
            parse_examiner_output("[[PART:7]] ok", current_part=1, last_part=2)

    def test_rejects_advance_part_not_monotonic(self):
        with pytest.raises(SentinelParseError):
            parse_examiner_output("[[PART:1]] ok", current_part=2, last_part=2)

    def test_rejects_multiple_advance_part_sentinels(self):
        # Two [[PART:N]] in one reply is a conflict; silently picking one would
        # let the second sentinel leak through to the avatar.
        raw = "[[PART:3]] Good. [[PART:2]] Now photo."
        with pytest.raises(SentinelParseError):
            parse_examiner_output(raw, current_part=1, last_part=4)

    def test_rejects_malformed_advance_part_sentinel(self):
        # Non-digit content must not silently pass through as literal text.
        raw = "Ok [[PART:abc]] continue."
        with pytest.raises(SentinelParseError):
            parse_examiner_output(raw, current_part=1, last_part=2)

    def test_rejects_malformed_advance_part_sentinel_floating_point(self):
        # Decimal Ns are malformed — surface rather than strip partially.
        raw = "[[PART:2.5]] go"
        with pytest.raises(SentinelParseError):
            parse_examiner_output(raw, current_part=1, last_part=2)

    def test_session_end_without_surrounding_whitespace(self):
        # Sentinel wedged between two word chars must not weld them together.
        raw = "Thank[[SESSION_END]]you very much."
        parsed = parse_examiner_output(raw, current_part=2, last_part=2)
        assert parsed.reply == "Thank you very much."
        assert parsed.sessionEnd is True


class TestEnforceReplyCaps:
    def test_under_cap(self):
        assert enforce_reply_caps("Hello there.") == "Hello there."

    def test_truncates_soft_cap(self):
        # ~45 words should be truncated to 40
        text = " ".join([f"word{i}" for i in range(45)])
        out = enforce_reply_caps(text)
        assert len(out.split()) <= 40

    def test_keeps_sentence_boundary_when_possible(self):
        text = "One two three. Four five six. " + " ".join(["word"] * 50) + "."
        out = enforce_reply_caps(text)
        assert len(out.split()) <= 40
        # Should prefer to end at a sentence boundary.
        assert out.endswith(".") or out.endswith("?")
