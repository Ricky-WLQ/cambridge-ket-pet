"""Pydantic AI agent producing the 8-category knowledge-point analysis.

Ports pretco-app's wrong-answer → knowledge-point analysis for Cambridge
KET/PET. Receives a list of ``WrongAnswer`` items (built upstream by
apps/web's ``collectWrongAnswers.ts`` from T7) and returns
``KnowledgePointGroup[]`` packaged in a ``DiagnoseAnalysisResponse``.

Mirrors ``app/agents/analysis.py``'s 3-retry-with-validator-feedback loop:
  1. Build a Pydantic AI Agent with the DeepSeek model.
  2. Compose system + user prompts via the T10 builders.
  3. Run agent, validate via ``app.validators.diagnose.validate_diagnose_analysis``.
  4. On validation errors, append errors to the user message and retry.
  5. After 3 attempts, return the last response anyway — apps/web's gate
     semantics (Plan B.5) treat report-generation failure as "still
     unblocked" so a partial/imperfect report is preferable to a 500.

Empty-input bypass: ``req.wrong_answers == []`` (perfect-score case)
returns ``DiagnoseAnalysisResponse(knowledge_points=[])`` immediately
without calling DeepSeek. This avoids charging the user for an AI call
when there is nothing to analyze.

Module duplicates ``_build_deepseek_provider`` / ``_build_deepseek_model``
from ``analysis.py`` rather than importing them. The two agents are
otherwise unrelated, and decoupling the modules is worth ~10 duplicated
lines so neither file's edits ripple into the other.
"""

from __future__ import annotations

import os

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.prompts.diagnose_analysis import (
    build_diagnose_analysis_system_prompt,
    build_diagnose_analysis_user_prompt,
)
from app.schemas.diagnose import (
    DiagnoseAnalysisRequest,
    DiagnoseAnalysisResponse,
)
from app.validators.diagnose import validate_diagnose_analysis


def _build_deepseek_provider() -> OpenAIProvider:
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError(
            "DEEPSEEK_API_KEY is not set; cannot call the diagnose analysis agent."
        )
    return OpenAIProvider(
        base_url="https://api.deepseek.com/v1",
        api_key=api_key,
    )


def _build_deepseek_model() -> OpenAIChatModel:
    return OpenAIChatModel(
        model_name="deepseek-chat", provider=_build_deepseek_provider()
    )


def _build_agent(exam_type: str) -> Agent[None, DiagnoseAnalysisResponse]:
    """Build a Pydantic AI Agent wired with the DeepSeek model and system prompt.

    ``retries=1`` keeps Pydantic AI's internal output-parse retry on for
    soft JSON-shape mistakes; the post-generation validator loop in
    ``analyze_diagnose`` handles the harder semantic checks.
    """
    return Agent(
        model=_build_deepseek_model(),
        output_type=DiagnoseAnalysisResponse,
        system_prompt=build_diagnose_analysis_system_prompt(exam_type),  # type: ignore[arg-type]
        retries=1,
    )


# DeepSeek's default max_tokens (~4096) is too small for the structured
# 8-category KnowledgePointGroup output: each group carries a mini-lesson,
# rule, 3 example sentences, and a list of per-question explanations. With
# 6 sections × ~3 wrong-answers fanning into multiple groups the output
# easily exceeds 4096 → tool-call args get truncated → pydantic-ai raises
# UnexpectedModelBehavior("Exceeded maximum retries (1) for output validation").
# 8000 is just under DeepSeek-chat's 8192 ceiling.
#
# IMPORTANT: pydantic-ai applies model_settings only when passed to
# ``agent.run(...)``, NOT when passed to ``Agent(...)`` constructor — see
# the same fix in listening_generator.py:62-65 / reading.py:38-62.
_ANALYSIS_MODEL_SETTINGS = {"max_tokens": 8000}


async def analyze_diagnose(
    req: DiagnoseAnalysisRequest,
) -> DiagnoseAnalysisResponse:
    """Run the 8-category knowledge-point analysis agent.

    Calls DeepSeek with the diagnose_analysis prompt. Validates the response;
    on validation failure retries up to 3 times with prior-error feedback
    re-injected. On exhausted retries, returns the last (valid-shaped) output
    so the caller is never blocked — apps/web's gate semantics treat report
    failures as "still unblocked" per Plan B.5.

    Empty-input case (``req.wrong_answers == []``): returns
    ``DiagnoseAnalysisResponse(knowledge_points=[])`` without calling DeepSeek.
    """
    # Empty-input bypass — perfect-score case, no wrong answers to analyze.
    if not req.wrong_answers:
        return DiagnoseAnalysisResponse(knowledge_points=[])

    agent = _build_agent(req.exam_type)
    base_user_prompt = build_diagnose_analysis_user_prompt(
        req.exam_type, req.wrong_answers
    )

    last_response: DiagnoseAnalysisResponse | None = None
    last_errors: list[str] = []

    for attempt in range(3):
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

        result = await agent.run(user_prompt, model_settings=_ANALYSIS_MODEL_SETTINGS)
        last_response = result.output

        errors = validate_diagnose_analysis(last_response)
        if not errors:
            return last_response
        last_errors = errors

    # Exhausted retries — return the last response anyway. The gate
    # semantics in apps/web treat report failures as "still unblocked",
    # and a partial/imperfect report is more useful to the student than
    # a hard error.
    if last_response is not None:
        return last_response
    return DiagnoseAnalysisResponse(knowledge_points=[])
