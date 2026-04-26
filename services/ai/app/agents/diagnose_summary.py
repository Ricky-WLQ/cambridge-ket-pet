"""Pydantic AI agent producing the weekly diagnose 4-field summary.

Sibling of ``app/agents/diagnose_analysis.py`` (T12) and structural twin of
``app/agents/analysis.py``: this agent takes per-section scores + the
8-category knowledge points produced upstream by the analysis agent and
returns the 4-field weekly summary (``strengths`` / ``weaknesses`` /
``priority_actions`` / ``narrative_zh``).

Same 3-retry validator-feedback loop:
  1. Build a Pydantic AI Agent with the DeepSeek model.
  2. Compose system + user prompts via the T10 builders.
  3. Run agent, validate via ``app.validators.diagnose.validate_diagnose_summary``.
  4. On validation errors, append errors to the user message and retry.
  5. After 3 attempts, return the last response anyway — apps/web's gate
     semantics (Plan B.5) treat report-generation failure as "still
     unblocked", so a partial/imperfect summary is preferable to a 500.

Empty-week edge case: when ``req.weak_count == 0`` and all per-section
scores are >= 70, the AI is asked to produce a celebratory summary. We
intentionally do NOT add a Python-side bypass for this case — the prompt
already handles it naturally, the cost of one DeepSeek call is negligible,
and the narrative still adds value (week-over-week trend, encouragement).

Module duplicates ``_build_deepseek_provider`` / ``_build_deepseek_model``
from ``analysis.py`` and ``diagnose_analysis.py`` rather than importing
them. The three agents are otherwise unrelated, and decoupling the modules
is worth ~10 duplicated lines so neither file's edits ripple into the
others.
"""

from __future__ import annotations

import logging
import os

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.prompts.diagnose_summary import (
    build_diagnose_summary_system_prompt,
    build_diagnose_summary_user_prompt,
)
from app.schemas.diagnose import (
    DiagnoseSummaryRequest,
    DiagnoseSummaryResponse,
)
from app.validators.diagnose import validate_diagnose_summary

log = logging.getLogger(__name__)

MAX_ATTEMPTS = 3


def _build_deepseek_provider() -> OpenAIProvider:
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError(
            "DEEPSEEK_API_KEY is not set; cannot call the diagnose summary agent."
        )
    return OpenAIProvider(
        base_url="https://api.deepseek.com/v1",
        api_key=api_key,
    )


def _build_deepseek_model() -> OpenAIChatModel:
    return OpenAIChatModel(
        model_name="deepseek-chat", provider=_build_deepseek_provider()
    )


def _build_agent(exam_type: str) -> Agent[None, DiagnoseSummaryResponse]:
    """Build a Pydantic AI Agent wired with the DeepSeek model and system prompt.

    ``retries=1`` keeps Pydantic AI's internal output-parse retry on for
    soft JSON-shape mistakes; the post-generation validator loop in
    ``summarize_diagnose`` handles the harder semantic checks (e.g., the
    year-token rule enforced by ``validate_diagnose_summary``).
    """
    return Agent(
        model=_build_deepseek_model(),
        output_type=DiagnoseSummaryResponse,
        system_prompt=build_diagnose_summary_system_prompt(exam_type),  # type: ignore[arg-type]
        retries=1,
    )


async def summarize_diagnose(
    req: DiagnoseSummaryRequest,
) -> DiagnoseSummaryResponse:
    """Run the weekly diagnose summary agent.

    Calls DeepSeek with the diagnose_summary prompt. Validates the response;
    on validation failure retries up to 3 times with prior-error feedback
    re-injected. On exhausted retries, returns the last (valid-shaped) output
    so the caller is never blocked — apps/web's gate semantics treat report
    failures as "still unblocked" per Plan B.5.

    Empty-week case is intentionally NOT bypassed in Python; the prompt
    handles a celebratory all-clear summary naturally and the DeepSeek
    call cost is negligible vs. the value of a coherent narrative.
    """
    agent = _build_agent(req.exam_type)
    base_user_prompt = build_diagnose_summary_user_prompt(req)

    last_response: DiagnoseSummaryResponse | None = None
    last_errors: list[str] = []

    for attempt in range(MAX_ATTEMPTS):
        if attempt == 0 or not last_errors:
            user_prompt = base_user_prompt
        else:
            # Feed prior-attempt errors back so the model knows what to fix.
            feedback_lines = "\n".join(f"- {e}" for e in last_errors)
            user_prompt = (
                base_user_prompt
                + "\n\n## 上次回答存在以下问题（请修正）\n"
                + feedback_lines
            )

        result = await agent.run(user_prompt)
        last_response = result.output

        errors = validate_diagnose_summary(last_response)
        if not errors:
            return last_response

        last_errors = errors
        log.warning(
            "diagnose_summary attempt %d validation errors: %s",
            attempt + 1,
            errors,
        )

    # Exhausted retries — return the last response anyway. The gate
    # semantics in apps/web treat report failures as "still unblocked",
    # and a partial/imperfect summary is more useful to the student than
    # a hard error.
    log.error(
        "diagnose_summary exhausted %d retries; returning last response",
        MAX_ATTEMPTS,
    )
    if last_response is None:
        # Defensive — unreachable since we always set ``last_response``
        # after ``agent.run``; kept so a future refactor that changes
        # the loop shape can't silently produce ``None``.
        raise RuntimeError(
            "diagnose_summary received no response from agent"
        )
    return last_response
