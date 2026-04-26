"""grammar_generator agent — DeepSeek-backed MCQ writer.

Used by the apps/web seed script `seed-grammar-questions.ts` (one batch
per call, per (examType, topicId), count <= 30). 3-retry on validator
failure (matches Phase 2/3 + Slice 4a pattern).

**Lazy-build note** (mirrors `vocab_gloss.py` / `listening_generator.py`):
the Pydantic-AI `Agent` is built on first call to
`get_grammar_generator_agent()`, NOT at module import time. This ensures
`load_dotenv()` (called in `app/main.py` at FastAPI startup) has already
populated `DEEPSEEK_API_KEY` before we read it. Tests patch
`grammar_generator_agent.run` (the exposed alias) or
`get_grammar_generator_agent` directly.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.prompts.grammar_generator_system import SYSTEM_PROMPT
from app.schemas.grammar import (
    GrammarGenerateRequest,
    GrammarGenerateResponse,
)
from app.validators.grammar import (
    validate_blank_count,
    validate_not_classification_question,
    validate_not_duplicate,
    validate_vocab_in_level,
)

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 3


def _build_agent() -> Agent[None, GrammarGenerateResponse]:
    """Build a new grammar_generator Agent with DeepSeek backend.

    Reads `DEEPSEEK_API_KEY` from env at call time (not at import time).
    """
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError(
            "DEEPSEEK_API_KEY is not set; cannot build grammar_generator agent",
        )
    base_url = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
    model_name = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")
    model = OpenAIChatModel(
        model_name=model_name,
        provider=OpenAIProvider(base_url=base_url, api_key=api_key),
    )
    return Agent(
        model=model,
        output_type=GrammarGenerateResponse,
        system_prompt=SYSTEM_PROMPT,
        retries=3,
    )


# Cached agent instance — populated on first call to get_grammar_generator_agent.
_agent_cache: Agent[None, GrammarGenerateResponse] | None = None


def get_grammar_generator_agent() -> Agent[None, GrammarGenerateResponse]:
    """Return the cached grammar_generator Agent, building on first call."""
    global _agent_cache
    if _agent_cache is None:
        _agent_cache = _build_agent()
    return _agent_cache


# Module-level alias used by tests for `patch("...grammar_generator_agent.run", ...)`.
class _LazyAgentProxy:
    """Lightweight proxy so `grammar_generator_agent.run(...)` works without
    eagerly building the real Agent at import time. Tests can patch
    `_agent_cache` directly with a SimpleNamespace having a `run` method,
    OR patch `get_grammar_generator_agent` to return a fake.
    """

    def __getattr__(self, name: str):
        return getattr(get_grammar_generator_agent(), name)


grammar_generator_agent = _LazyAgentProxy()


def _format_user_message(req: GrammarGenerateRequest) -> str:
    lines = [
        f"等级: {req.examType}",
        f"语法主题 (topicId): {req.topicId}",
        "官方说明 (spec):",
        req.spec,
        "",
        f"请生成 {req.count} 道选择题。",
    ]
    if req.examples:
        lines.append("已有例句参考:")
        for ex in req.examples:
            lines.append(f"  - {ex}")
    if req.existingQuestions:
        lines.append("已存在的题目（请勿重复）:")
        for q in req.existingQuestions[:20]:
            lines.append(f"  - {q}")
    return "\n".join(lines)


async def run_grammar_generate(
    req: GrammarGenerateRequest,
    wordlist: set[str] | None = None,
) -> GrammarGenerateResponse:
    """Execute one generate batch. Up to 3 retries on validator failure.

    `wordlist` is an optional set of allowed lowercased lemma forms; pass
    None to skip the in-level vocab check (used when the wordlist isn't
    pre-loaded into the AI service process).

    Raises the last exception on attempt 3 (no silent return).
    """
    user_msg = _format_user_message(req)
    last_error: Optional[Exception] = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            result = await grammar_generator_agent.run(user_msg)
            response: GrammarGenerateResponse = result.output

            # Per-item business validators (schema-level already fired during construction).
            for item in response.questions:
                validate_blank_count(item)
                validate_not_classification_question(item)
                validate_vocab_in_level(item, wordlist)
                validate_not_duplicate(item, req.existingQuestions)

            if attempt > 1:
                logger.info(
                    "grammar_generate succeeded on attempt %d/%d for topic=%s",
                    attempt,
                    MAX_ATTEMPTS,
                    req.topicId,
                )
            return response

        except Exception as exc:  # noqa: BLE001 — we re-raise on attempt 3
            last_error = exc
            logger.warning(
                "grammar_generate attempt %d/%d failed for topic=%s: %s",
                attempt,
                MAX_ATTEMPTS,
                req.topicId,
                exc,
            )
            if attempt == MAX_ATTEMPTS:
                raise

    # Unreachable: the loop either returns or raises. Kept to satisfy type checker.
    raise RuntimeError("unreachable") from last_error
