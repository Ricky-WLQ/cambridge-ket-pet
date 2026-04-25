"""Post-generation validators for the vocab_gloss agent.

Each validator raises ValueError on bad output. The Pydantic AI agent
catches these and triggers retry (up to 3 attempts per spec).
"""
import re
from app.schemas.vocab import VocabGlossItem, VocabWordInput


# Letter sequence — ignores apostrophes/hyphens for matching.
_NORMALIZE_RE = re.compile(r"[^a-z]")


def _normalize(s: str) -> str:
    return _NORMALIZE_RE.sub("", s.lower())


def _example_contains_word(example: str, headword: str) -> bool:
    """True if the example sentence contains the headword (any inflected form).

    We strip non-letters, lowercase, then check if the normalized headword
    is a substring of any normalized whitespace-separated token. This catches
    'act' inside 'acts', 'acted', 'acting', 'actor'.
    """
    h = _normalize(headword)
    if not h:
        return False
    tokens = [_normalize(t) for t in example.split()]
    return any(h in tok for tok in tokens)


def validate_gloss_item(input_word: VocabWordInput, item: VocabGlossItem) -> None:
    """Validate one (input, item) pair. Raises ValueError on rejection."""
    if not _example_contains_word(item.example, input_word.word):
        raise ValueError(
            f"example for {input_word.word!r} must contain the headword "
            f"(or an inflected form): got {item.example!r}",
        )


def validate_response_covers_all_words(
    inputs: list[VocabWordInput],
    items: list[VocabGlossItem],
) -> None:
    """Every input.cambridgeId must appear in items. Raises ValueError on gap."""
    have = {it.cambridgeId for it in items}
    missing = [w.cambridgeId for w in inputs if w.cambridgeId not in have]
    if missing:
        raise ValueError(
            f"response missing {len(missing)} of {len(inputs)} requested words: "
            f"first few: {missing[:5]}",
        )
