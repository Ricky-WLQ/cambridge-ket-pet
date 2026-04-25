import pytest
from app.schemas.vocab import VocabGlossItem, VocabWordInput
from app.validators.vocab import (
    validate_gloss_item,
    validate_response_covers_all_words,
)


def _input(cid: str = "ket-act-v", word: str = "act", pos: str = "v"):
    return VocabWordInput(cambridgeId=cid, word=word, pos=pos, glossEn=None)


def _item(cid: str = "ket-act-v", gloss: str = "表演；行动", ex: str = "She acts in the school play."):
    return VocabGlossItem(cambridgeId=cid, glossZh=gloss, example=ex)


# validate_gloss_item

def test_validate_accepts_valid_item():
    validate_gloss_item(_input(), _item())  # no raise


def test_validate_rejects_example_not_containing_headword():
    bad = _item(ex="The cat sat on the mat.")
    with pytest.raises(ValueError, match="must contain"):
        validate_gloss_item(_input(word="act"), bad)


def test_validate_accepts_inflected_headword_in_example():
    # Cambridge example uses the headword in any inflected form (acts, acting, acted).
    item = _item(ex="She is acting in the school play.")
    validate_gloss_item(_input(word="act"), item)  # no raise


def test_validate_rejects_english_only_gloss():
    # Schema-level CJK check raises during construction — this test pins that behaviour
    # so the validator suite acts as a regression net for the gloss-language guarantee.
    with pytest.raises(Exception):
        VocabGlossItem(cambridgeId="ket-act-v", glossZh="to do", example="She acts.")


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
