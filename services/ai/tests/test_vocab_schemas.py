import pytest
from pydantic import ValidationError
from app.schemas.vocab import VocabGlossRequest, VocabGlossItem, VocabGlossResponse


def test_request_accepts_valid_payload():
    r = VocabGlossRequest(
        examType="KET",
        words=[
            {"cambridgeId": "ket-act-v", "word": "act", "pos": "v", "glossEn": None},
        ],
    )
    assert r.examType == "KET"
    assert len(r.words) == 1


def test_request_rejects_invalid_examType():
    with pytest.raises(ValidationError):
        VocabGlossRequest(examType="XYZ", words=[])


def test_request_rejects_too_many_words_in_one_batch():
    too_many = [
        {"cambridgeId": f"w{i}", "word": "x", "pos": "n", "glossEn": None}
        for i in range(101)
    ]
    with pytest.raises(ValidationError):
        VocabGlossRequest(examType="KET", words=too_many)


def test_response_item_requires_chinese_gloss_and_example():
    item = VocabGlossItem(
        cambridgeId="ket-act-v",
        glossZh="表演；行动",
        example="She acts in the school play.",
    )
    assert item.glossZh == "表演；行动"


def test_response_item_rejects_empty_gloss():
    with pytest.raises(ValidationError):
        VocabGlossItem(cambridgeId="ket-act-v", glossZh="", example="x")
