import pytest
from app.schemas.grammar import GrammarMCQ
from app.validators.grammar import (
    validate_blank_count,
    validate_not_classification_question,
    validate_vocab_in_level,
    validate_not_duplicate,
)


def _mcq(**overrides):
    base = dict(
        question="She _____ in this factory since 2018.",
        options=["works", "worked", "has worked", "will work"],
        correct_index=2,
        explanation_zh="现在完成时。",
        difficulty=2,
    )
    base.update(overrides)
    return GrammarMCQ(**base)


# validate_blank_count

def test_blank_count_accepts_one_blank():
    validate_blank_count(_mcq())


def test_blank_count_accepts_zero_blanks_for_usage_mcq():
    # Usage MCQ — full sentence, ask which is correct.
    validate_blank_count(_mcq(question="Which sentence is grammatically correct?"))


def test_blank_count_rejects_two_or_more_blanks():
    with pytest.raises(ValueError, match="exactly one"):
        validate_blank_count(_mcq(question="She _____ in this factory _____ 2018."))


# validate_not_classification_question

def test_not_classification_accepts_normal_question():
    validate_not_classification_question(_mcq())


def test_not_classification_rejects_grammar_lookup():
    with pytest.raises(ValueError, match="classification"):
        validate_not_classification_question(_mcq(question="Which of the following is a verb?"))


def test_not_classification_rejects_part_of_speech_lookup():
    with pytest.raises(ValueError, match="classification"):
        validate_not_classification_question(_mcq(question="Which option is an adverb?"))


# validate_vocab_in_level

def test_vocab_in_level_accepts_when_all_words_in_set():
    validate_vocab_in_level(_mcq(), {"she", "in", "this", "factory", "since", "works", "worked", "has", "will", "work"})


def test_vocab_in_level_rejects_unknown_word():
    with pytest.raises(ValueError, match="not in level wordlist"):
        validate_vocab_in_level(
            _mcq(question="The factory ____ unprecedented changes since 2018."),
            {"the", "factory", "since"},  # "unprecedented" + "changes" missing
        )


def test_vocab_in_level_skipped_when_wordlist_is_None():
    """Passing None as wordlist disables the check."""
    validate_vocab_in_level(_mcq(), None)


# validate_not_duplicate

def test_not_duplicate_accepts_when_existing_empty():
    validate_not_duplicate(_mcq(), [])


def test_not_duplicate_rejects_exact_match():
    existing = ["She _____ in this factory since 2018."]
    with pytest.raises(ValueError, match="duplicate"):
        validate_not_duplicate(_mcq(), existing)


def test_not_duplicate_accepts_paraphrased():
    existing = ["He _____ in this office since 2020."]
    validate_not_duplicate(_mcq(), existing)
