"""Post-LLM guardrails for Phase 3 Speaking — sentinel parsing + reply caps."""

from __future__ import annotations

import re

from pydantic import BaseModel


class SentinelParseError(ValueError):
    pass


class ParsedExaminerOutput(BaseModel):
    reply: str
    advancePart: int | None
    sessionEnd: bool


_PART_RE = re.compile(r"\[\[PART:(\d+)\]\]")
_PART_LOOSE_RE = re.compile(r"\[\[PART:[^\]]*\]\]")
_END_RE = re.compile(r"\[\[SESSION_END\]\]")


def extract_json_object(raw: str) -> str:
    """Extract the first balanced JSON object from a model response.

    Tolerates:
    - markdown code fences (```json ... ``` or ``` ... ```)
    - trailing characters/extra braces after the matched closing `}` (DeepSeek
      occasionally emits one extra `}` after a structured-output response)
    - leading/trailing whitespace

    Returns the substring containing exactly one balanced `{...}`. Raises
    ValueError if no balanced object is found.
    """
    s = raw.strip()
    # Strip markdown fence wrapping if present.
    if s.startswith("```"):
        nl = s.find("\n")
        if nl > 0:
            s = s[nl + 1 :]
        if s.endswith("```"):
            s = s[:-3]
        s = s.strip()

    start = s.find("{")
    if start < 0:
        raise ValueError("no `{` found in model output")

    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(s)):
        ch = s[i]
        if escape:
            escape = False
            continue
        if ch == "\\":
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return s[start : i + 1]

    raise ValueError("unbalanced JSON: no matching `}` for opening `{`")


def parse_examiner_output(raw: str, *, current_part: int, last_part: int) -> ParsedExaminerOutput:
    """Extract [[PART:N]] + [[SESSION_END]] sentinels; return cleaned reply + flags."""
    loose_tokens = _PART_LOOSE_RE.findall(raw)
    strict_matches = _PART_RE.findall(raw)

    # Fix 2: any loose match that isn't also a strict match is malformed —
    # surface it rather than silently leaking the sentinel into the avatar's speech.
    if len(loose_tokens) != len(strict_matches):
        bad = next(t for t in loose_tokens if not _PART_RE.fullmatch(t))
        raise SentinelParseError(f"malformed [[PART:…]] sentinel: {bad}")

    # Fix 1: more than one valid sentinel in a single reply is a conflict — reject.
    if len(strict_matches) > 1:
        raise SentinelParseError(
            f"multiple [[PART:N]] sentinels in one reply: {strict_matches}"
        )

    advance_part: int | None = None
    if strict_matches:
        n = int(strict_matches[0])
        if n <= current_part:
            raise SentinelParseError(
                f"[[PART:{n}]] is not ahead of current part {current_part}"
            )
        if n > last_part:
            raise SentinelParseError(
                f"[[PART:{n}]] exceeds last part {last_part}"
            )
        advance_part = n

    session_end = bool(_END_RE.search(raw))

    # Fix 3: substitute a space (not empty) so sentinels adjacent to words don't
    # weld tokens together (e.g. "Thank[[SESSION_END]]you" → "Thank you"). The
    # \s{2,} collapse below normalises any double spaces the substitution creates.
    cleaned = _PART_RE.sub(" ", raw)
    cleaned = _END_RE.sub(" ", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()

    if not cleaned:
        raise SentinelParseError("reply was empty after stripping sentinels")

    return ParsedExaminerOutput(
        reply=cleaned, advancePart=advance_part, sessionEnd=session_end
    )


def enforce_reply_caps(text: str, *, soft_words: int = 40, hard_words: int = 60) -> str:
    """Clamp the reply length without leaking mid-sentence cuts when avoidable.

    Strategy: if the reply is already at or under the soft cap, return it as-is.
    If it's over the soft cap, prefer to cut at the last sentence boundary that
    keeps us within the soft limit; if no such boundary exists, word-truncate
    at the hard cap and append an ellipsis.
    """
    words = text.split()
    if len(words) <= soft_words:
        return text.strip()

    # Sentence-boundary search up to soft_words worth of tokens.
    # Build cumulative word indices by scanning the original string.
    accumulated: list[tuple[int, int]] = []  # (word_count_at_end_of_sentence, char_index)
    word_count = 0
    last_sentence_end_char = -1
    for i, ch in enumerate(text):
        if ch in ".!?":
            # Count words up to and including this char.
            prefix = text[: i + 1]
            word_count = len(prefix.split())
            last_sentence_end_char = i
            accumulated.append((word_count, i))

    for wc, ci in reversed(accumulated):
        if wc <= soft_words:
            return text[: ci + 1].strip()

    # No sentence boundary fits — truncate at the soft cap.
    # (hard_words is retained as the Pydantic-side ceiling; this fallback
    # clamps to soft_words so callers never emit replies above the target.)
    truncated = " ".join(words[:soft_words]).rstrip(".,; ") + "…"
    return truncated
