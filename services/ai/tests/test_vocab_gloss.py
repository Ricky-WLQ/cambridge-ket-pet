"""Integration tests for the vocab_gloss agent (DeepSeek mocked).

Patches the cached Agent's `run` method so the tests never reach DeepSeek.
We patch via `app.agents.vocab_gloss._agent_cache` (set to a fake) so the
proxy's `vocab_gloss_agent.run(...)` resolves to the mock without trying
to read `DEEPSEEK_API_KEY` at import time.
"""
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

import app.agents.vocab_gloss as vocab_gloss_mod
from app.agents.vocab_gloss import run_vocab_gloss
from app.schemas.vocab import (
    VocabGlossItem,
    VocabGlossRequest,
    VocabGlossResponse,
    VocabWordInput,
)


def _make_req(*pairs: tuple[str, str, str]) -> VocabGlossRequest:
    return VocabGlossRequest(
        examType="KET",
        words=[
            VocabWordInput(cambridgeId=cid, word=w, pos=pos, glossEn=None)
            for cid, w, pos in pairs
        ],
    )


def _make_resp(*pairs: tuple[str, str, str, str]) -> VocabGlossResponse:
    """Each pair: (cambridgeId, glossZh, example, cefrLevel)"""
    return VocabGlossResponse(
        items=[
            VocabGlossItem(cambridgeId=cid, glossZh=g, example=ex, cefrLevel=cefr)
            for cid, g, ex, cefr in pairs
        ],
    )


def _patch_agent_run(mock_run):
    """Install a fake Agent (with `.run = mock_run`) into the module cache so
    `vocab_gloss_agent.run(...)` resolves to it, bypassing DeepSeek build.
    """
    fake_agent = SimpleNamespace(run=mock_run)
    return patch.object(vocab_gloss_mod, "_agent_cache", fake_agent)


@pytest.mark.asyncio
async def test_run_vocab_gloss_returns_validated_response():
    req = _make_req(("a", "act", "v"))
    fake_resp = _make_resp(("a", "表演", "She acts in the school play.", "A2"))

    mock = AsyncMock(return_value=SimpleNamespace(output=fake_resp))
    with _patch_agent_run(mock):
        out = await run_vocab_gloss(req)

    assert out.items[0].cambridgeId == "a"
    assert "act" in out.items[0].example.lower()
    assert mock.await_count == 1


@pytest.mark.asyncio
async def test_run_vocab_gloss_retries_on_missing_coverage():
    req = _make_req(("a", "act", "v"), ("b", "go", "v"))
    bad = _make_resp(("a", "表演", "She acts.", "A2"))  # missing "b"
    good = _make_resp(
        ("a", "表演", "She acts.", "A2"),
        ("b", "去", "I go to school.", "A1"),
    )

    mock = AsyncMock(
        side_effect=[
            SimpleNamespace(output=bad),
            SimpleNamespace(output=good),
        ],
    )
    with _patch_agent_run(mock):
        out = await run_vocab_gloss(req)

    assert {it.cambridgeId for it in out.items} == {"a", "b"}
    assert mock.await_count == 2
