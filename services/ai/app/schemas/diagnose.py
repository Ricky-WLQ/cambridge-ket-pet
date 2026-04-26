"""Pydantic schemas for the Diagnose v2 weekly diagnose feature.

Mirror of apps/web/src/lib/diagnose/types.ts — keep in sync.

Manual mirroring rule (per types.ts:14-18):
  - The TS types are camelCase; the Python schemas use snake_case (Python
    convention). Field names are mapped manually — there is no codegen — so
    when you change one, change the other in the same commit.

Adaptation note (vs pretco-app):
  - The 8-category knowledge-point taxonomy comes from the pretco-app
    diagnostic report. We replaced ``translation_skill`` with
    ``cambridge_strategy`` because Cambridge KET/PET papers contain no
    translation task; the slot is reused for exam-strategy guidance
    (timing, skimming, distractor avoidance, answer-sheet discipline).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# ─── Common ──────────────────────────────────────────────────────────

DiagnoseSectionKind = Literal[
    "READING", "LISTENING", "WRITING", "SPEAKING", "VOCAB", "GRAMMAR"
]

KnowledgePointCategory = Literal[
    "grammar",
    "collocation",
    "vocabulary",
    "sentence_pattern",
    "reading_skill",
    "listening_skill",
    "cambridge_strategy",  # replaces pretco's translation_skill (KET/PET has no translation paper)
    "writing_skill",
]

KnowledgePointSeverity = Literal["critical", "moderate", "minor"]


class KnowledgePointQuestion(BaseModel):
    section: DiagnoseSectionKind
    question_text: str
    user_answer: str
    correct_answer: str
    why_wrong: str
    rule: str


class KnowledgePointGroup(BaseModel):
    knowledge_point: str
    category: KnowledgePointCategory
    mini_lesson: str
    rule: str
    example_sentences: list[str]
    questions: list[KnowledgePointQuestion]
    # AI-supplied; the validator only checks it is a valid enum value. TS
    # recomputes and overwrites severity post-AI based on questions.length
    # (see types.ts:45-48 for the threshold rule), so the AI's choice here
    # is informational only — the TS layer is the source of truth.
    severity: KnowledgePointSeverity


class WrongAnswer(BaseModel):
    section: DiagnoseSectionKind
    question_text: str
    user_answer: str
    correct_answer: str
    options: list[str] | None = None  # only for MCQ sections


# ─── /v1/diagnose/generate request/response ──────────────────────────
#
# Callers wanting "the sections payload shape" should import
# ``DiagnoseGenerateResponse`` directly. There is no separate "sections"
# class — the response IS the sections map (one field per section kind).

class FocusArea(BaseModel):
    """A weak area carried forward from last week's wrong-answer analysis."""

    exam_point_id: str
    wrong_count: int = Field(ge=1)


class DiagnoseGenerateRequest(BaseModel):
    exam_type: Literal["KET", "PET"]
    week_start: str  # ISO 8601 date YYYY-MM-DD
    focus_areas: list[FocusArea] = Field(default_factory=list)  # empty in cold start
    # Sections requested (always all 6 in v1, but field is here for future flexibility)
    sections: list[DiagnoseSectionKind] = Field(
        default_factory=lambda: [
            "READING",
            "LISTENING",
            "WRITING",
            "SPEAKING",
            "VOCAB",
            "GRAMMAR",
        ]
    )


# Per-section content shapes (snake_case to match Python convention).
# These mirror TS's DiagnoseReadingContent etc.

class DiagnoseReadingQuestion(BaseModel):
    id: str
    text: str
    options: list[str]
    correct_index: int
    exam_point_id: str | None = None


class DiagnoseReadingContent(BaseModel):
    passage: str | None
    questions: list[DiagnoseReadingQuestion]
    time_limit_sec: Literal[480] = 480


class DiagnoseListeningQuestion(BaseModel):
    id: str
    text: str
    options: list[str]
    correct_index: int


class DiagnoseListeningPart(BaseModel):
    part_number: int
    part_type: str
    audio_start_sec: float
    audio_end_sec: float
    questions: list[DiagnoseListeningQuestion]


class DiagnoseListeningContent(BaseModel):
    parts: list[DiagnoseListeningPart]
    time_limit_sec: Literal[600] = 600
    # NOTE: audio_r2_key + audio_status do NOT live here — they live on the Test row directly.


class DiagnoseWritingContent(BaseModel):
    task_type: Literal["EMAIL", "STORY", "ARTICLE", "MESSAGE"]
    prompt: str
    content_points: list[str]
    min_words: int = Field(ge=1)
    time_limit_sec: Literal[900] = 900


class DiagnoseSpeakingContent(BaseModel):
    """Speaking section content. Note: prompts/photo_keys/persona/initial_greeting
    live on the Test row's speaking_prompts/speaking_photo_keys/speaking_persona
    columns directly — NOT in payload.sections.SPEAKING. This shape carries
    only what's actually serialized into payload.sections.SPEAKING.
    """

    time_limit_sec: Literal[300] = 300


class VocabItem(BaseModel):
    word_id: str
    word: str
    fill_pattern: str
    gloss_zh: str | None = None


class DiagnoseVocabContent(BaseModel):
    items: list[VocabItem]
    time_limit_sec: Literal[240] = 240


class GrammarItem(BaseModel):
    question_id: str
    topic_id: str
    question_text: str
    options: list[str]
    correct_index: int


class DiagnoseGrammarContent(BaseModel):
    questions: list[GrammarItem]
    time_limit_sec: Literal[300] = 300


class DiagnoseGenerateResponse(BaseModel):
    READING: DiagnoseReadingContent
    LISTENING: DiagnoseListeningContent
    WRITING: DiagnoseWritingContent
    SPEAKING: DiagnoseSpeakingContent
    VOCAB: DiagnoseVocabContent
    GRAMMAR: DiagnoseGrammarContent


# ─── /v1/diagnose/analysis request/response ──────────────────────────

class DiagnoseAnalysisRequest(BaseModel):
    exam_type: Literal["KET", "PET"]
    wrong_answers: list[WrongAnswer] = Field(default_factory=list, max_length=40)


class DiagnoseAnalysisResponse(BaseModel):
    knowledge_points: list[KnowledgePointGroup] = Field(default_factory=list)


# ─── /v1/diagnose/summary request/response ───────────────────────────

class PerSectionScores(BaseModel):
    READING: float | None = None
    LISTENING: float | None = None
    WRITING: float | None = None
    SPEAKING: float | None = None
    VOCAB: float | None = None
    GRAMMAR: float | None = None


class DiagnoseSummaryRequest(BaseModel):
    exam_type: Literal["KET", "PET"]
    week_start: str
    week_end: str
    per_section_scores: PerSectionScores
    overall_score: float
    knowledge_points: list[KnowledgePointGroup] = Field(default_factory=list)
    weak_count: int = Field(ge=0)


class DiagnoseSummaryResponse(BaseModel):
    """Reuses the 4-field shape from analyze_student response (snake_case)."""

    strengths: list[str]
    weaknesses: list[str]
    priority_actions: list[str]
    narrative_zh: str
