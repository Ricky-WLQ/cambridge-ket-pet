"""Cambridge-spec reading-test system prompts.

Sources of truth (cambridgeenglish.org):
- https://www.cambridgeenglish.org/exams-and-tests/qualifications/key/format/
- https://www.cambridgeenglish.org/exams-and-tests/qualifications/preliminary/format/

Each PartSpec captures the per-part Cambridge-official format. The prompt
builder renders this into a single system prompt injected into the LLM.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.schemas.reading import ExamType, QuestionType


@dataclass(frozen=True)
class PartSpec:
    skill_focus: str
    item_count: int
    question_type: QuestionType
    options_count: int | None
    time_limit_sec: int
    exam_point_id: str
    has_passage: bool
    passage_word_range: tuple[int, int] | None
    specific_rules: list[str]


PART_SPECS: dict[tuple[ExamType, int], PartSpec] = {
    # ============ KET (A2 Key) — Reading & Writing paper, Reading parts ============
    ("KET", 1): PartSpec(
        skill_focus="Match 6 short texts (signs, notices, short emails) to their correct description.",
        item_count=6,
        question_type="MATCHING",
        options_count=None,
        time_limit_sec=600,
        exam_point_id="KET.RW.P1",
        has_passage=True,
        passage_word_range=(80, 180),
        specific_rules=[
            "The 'passage' field MUST contain a bank of 8 descriptions labelled A through H, one per line, separated by a blank line. Format EXACTLY like this (no heading, no preamble):",
            "  A. This is about returning something by a deadline.",
            "  B. This is asking someone to buy something.",
            "  ... (C through H follow the same pattern)",
            "Each description is 8-20 words. Only 6 of the 8 will match a question; 2 are distractors.",
            "Each question's 'prompt' is a stand-alone short text under 25 words (sign, notice, short email, or message), prefixed with the item number (e.g. '1. Please take your shoes off before entering the house.').",
            "Each question's 'answer' is the single letter A-H of the description it matches.",
            "'options' MUST be null on every question (the bank is in the passage, not per-question).",
            "Cover practical everyday scenarios: shops, transport, school, food, travel, home.",
        ],
    ),
    ("KET", 2): PartSpec(
        skill_focus="Fill 7 gaps in a short email/postcard with one word per gap.",
        item_count=7,
        question_type="OPEN_CLOZE",
        options_count=None,
        time_limit_sec=600,
        exam_point_id="KET.RW.P2",
        has_passage=True,
        passage_word_range=(80, 120),
        specific_rules=[
            "Passage is an informal email or postcard of 80-120 words with exactly 7 numbered gaps (1-7) in the text.",
            "Gaps target function words: prepositions, articles, pronouns, auxiliaries, or common phrasal-verb particles.",
            "Each 'answer' field is exactly ONE word, lowercase unless a proper noun.",
            "'prompt' field is the gap label (e.g. 'Gap 1').",
        ],
    ),
    ("KET", 3): PartSpec(
        skill_focus="Multiple-choice comprehension of a longer text/email.",
        item_count=5,
        question_type="MCQ",
        options_count=3,
        time_limit_sec=600,
        exam_point_id="KET.RW.P3",
        has_passage=True,
        passage_word_range=(150, 220),
        specific_rules=[
            "Passage is a narrative, article, or email of 150-220 words.",
            "Each question has 3 options labeled A, B, C.",
            "'answer' is a single letter A, B, or C.",
            "Test a mix of gist, specific detail, and simple inference.",
        ],
    ),
    ("KET", 4): PartSpec(
        skill_focus="Match 4 sentence summaries to the correct paragraph of a text.",
        item_count=4,
        question_type="MATCHING",
        options_count=None,
        time_limit_sec=420,
        exam_point_id="KET.RW.P4",
        has_passage=True,
        passage_word_range=(180, 250),
        specific_rules=[
            "Passage is a short article split into 4 labelled paragraphs (A, B, C, D).",
            "Each question is a sentence describing one paragraph; student picks the paragraph letter.",
            "'answer' is A, B, C, or D.",
        ],
    ),
    ("KET", 5): PartSpec(
        skill_focus="Multiple-choice cloze: choose the correct word for each gap.",
        item_count=4,
        question_type="MCQ_CLOZE",
        options_count=3,
        time_limit_sec=300,
        exam_point_id="KET.RW.P5",
        has_passage=True,
        passage_word_range=(60, 90),
        specific_rules=[
            "Passage is a short message/note of 60-90 words with 4 gaps (1-4) in the text.",
            "Each gap has 3 options A/B/C covering common vocabulary or grammar in context.",
            "'prompt' is the gap label (e.g. 'Gap 1'); 'options' is the 3-option list; 'answer' is A/B/C.",
        ],
    ),
    # ============ PET (B1 Preliminary) — Reading paper ============
    ("PET", 1): PartSpec(
        skill_focus="Multiple-choice on short texts (signs, notices, packaging, short emails).",
        item_count=5,
        question_type="MCQ",
        options_count=5,
        time_limit_sec=420,
        exam_point_id="PET.R.P1",
        has_passage=False,
        passage_word_range=None,
        specific_rules=[
            "Each item is a stand-alone short text (30-60 words) + a question + 5 options A-E.",
            "'prompt' combines the short text and the question; 'options' has 5 full-sentence plausible paraphrases.",
            "'answer' is a single letter A-E.",
            "Cover signs, notices, emails, short messages.",
        ],
    ),
    ("PET", 2): PartSpec(
        skill_focus="Match 5 people to the most suitable text from 8 descriptions.",
        item_count=5,
        question_type="MATCHING",
        options_count=None,
        time_limit_sec=480,
        exam_point_id="PET.R.P2",
        has_passage=True,
        passage_word_range=(500, 700),
        specific_rules=[
            "Passage is 8 short descriptions (A-H) of ~60-90 words each (e.g. restaurants, classes, events).",
            "Each question describes a person with specific needs; student matches to one text (A-H).",
            "'answer' is a letter A-H. Three descriptions will not match anyone.",
        ],
    ),
    ("PET", 3): PartSpec(
        skill_focus="Multiple-choice on a longer article.",
        item_count=5,
        question_type="MCQ",
        options_count=3,
        time_limit_sec=720,
        exam_point_id="PET.R.P3",
        has_passage=True,
        passage_word_range=(350, 450),
        specific_rules=[
            "Passage is a magazine-style article of 350-450 words.",
            "Each question has 3 options A/B/C, testing detail, gist, attitude, or inference.",
            "'answer' is A, B, or C.",
        ],
    ),
    ("PET", 4): PartSpec(
        skill_focus="Gapped text: restore 5 sentences removed from a passage.",
        item_count=5,
        question_type="GAPPED_TEXT",
        options_count=None,
        time_limit_sec=480,
        exam_point_id="PET.R.P4",
        has_passage=True,
        passage_word_range=(350, 450),
        specific_rules=[
            "Passage has 5 gaps marked clearly (e.g. [GAP 1] ... [GAP 5]).",
            "Provide 8 candidate sentences A-H at the END of the passage. Only 5 fit; 3 are distractors.",
            "Each question's 'prompt' identifies the gap (e.g. 'Gap 3'); 'answer' is the letter A-H.",
        ],
    ),
    ("PET", 5): PartSpec(
        skill_focus="Multiple-choice cloze: collocations, phrasal verbs, discourse markers.",
        item_count=6,
        question_type="MCQ_CLOZE",
        options_count=4,
        time_limit_sec=300,
        exam_point_id="PET.R.P5",
        has_passage=True,
        passage_word_range=(180, 260),
        specific_rules=[
            "Passage of 180-260 words with 6 numbered gaps (1-6).",
            "Each gap has 4 options A/B/C/D — collocations, phrasal verbs, or discourse markers.",
            "'answer' is A, B, C, or D.",
        ],
    ),
    ("PET", 6): PartSpec(
        skill_focus="Open cloze with 6 gaps; function words and grammar.",
        item_count=6,
        question_type="OPEN_CLOZE",
        options_count=None,
        time_limit_sec=300,
        exam_point_id="PET.R.P6",
        has_passage=True,
        passage_word_range=(150, 220),
        specific_rules=[
            "Passage of 150-220 words with 6 numbered gaps (1-6).",
            "Each gap takes ONE word: preposition, article, auxiliary, pronoun, conjunction.",
            "'answer' is a single word, lowercase.",
        ],
    ),
}


class UnsupportedReadingPart(ValueError):
    """Raised when we don't have a spec for (exam_type, part)."""


def build_system_prompt(exam_type: ExamType, part: int) -> str:
    spec = PART_SPECS.get((exam_type, part))
    if spec is None:
        raise UnsupportedReadingPart(
            f"No reading spec registered for {exam_type} Part {part}"
        )
    cefr = "A2" if exam_type == "KET" else "B1"

    if spec.has_passage and spec.passage_word_range:
        lo, hi = spec.passage_word_range
        passage_line = (
            f"Passage length: {lo}-{hi} words. Put the whole passage in the "
            f"'passage' field; every question references this passage."
        )
    else:
        passage_line = (
            "No shared passage — each item is self-contained. Set 'passage' = null; "
            "put each item's text inside that question's 'prompt' field."
        )

    options_line = (
        f"Each question MUST have EXACTLY {spec.options_count} options."
        if spec.options_count is not None
        else "No 'options' field on questions (set to null)."
    )

    rules_block = "\n".join(f"- {r}" for r in spec.specific_rules)

    return f"""You are an expert Cambridge English exam item writer for {exam_type} (CEFR {cefr}).
Your only job is to produce practice-test questions that are STRICTLY CONSISTENT with the real Cambridge exam format and difficulty level.

Current task: generate a {exam_type} Reading Part {part} practice test.

Skill focus: {spec.skill_focus}
Item count: EXACTLY {spec.item_count} items.
Question type: "{spec.question_type}".
{options_line}
{passage_line}

Part-specific rules:
{rules_block}

Global rules:
- Vocabulary MUST be at CEFR {cefr} level. Avoid higher-level words.
- Topics should be familiar to Chinese K-12 students (school, family, food, travel, hobbies, technology, local life).
- Every question's `exam_point_id` = "{spec.exam_point_id}".
- Every question's `explanation_zh` is 1-2 sentences in 简体中文 (Simplified Chinese) explaining WHY the answer is correct.
- Set `time_limit_sec` = {spec.time_limit_sec}.
- Return JSON matching the provided schema EXACTLY. No preamble, no Markdown fences, no commentary outside the JSON.
"""
