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

from app.schemas.listening import ListeningTestResponse
from app.schemas.reading import ReadingTestResponse
from app.schemas.speaking import SpeakingPrompts
from app.schemas.writing import WritingTestResponse

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
    """Request shape for the diagnose generation orchestrator.

    Note on `sections`: services/ai's orchestrator only generates the 4
    AI-backed sections (READING/LISTENING/WRITING/SPEAKING). Vocab and
    Grammar are bank-sampled in apps/web (T18 generate route), NOT here.
    The default reflects this — even if a caller passes VOCAB/GRAMMAR
    in the list, the orchestrator ignores them.
    """

    exam_type: Literal["KET", "PET"]
    week_start: str  # ISO 8601 date YYYY-MM-DD
    focus_areas: list[FocusArea] = Field(default_factory=list)  # empty in cold start
    # Sections requested. Default is the 4 AI-generated sections.
    # The orchestrator silently ignores VOCAB/GRAMMAR if present (those
    # come from bank-sampling in apps/web).
    sections: list[DiagnoseSectionKind] = Field(
        default_factory=lambda: [
            "READING",
            "LISTENING",
            "WRITING",
            "SPEAKING",
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
    """Full sections payload — what eventually lands in `Test.payload.sections`
    after apps/web composes the AI-generated half (this services/ai orchestrator)
    with the bank-sampled half (vocab + grammar)."""

    READING: DiagnoseReadingContent
    LISTENING: DiagnoseListeningContent
    WRITING: DiagnoseWritingContent
    SPEAKING: DiagnoseSpeakingContent
    VOCAB: DiagnoseVocabContent
    GRAMMAR: DiagnoseGrammarContent


# ─── Orchestrator output shape (services/ai → apps/web) ──────────────
#
# This is what `agents/diagnose_generator.generate_diagnose_test()` returns.
# It carries the raw outputs of the four per-kind generators so apps/web
# can extract everything it needs (e.g., speaking prompts/persona/photoKeys
# for `Test.speakingPrompts`/`Test.speakingPersona`/`Test.speakingPhotoKeys`,
# listening audio_script for Edge-TTS rendering, etc.).
#
# apps/web later adapts these into `Test.payload.sections.<KIND>` shapes
# (DiagnoseReadingContent, DiagnoseListeningContent, etc.) and merges with
# bank-sampled vocab + grammar to produce the final DiagnoseGenerateResponse.

class DiagnoseAIGenerateResponse(BaseModel):
    """Response shape returned by the services/ai diagnose orchestrator.

    Carries ONLY the 4 AI-generated sections — Reading, Listening, Writing,
    Speaking. Each field holds the FULL raw output from the corresponding
    per-kind generator (no truncation/adaptation here — that happens in
    apps/web's T18 generate route, which composes this with bank-sampled
    vocab + grammar to produce the full `Test.payload`).

    Field naming: lowercase to flag these as "raw generator outputs"
    distinct from the uppercase section-key shapes in DiagnoseGenerateResponse
    that match `Test.payload.sections.<KIND>`.

    Why services/ai stays stateless: vocab + grammar bank-sampling needs
    Postgres access (the Cambridge wordlist + grammar topic tables live in
    apps/web's database). Keeping that work in apps/web means services/ai
    has no DB dep — it remains a pure AI generation/grading service.
    """

    reading: ReadingTestResponse
    listening: ListeningTestResponse
    writing: WritingTestResponse
    speaking: SpeakingPrompts


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
