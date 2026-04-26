"""Pydantic schemas for the grammar_generator agent endpoint.

Inputs: a single (examType, topicId) request asking for `count` MCQ items.
Outputs: a list of GrammarMCQ items, each a 4-option multiple choice with
Chinese explanation.
"""
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator


ExamType = Literal["KET", "PET"]


class GrammarGenerateRequest(BaseModel):
    examType: ExamType
    topicId: str = Field(..., min_length=1, max_length=80)
    spec: str = Field(..., min_length=1, max_length=2000)
    examples: list[str] = Field(default_factory=list, max_length=20)
    existingQuestions: list[str] = Field(default_factory=list, max_length=200)
    count: int = Field(..., ge=1, le=30)


class GrammarMCQ(BaseModel):
    question: str = Field(..., min_length=4, max_length=300)
    options: list[str] = Field(..., min_length=4, max_length=4)
    correct_index: int = Field(..., ge=0, le=3)
    explanation_en: Optional[str] = Field(None, max_length=400)
    explanation_zh: str = Field(..., min_length=1, max_length=400)
    difficulty: int = Field(..., ge=1, le=5)

    @field_validator("explanation_zh")
    @classmethod
    def _explanation_must_contain_cjk(cls, v: str) -> str:
        if not any("一" <= ch <= "鿿" for ch in v):
            raise ValueError("explanation_zh must contain at least one Chinese character")
        return v

    @field_validator("options")
    @classmethod
    def _options_must_be_distinct(cls, v: list[str]) -> list[str]:
        normalized = [o.strip().lower() for o in v]
        if len(set(normalized)) != len(normalized):
            raise ValueError("options must all be distinct (case-insensitive trim)")
        return v


class GrammarGenerateResponse(BaseModel):
    questions: list[GrammarMCQ]
