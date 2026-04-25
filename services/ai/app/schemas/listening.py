"""Pydantic schemas for Phase 2 listening generation.

Mirror of apps/web/src/lib/audio/types.ts — keep in sync.
Version 2 of the Test.payload shape for LISTENING kind.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

VoiceTag = Literal["proctor", "S1_male", "S2_female_A", "S2_female_B"]

AudioSegmentKind = Literal[
    "rubric",
    "part_intro",
    "preview_pause",
    "scenario_prompt",
    "question_stimulus",
    "question_number",
    "repeat_cue",
    "pause",
    "part_end",
    "transfer_start",
    "transfer_one_min",
    "closing",
    "example",
]

PlayRule = Literal["PER_ITEM", "PER_PART"]

QuestionType = Literal[
    "MCQ_3_PICTURE",
    "GAP_FILL_OPEN",
    "MCQ_3_TEXT",
    "MCQ_3_TEXT_SCENARIO",
    "MATCHING_5_TO_8",
    "MCQ_3_TEXT_DIALOGUE",
    "MCQ_3_TEXT_INTERVIEW",
]


class AudioSegment(BaseModel):
    id: str
    kind: AudioSegmentKind
    voice_tag: VoiceTag | None = None
    text: str | None = None
    duration_ms: int | None = None
    part_number: int | None = None
    question_id: str | None = None


class ListeningOption(BaseModel):
    id: str
    text: str | None = None
    image_description: str | None = None


class ListeningQuestion(BaseModel):
    id: str
    prompt: str
    type: QuestionType
    options: list[ListeningOption] | None = None
    answer: str
    explanation_zh: str
    exam_point_id: str
    difficulty_point_id: str | None = None


class ListeningPart(BaseModel):
    part_number: int
    kind: QuestionType
    instruction_zh: str
    preview_sec: int
    play_rule: PlayRule
    audio_script: list[AudioSegment]
    questions: list[ListeningQuestion]


class ListeningTestResponse(BaseModel):
    version: Literal[2] = 2
    exam_type: Literal["KET", "PET"]
    scope: Literal["FULL", "PART"]
    part: int | None = None
    parts: list[ListeningPart]
    cefr_level: Literal["A2", "B1"]
    generated_by: str = Field(default="deepseek-chat")
