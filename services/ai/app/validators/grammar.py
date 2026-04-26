"""Post-generation validators for the grammar_generator agent.

Each validator raises ValueError on bad output. The agent's retry loop
catches and retries up to 3 times (matches Phase 2/3 + Slice 4a pattern).

Schema-level checks (4 options exactly, distinct options, CJK explanation,
correct_index 0..3, difficulty 1..5) fire during GrammarMCQ construction
in app.schemas.grammar — those don't need re-checking here.

This module adds the remaining business-rule validators:
- validate_blank_count: exactly one "_____" OR no blank (usage MCQ)
- validate_not_classification_question: reject "Which of the following is a verb?"
- validate_vocab_in_level: cross-ref question + options against allowed wordlist
  (caller passes None to skip — used during seeding when the wordlist hasn't
  been pre-loaded)
- validate_not_duplicate: reject exact-text matches against existingQuestions

The "distractors share POS family" heuristic (spec §7.5 #7) is intentionally
NOT implemented — automated POS-family detection is unreliable and pretco's
empirical experience showed manual QA-rating is more useful. See spec §7.8
"distractor quality" — sample 50 generated questions, manually rate ≥80%.
"""
import re
from app.schemas.grammar import GrammarMCQ


_BLANK = "_____"


def validate_blank_count(item: GrammarMCQ) -> None:
    """Question must contain exactly one '_____' blank OR none (usage MCQ).
    Two or more blanks is a malformed item."""
    n = item.question.count(_BLANK)
    if n > 1:
        raise ValueError(f"question must contain exactly one '{_BLANK}' blank or none, got {n}")


_CLASSIFICATION_PATTERNS = [
    re.compile(r"\bwhich (of the following|option|sentence|word|answer)\s+(is|are)\s+(a|an|the)?\s*(verb|noun|adjective|adverb|pronoun|preposition|conjunction|determiner|article)\b", re.I),
    re.compile(r"\bidentify the\s+(verb|noun|adjective|adverb|pronoun|preposition|conjunction|determiner|article)\b", re.I),
    re.compile(r"\bwhat\s+(part of speech|word class)\b", re.I),
]


def validate_not_classification_question(item: GrammarMCQ) -> None:
    """Reject 'Which of the following is a verb?' style metalinguistic
    questions — they're trivially solvable from option shape and don't
    test grammatical competence."""
    for pat in _CLASSIFICATION_PATTERNS:
        if pat.search(item.question):
            raise ValueError(
                f"item looks like a classification question (pattern: {pat.pattern!r}); "
                f"reject and regenerate as a usage MCQ"
            )


_WORD_RE = re.compile(r"[A-Za-z']+")


def _tokens(text: str) -> list[str]:
    return [t.lower() for t in _WORD_RE.findall(text)]


def validate_vocab_in_level(item: GrammarMCQ, wordlist: set[str] | None) -> None:
    """Cross-reference every alphabetic token in question + options against
    the passed wordlist set. Pass None to skip (used during seeding when the
    wordlist isn't loaded).

    Tokens are lowercased; the wordlist must also be lowercased lemma forms.
    Common closed-class words ('a', 'an', 'the', 'to', 'of', etc.) and the
    blank marker are always allowed.
    """
    if wordlist is None:
        return
    tokens = _tokens(item.question)
    for opt in item.options:
        tokens.extend(_tokens(opt))
    closed_class = {
        "a", "an", "the", "to", "of", "in", "on", "at", "for", "with", "by",
        "and", "or", "but", "is", "are", "was", "were", "be", "been", "being",
        "do", "does", "did", "have", "has", "had",
        "i", "you", "he", "she", "it", "we", "they",
        "my", "your", "his", "her", "its", "our", "their",
        "me", "him", "us", "them",
        "this", "that", "these", "those",
        "not", "no",
    }
    unknown = [t for t in set(tokens) if t and t not in closed_class and t not in wordlist]
    if unknown:
        raise ValueError(
            f"vocabulary not in level wordlist (first 10): {sorted(unknown)[:10]}; "
            f"regenerate using simpler vocabulary"
        )


def validate_not_duplicate(item: GrammarMCQ, existing: list[str]) -> None:
    """Reject items whose question text exactly matches an existing question
    (case-insensitive trim). Avoids generator repetition across runs."""
    norm = item.question.strip().lower()
    for ex in existing:
        if ex.strip().lower() == norm:
            raise ValueError(f"duplicate question already in bank: {item.question!r}")
