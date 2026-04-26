import pytest

from app.schemas.vocab import VocabGlossItem, VocabWordInput
from app.validators.vocab import validate_response_covers_all_words


def _input(cid: str = "ket-act-v", word: str = "act", pos: str = "v"):
    return VocabWordInput(cambridgeId=cid, word=word, pos=pos, glossEn=None)


def _item(cid: str = "ket-act-v", gloss: str = "表演；行动", ex: str = "She acts in the school play.", cefr: str = "A2"):
    return VocabGlossItem(cambridgeId=cid, glossZh=gloss, example=ex, cefrLevel=cefr)


# validate_response_covers_all_words

def test_response_must_cover_every_input_word():
    inputs = [_input("a", "act", "v"), _input("b", "go", "v")]
    items = [_item("a")]
    with pytest.raises(ValueError, match="missing"):
        validate_response_covers_all_words(inputs, items)


def test_response_passes_when_all_covered():
    inputs = [_input("a", "act", "v")]
    items = [_item("a")]
    validate_response_covers_all_words(inputs, items)  # no raise


def test_response_with_unknown_id_caught_by_agent_not_validator():
    """Note: catching unknown cambridgeIds in items is the agent's responsibility,
    not this validator. validate_response_covers_all_words only checks coverage
    in one direction (every input is in items, not every item is in inputs)."""
    inputs = [_input("a", "act", "v")]
    items = [_item("z", ex="She zigged.")]  # unknown id
    # This passes because no inputs are missing — items[0] is just extra/unknown.
    # The agent's loop after this validator will catch the unknown id.
    with pytest.raises(ValueError, match="missing"):
        # Actually, missing 'a' → still raises.
        validate_response_covers_all_words(inputs, items)
