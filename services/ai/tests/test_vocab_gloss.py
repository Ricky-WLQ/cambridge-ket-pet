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


# -------- Fan-out tests (chunked parallel sub-calls when batch > CHUNK_SIZE) --------


@pytest.mark.asyncio
async def test_no_fanout_when_batch_at_or_under_chunk_size():
    """A small batch (≤ CHUNK_SIZE) goes through one call, no fan-out."""
    pairs = [(f"id{i}", f"w{i}", "v") for i in range(vocab_gloss_mod._CHUNK_SIZE)]
    req = _make_req(*pairs)
    fake_resp = _make_resp(*[(cid, "中", "Sentence.", "A2") for cid, _, _ in pairs])

    mock = AsyncMock(return_value=SimpleNamespace(output=fake_resp))
    with _patch_agent_run(mock):
        out = await run_vocab_gloss(req)

    assert {it.cambridgeId for it in out.items} == {p[0] for p in pairs}
    # Single call only — no fan-out at the boundary.
    assert mock.await_count == 1


@pytest.mark.asyncio
async def test_fans_out_when_batch_exceeds_chunk_size():
    """A large batch (> CHUNK_SIZE) is split into ceil(N/CHUNK_SIZE) parallel
    sub-calls; the merged response covers every input cambridgeId."""
    chunk = vocab_gloss_mod._CHUNK_SIZE
    n_words = chunk * 2 + 3  # forces 3 chunks
    pairs = [(f"id{i}", f"w{i}", "v") for i in range(n_words)]
    req = _make_req(*pairs)

    def side_effect(prompt, **kwargs):
        # Echo back the cambridgeIds the prompt asks for so each chunk
        # returns exactly the requested ones — proves the dispatcher is
        # passing chunk-specific prompts.
        ids = [
            line.split("cambridgeId=")[1].split()[0]
            for line in prompt.splitlines()
            if "cambridgeId=" in line
        ]
        chunk_resp = _make_resp(
            *[(cid, "中", "Sentence.", "A2") for cid in ids]
        )
        return SimpleNamespace(output=chunk_resp)

    mock = AsyncMock(side_effect=side_effect)
    with _patch_agent_run(mock):
        out = await run_vocab_gloss(req)

    assert {it.cambridgeId for it in out.items} == {p[0] for p in pairs}
    # 3 chunks for n_words=23 with chunk=10 (10, 10, 3).
    expected_chunks = -(-n_words // chunk)
    assert mock.await_count == expected_chunks


@pytest.mark.asyncio
async def test_fanout_propagates_per_chunk_failure():
    """If one chunk's per-chunk retries are exhausted (all 3 attempts fail),
    the whole batch raises (asyncio.gather fail-fast), with the final error."""
    chunk = vocab_gloss_mod._CHUNK_SIZE
    pairs = [(f"id{i}", f"w{i}", "v") for i in range(chunk + 1)]  # 2 chunks
    req = _make_req(*pairs)

    # Always return only id0 — so the "first chunk" satisfies coverage
    # (because it asks for id0..id9) but the second chunk (asking for
    # id10) fails coverage every retry.
    def side_effect(prompt, **kwargs):
        ids_requested = [
            line.split("cambridgeId=")[1].split()[0]
            for line in prompt.splitlines()
            if "cambridgeId=" in line
        ]
        # Return only "id0" — covers chunk 1 fully, but not chunk 2.
        if "id0" in ids_requested:
            chunk_resp = _make_resp(
                *[(cid, "中", "Sentence.", "A2") for cid in ids_requested]
            )
        else:
            chunk_resp = _make_resp(("id0", "中", "Sentence.", "A2"))
        return SimpleNamespace(output=chunk_resp)

    mock = AsyncMock(side_effect=side_effect)
    with (
        _patch_agent_run(mock),
        # validate_response_covers_all_words raises ValueError when a chunk's
        # response is missing requested cambridgeIds; the inner retry loop
        # exhausts (3 tries), and asyncio.gather propagates the ValueError.
        pytest.raises(ValueError, match="missing"),
    ):
        await run_vocab_gloss(req)
