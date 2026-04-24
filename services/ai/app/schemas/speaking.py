"""Pydantic models for Phase 3 Speaking. Shapes match docs/superpowers/specs §5 + §6.2."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


SpeakingLevel = Literal["KET", "PET"]
SpeakingRole = Literal["user", "assistant"]
SpeakingTurnSource = Literal["server", "akool_stt", "client_fallback"]


class SpeakingPromptPart(BaseModel):
    partNumber: int = Field(ge=1, le=6)
    title: str = Field(min_length=1, max_length=100)
    targetMinutes: int = Field(ge=1, le=15)
    examinerScript: list[str] = Field(min_length=1, max_length=20)
    coachingHints: str = ""
    photoKey: str | None = None

    @field_validator("examinerScript")
    @classmethod
    def _non_empty_strings(cls, v: list[str]) -> list[str]:
        if any(not s.strip() for s in v):
            raise ValueError("examinerScript items must be non-empty")
        return v


class SpeakingPrompts(BaseModel):
    level: SpeakingLevel
    initialGreeting: str = Field(min_length=1, max_length=200)
    parts: list[SpeakingPromptPart] = Field(min_length=1, max_length=6)

    @field_validator("parts")
    @classmethod
    def _parts_sequential(cls, parts: list[SpeakingPromptPart]) -> list[SpeakingPromptPart]:
        expected = list(range(1, len(parts) + 1))
        actual = [p.partNumber for p in parts]
        if actual != expected:
            raise ValueError(f"parts must be numbered sequentially from 1; got {actual}")
        return parts


class SpeakingTurn(BaseModel):
    role: SpeakingRole
    content: str
    part: int = Field(ge=1, le=6)
    ts: str | None = None  # ISO-8601 when known; may be set by caller
    source: SpeakingTurnSource = "server"


class SpeakingExaminerReply(BaseModel):
    """Return shape from /speaking/examiner."""

    reply: str = Field(min_length=1, max_length=400)  # ~40 words English ≈ 200–260 chars
    advancePart: int | None = Field(default=None, ge=2, le=6)
    sessionEnd: bool = False

    @field_validator("reply")
    @classmethod
    def _word_cap(cls, v: str) -> str:
        if len(v.split()) > 60:  # hard cap; spec target is ~40 words
            raise ValueError("reply exceeds 60-word cap")
        return v


class SpeakingWeakPoint(BaseModel):
    tag: str = Field(min_length=1, max_length=80)
    quote: str = Field(min_length=1, max_length=400)
    suggestion: str = Field(min_length=1, max_length=200)


class SpeakingScore(BaseModel):
    grammarVocab: int = Field(ge=0, le=5)
    discourseManagement: int = Field(ge=0, le=5)
    pronunciation: int = Field(ge=0, le=5)
    interactive: int = Field(ge=0, le=5)
    overall: float = Field(ge=0, le=5)
    justification: str = Field(min_length=1, max_length=2000)
    weakPoints: list[SpeakingWeakPoint] = Field(default_factory=list, max_length=30)
