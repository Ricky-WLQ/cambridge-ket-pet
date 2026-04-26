"""vocab_gloss agent — DeepSeek-backed batch translator for Cambridge wordlists.

Used by the apps/web seed script `generate-vocab-glosses.ts` (one batch per
call, ≤100 words). 3-retry on validator failure (matches Phase 2/3 pattern).

**Lazy-build note** (mirrors `listening_generator.py` / `speaking_examiner.py`):
the Pydantic-AI `Agent` is built on first call to `get_vocab_gloss_agent()`,
NOT at module import time. This ensures `load_dotenv()` (called in
`app/main.py` at FastAPI startup) has already populated `DEEPSEEK_API_KEY`
before we read it. Tests patch `vocab_gloss_agent.run` (the exposed alias)
or `get_vocab_gloss_agent` directly.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.prompts.vocab_gloss_system import SYSTEM_PROMPT
from app.schemas.vocab import (
    VocabGlossRequest,
    VocabGlossResponse,
)
from app.validators.vocab import validate_response_covers_all_words

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 3


def _build_agent() -> Agent[None, VocabGlossResponse]:
    """Build a new vocab_gloss Agent with DeepSeek backend.

    Reads `DEEPSEEK_API_KEY` from env at call time (not at import time).
    """
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError(
            "DEEPSEEK_API_KEY is not set; cannot build vocab_gloss agent",
        )
    base_url = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
    model_name = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")
    model = OpenAIChatModel(
        model_name=model_name,
        provider=OpenAIProvider(base_url=base_url, api_key=api_key),
    )
    return Agent(
        model=model,
        output_type=VocabGlossResponse,
        system_prompt=SYSTEM_PROMPT,
        retries=3,
    )


# Cached agent instance — populated on first call to get_vocab_gloss_agent.
_agent_cache: Agent[None, VocabGlossResponse] | None = None


def get_vocab_gloss_agent() -> Agent[None, VocabGlossResponse]:
    """Return the cached vocab_gloss Agent, building on first call."""
    global _agent_cache
    if _agent_cache is None:
        _agent_cache = _build_agent()
    return _agent_cache


# Module-level alias used by tests for `patch("...vocab_gloss_agent.run", ...)`.
# This is a lazy proxy that builds the real Agent on first attribute access,
# but we keep the simpler form here: tests can monkeypatch the attribute on
# the cached agent, OR patch `get_vocab_gloss_agent` to return a fake.
class _LazyAgentProxy:
    """Lightweight proxy so `vocab_gloss_agent.run(...)` works without
    eagerly building the real Agent at import time. The proxy delegates
    every attribute lookup to the cached real Agent. Tests can patch
    `vocab_gloss_agent.run` (the proxy attribute) and the patch will be
    consulted before the real agent is touched.
    """

    def __getattr__(self, name: str):
        return getattr(get_vocab_gloss_agent(), name)


vocab_gloss_agent = _LazyAgentProxy()


def _format_user_message(req: VocabGlossRequest) -> str:
    lines = [f"等级: {req.examType}", "请为以下单词生成中文释义和例句:"]
    for w in req.words:
        prefix = f"- cambridgeId={w.cambridgeId}  word={w.word}  pos={w.pos}"
        if w.glossEn:
            prefix += f"  英文释义={w.glossEn}"
        lines.append(prefix)
    return "\n".join(lines)


async def run_vocab_gloss(req: VocabGlossRequest) -> VocabGlossResponse:
    """Execute one batch. Up to 3 retries on validator failure.

    Raises the last exception on attempt 3 (no silent return).
    """
    user_msg = _format_user_message(req)
    last_error: Optional[Exception] = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            result = await vocab_gloss_agent.run(user_msg)
            response: VocabGlossResponse = result.output

            # Coverage check: every requested cambridgeId is present in items.
            validate_response_covers_all_words(req.words, response.items)

            # Sanity: items must reference real input cambridgeIds (catches AI hallucinations).
            inputs_by_id = {w.cambridgeId for w in req.words}
            for item in response.items:
                if item.cambridgeId not in inputs_by_id:
                    raise ValueError(
                        f"response contains unknown cambridgeId {item.cambridgeId!r}",
                    )

            if attempt > 1:
                logger.info(
                    "vocab_gloss succeeded on attempt %d/%d",
                    attempt,
                    MAX_ATTEMPTS,
                )
            return response

        except Exception as exc:  # noqa: BLE001 — we re-raise on attempt 3
            last_error = exc
            logger.warning(
                "vocab_gloss attempt %d/%d failed: %s",
                attempt,
                MAX_ATTEMPTS,
                exc,
            )
            if attempt == MAX_ATTEMPTS:
                raise

    # Unreachable: the loop either returns or raises. Kept to satisfy type checker.
    raise RuntimeError("unreachable") from last_error
