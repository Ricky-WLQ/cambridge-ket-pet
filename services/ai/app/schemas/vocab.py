"""Pydantic schemas for the vocab_gloss agent endpoint.

Inputs: a batch of up to 100 words (cambridgeId + word + POS + optional
existing English gloss).
Outputs: parallel list of {cambridgeId, glossZh, example} items.
"""
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator


ExamType = Literal["KET", "PET"]


class VocabWordInput(BaseModel):
    cambridgeId: str = Field(..., min_length=1, max_length=80)
    word: str = Field(..., min_length=1, max_length=80)
    pos: str = Field(..., min_length=1, max_length=40)
    glossEn: Optional[str] = Field(None, max_length=300)


class VocabGlossRequest(BaseModel):
    examType: ExamType
    words: list[VocabWordInput] = Field(..., max_length=100)


class VocabGlossItem(BaseModel):
    cambridgeId: str = Field(..., min_length=1)
    glossZh: str = Field(..., min_length=1, max_length=200)
    example: str = Field(..., min_length=3, max_length=200)

    @field_validator("glossZh")
    @classmethod
    def _gloss_must_contain_cjk(cls, v: str) -> str:
        # At least one Chinese character.
        if not any("一" <= ch <= "鿿" for ch in v):
            raise ValueError("glossZh must contain at least one Chinese character")
        return v


class VocabGlossResponse(BaseModel):
    items: list[VocabGlossItem]
