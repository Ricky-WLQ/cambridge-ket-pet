import pytest
from pydantic import ValidationError
from app.schemas.grammar import (
    GrammarGenerateRequest,
    GrammarGenerateResponse,
    GrammarMCQ,
)


def _valid_mcq(**overrides):
    base = dict(
        question="She _____ in this factory since 2018.",
        options=["works", "worked", "has worked", "will work"],
        correct_index=2,
        explanation_zh="现在完成时。since + 过去时间用 has/have done。",
        difficulty=2,
    )
    base.update(overrides)
    return GrammarMCQ(**base)


def test_request_accepts_valid_payload():
    r = GrammarGenerateRequest(
        examType="KET",
        topicId="present_perfect_simple",
        spec="Present perfect simple: recent past with just/yet/already/never/ever; unfinished past with for/since.",
        examples=["I have lived here for five years."],
        existingQuestions=[],
        count=10,
    )
    assert r.examType == "KET"
    assert r.count == 10


def test_request_rejects_invalid_examType():
    with pytest.raises(ValidationError):
        GrammarGenerateRequest(
            examType="XYZ", topicId="t", spec="s",
            examples=[], existingQuestions=[], count=10,
        )


def test_request_rejects_count_too_high():
    with pytest.raises(ValidationError):
        GrammarGenerateRequest(
            examType="KET", topicId="t", spec="s",
            examples=[], existingQuestions=[], count=100,
        )


def test_mcq_accepts_valid_item():
    item = _valid_mcq()
    assert len(item.options) == 4
    assert item.correct_index == 2


def test_mcq_rejects_wrong_options_count():
    with pytest.raises(ValidationError):
        _valid_mcq(options=["a", "b", "c"])
    with pytest.raises(ValidationError):
        _valid_mcq(options=["a", "b", "c", "d", "e"])


def test_mcq_rejects_correct_index_out_of_range():
    with pytest.raises(ValidationError):
        _valid_mcq(correct_index=4)
    with pytest.raises(ValidationError):
        _valid_mcq(correct_index=-1)


def test_mcq_rejects_non_chinese_explanation():
    with pytest.raises(ValidationError):
        _valid_mcq(explanation_zh="this is just english")


def test_mcq_accepts_difficulty_in_range():
    for d in [1, 2, 3, 4, 5]:
        _valid_mcq(difficulty=d)


def test_mcq_rejects_difficulty_out_of_range():
    with pytest.raises(ValidationError):
        _valid_mcq(difficulty=0)
    with pytest.raises(ValidationError):
        _valid_mcq(difficulty=6)


def test_mcq_rejects_duplicate_options():
    # Direct duplicates rejected.
    with pytest.raises(ValidationError):
        _valid_mcq(options=["works", "works", "has worked", "will work"])
    # Case-insensitive trim normalization — "Works" / "works " duplicates "works".
    with pytest.raises(ValidationError):
        _valid_mcq(options=["works", "Works", "has worked", "will work"])
    with pytest.raises(ValidationError):
        _valid_mcq(options=["works", "works ", "has worked", "will work"])


def test_response_accepts_list_of_mcqs():
    r = GrammarGenerateResponse(questions=[_valid_mcq(), _valid_mcq(question="It _____ rain tomorrow.")])
    assert len(r.questions) == 2
