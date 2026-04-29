"""Integration tests for the grammar_generator agent (DeepSeek mocked).

Patches the cached Agent's `run` method so the tests never reach DeepSeek.
We patch via `app.agents.grammar_generator._agent_cache` (set to a fake)
so the proxy's `grammar_generator_agent.run(...)` resolves to the mock
without trying to read `DEEPSEEK_API_KEY` at import time.
"""
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

import app.agents.grammar_generator as agent_mod
from app.agents.grammar_generator import run_grammar_generate
from app.schemas.grammar import (
    GrammarGenerateRequest,
    GrammarGenerateResponse,
    GrammarMCQ,
)


def _request(count: int = 2, existing: list[str] | None = None) -> GrammarGenerateRequest:
    return GrammarGenerateRequest(
        examType="KET",
        topicId="present_perfect_simple",
        spec="Present perfect: since/for + past time -> has/have done.",
        examples=["I have lived here for five years."],
        existingQuestions=existing or [],
        count=count,
    )


def _mcq(
    question: str = "She _____ in this factory since 2018.",
    correct_index: int = 2,
    opts: list[str] | None = None,
    expl: str = "现在完成时表示从过去某时持续到现在的动作或状态。",
) -> GrammarMCQ:
    return GrammarMCQ(
        question=question,
        options=opts or ["works", "worked", "has worked", "will work"],
        correct_index=correct_index,
        explanation_zh=expl,
        difficulty=2,
    )


def _resp(*items: GrammarMCQ) -> GrammarGenerateResponse:
    return GrammarGenerateResponse(questions=list(items))


@pytest.mark.asyncio
async def test_run_returns_validated_response():
    req = _request(count=1)
    fake = SimpleNamespace(
        run=AsyncMock(return_value=SimpleNamespace(output=_resp(_mcq()))),
    )
    with patch.object(agent_mod, "_agent_cache", fake):
        out = await run_grammar_generate(req)
    assert len(out.questions) == 1
    assert out.questions[0].correct_index == 2
    assert fake.run.await_count == 1


@pytest.mark.asyncio
async def test_run_retries_on_blank_count_failure():
    req = _request(count=1)
    bad_item = _mcq(question="She _____ in this factory _____ 2018.")
    good_item = _mcq()
    fake = SimpleNamespace(
        run=AsyncMock(
            side_effect=[
                SimpleNamespace(output=_resp(bad_item)),
                SimpleNamespace(output=_resp(good_item)),
            ],
        ),
    )
    with patch.object(agent_mod, "_agent_cache", fake):
        out = await run_grammar_generate(req)
    assert out.questions[0].question == good_item.question
    assert fake.run.await_count == 2


@pytest.mark.asyncio
async def test_run_retries_on_classification_question():
    req = _request(count=1)
    bad_item = _mcq(question="Which of the following is a verb?")
    good_item = _mcq()
    fake = SimpleNamespace(
        run=AsyncMock(
            side_effect=[
                SimpleNamespace(output=_resp(bad_item)),
                SimpleNamespace(output=_resp(good_item)),
            ],
        ),
    )
    with patch.object(agent_mod, "_agent_cache", fake):
        out = await run_grammar_generate(req)
    assert out.questions[0].question == good_item.question
    assert fake.run.await_count == 2


@pytest.mark.asyncio
async def test_run_retries_on_duplicate():
    existing = ["She _____ in this factory since 2018."]
    req = _request(count=1, existing=existing)
    bad_item = _mcq(question=existing[0])
    good_item = _mcq(question="He _____ in school since last year.")
    fake = SimpleNamespace(
        run=AsyncMock(
            side_effect=[
                SimpleNamespace(output=_resp(bad_item)),
                SimpleNamespace(output=_resp(good_item)),
            ],
        ),
    )
    with patch.object(agent_mod, "_agent_cache", fake):
        out = await run_grammar_generate(req)
    assert out.questions[0].question == good_item.question
    assert fake.run.await_count == 2


@pytest.mark.asyncio
async def test_run_raises_after_max_retries():
    req = _request(count=1)
    bad_item = _mcq(question="Which of the following is a verb?")
    fake = SimpleNamespace(
        run=AsyncMock(return_value=SimpleNamespace(output=_resp(bad_item))),
    )
    with (
        patch.object(agent_mod, "_agent_cache", fake),
        pytest.raises(ValueError, match="classification"),
    ):
        await run_grammar_generate(req)
    assert fake.run.await_count == 3


@pytest.mark.asyncio
async def test_run_passes_max_tokens_8000_setting():
    """grammar_generator must pass max_tokens=8000 at agent.run() time —
    DeepSeek's default 4096 is too small for count=10+ MCQs (each ~1KB
    Chinese-leaning), so without this the response truncates and the
    validators retry. Mirrors the fix in listening_generator/reading.
    """
    req = _request(count=1)
    fake = SimpleNamespace(
        run=AsyncMock(return_value=SimpleNamespace(output=_resp(_mcq()))),
    )
    with patch.object(agent_mod, "_agent_cache", fake):
        await run_grammar_generate(req)

    # Inspect what the agent.run call received.
    assert fake.run.await_count == 1
    _, kwargs = fake.run.await_args
    assert kwargs.get("model_settings", {}).get("max_tokens") == 8000, (
        f"agent.run was called without max_tokens=8000 in model_settings; "
        f"got kwargs={kwargs}"
    )
