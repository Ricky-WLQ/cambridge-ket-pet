"""Tests for the diagnose_analysis agent's retry orchestration.

Specifically covers the PR-style fix that wraps ``agent.run()`` in a
``try/except UnexpectedModelBehavior`` so pydantic-ai schema-validation
exhaustion (DeepSeek tool-call truncation, esp. when output approaches
the 8000-token cap) is treated like a soft validator failure and retried,
instead of bubbling out and breaking the diagnose flow.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic_ai import UnexpectedModelBehavior

from app.agents.diagnose_analysis import analyze_diagnose
from app.schemas.diagnose import (
    DiagnoseAnalysisRequest,
    DiagnoseAnalysisResponse,
    KnowledgePointGroup,
    KnowledgePointQuestion,
    WrongAnswer,
)


def _wrong_answer() -> WrongAnswer:
    return WrongAnswer(
        section="READING",
        question_text="What does the author mean by ___?",
        user_answer="A",
        correct_answer="B",
        options=["A", "B", "C"],
    )


def _valid_response() -> DiagnoseAnalysisResponse:
    return DiagnoseAnalysisResponse(
        knowledge_points=[
            KnowledgePointGroup(
                knowledge_point="Inferring author's intent",
                category="reading_skill",
                mini_lesson="作者意图题需要从全文语气推断。",
                rule="先定位语气词，再综合上下文。",
                example_sentences=[
                    "The phrase 'in fact' often signals contrast.",
                    "Authors use modals to soften claims.",
                    "Ironic statements invert literal meaning.",
                ],
                questions=[
                    KnowledgePointQuestion(
                        section="READING",
                        question_text="What does the author mean by ___?",
                        user_answer="A",
                        correct_answer="B",
                        why_wrong="A 是字面义，作者实际表达的是 B。",
                        rule="结合上下文判断作者真实意图。",
                    ),
                ],
                severity="moderate",
            ),
        ],
    )


def _empty_response() -> DiagnoseAnalysisResponse:
    return DiagnoseAnalysisResponse(knowledge_points=[])


def _mock_run_result(response: DiagnoseAnalysisResponse) -> MagicMock:
    m = MagicMock()
    m.output = response
    return m


@pytest.mark.asyncio
async def test_analyze_diagnose_retries_on_unexpected_model_behavior() -> None:
    """If pydantic-ai raises UnexpectedModelBehavior on attempt 1, the
    outer retry loop catches it and retries — succeeding on attempt 2."""
    req = DiagnoseAnalysisRequest(exam_type="KET", wrong_answers=[_wrong_answer()])

    mock_agent = MagicMock()
    mock_agent.run = AsyncMock(
        side_effect=[
            UnexpectedModelBehavior(
                "Exceeded maximum retries (1) for output validation"
            ),
            _mock_run_result(_valid_response()),
        ]
    )

    with patch(
        "app.agents.diagnose_analysis._build_agent",
        return_value=mock_agent,
    ):
        result = await analyze_diagnose(req)

    assert len(result.knowledge_points) == 1
    assert result.knowledge_points[0].category == "reading_skill"
    assert mock_agent.run.await_count == 2


@pytest.mark.asyncio
async def test_analyze_diagnose_returns_empty_after_3_pydantic_failures() -> None:
    """If pydantic-ai raises UnexpectedModelBehavior every attempt, the
    function returns an empty response (matches the existing 'never raise
    hard, return partial' contract — apps/web's gate semantics treat report
    failures as 'still unblocked')."""
    req = DiagnoseAnalysisRequest(exam_type="KET", wrong_answers=[_wrong_answer()])

    mock_agent = MagicMock()
    mock_agent.run = AsyncMock(
        side_effect=UnexpectedModelBehavior(
            "Exceeded maximum retries (1) for output validation"
        )
    )

    with patch(
        "app.agents.diagnose_analysis._build_agent",
        return_value=mock_agent,
    ):
        result = await analyze_diagnose(req)

    # Empty rather than raising: the apps/web gate treats this as "still
    # unblocked" so a missing/empty report is preferable to a 500.
    assert result.knowledge_points == []
    assert mock_agent.run.await_count == 3


@pytest.mark.asyncio
async def test_analyze_diagnose_empty_input_bypass_no_agent_call() -> None:
    """Empty wrong_answers (perfect-score case) returns empty response
    without calling the agent — saves a DeepSeek call."""
    req = DiagnoseAnalysisRequest(exam_type="KET", wrong_answers=[])

    mock_agent = MagicMock()
    mock_agent.run = AsyncMock()

    with patch(
        "app.agents.diagnose_analysis._build_agent",
        return_value=mock_agent,
    ):
        result = await analyze_diagnose(req)

    assert result.knowledge_points == []
    # No agent call should happen for empty input.
    assert mock_agent.run.await_count == 0
