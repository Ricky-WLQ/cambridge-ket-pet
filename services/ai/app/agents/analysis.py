"""Pydantic AI agent producing a teacher-style diagnostic for one student."""

from __future__ import annotations

import os

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.prompts.analysis import build_student_analysis_system_prompt
from app.schemas.analysis import (
    StudentAnalysisRequest,
    StudentAnalysisResponse,
)


def _build_deepseek_provider() -> OpenAIProvider:
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError(
            "DEEPSEEK_API_KEY is not set; cannot call the analysis agent."
        )
    return OpenAIProvider(
        base_url="https://api.deepseek.com/v1",
        api_key=api_key,
    )


def _build_deepseek_model() -> OpenAIChatModel:
    return OpenAIChatModel(
        model_name="deepseek-chat", provider=_build_deepseek_provider()
    )


def _level(percent: int | None) -> str:
    """Classify a 0-100 scaled percentage into a qualitative band."""
    if percent is None:
        return "N/A"
    if percent >= 70:
        return "高 (达标)"
    if percent >= 50:
        return "中 (待提升)"
    return "低 (未达标)"


def _format_summary(req: StudentAnalysisRequest) -> str:
    """Render the request as a human-readable block with units INLINE.

    Passing raw JSON with `score: 25` is ambiguous — the LLM has confused
    this with '25 full marks' before. Every numeric is labeled here with
    its unit and a qualitative level so misreading becomes very hard.
    """
    lines: list[str] = []

    lines.append(f"STUDENT: {req.student_name}")
    lines.append(f"CLASS: {req.class_name}")
    if req.focus_exam_type:
        lines.append(f"FOCUS: only {req.focus_exam_type} attempts")
    lines.append("")

    lines.append("=== OVERALL STATS ===")
    lines.append(f"Graded attempts on record: {req.stats.total_graded}")
    if req.stats.total_graded == 0:
        lines.append(
            "(Student has ZERO graded attempts — no performance data yet.)"
        )
    else:
        avg = req.stats.avg_score
        best = req.stats.best_score
        worst = req.stats.worst_score
        lines.append(
            f"Average score (scaled 0-100, percent correct across attempts): "
            f"{avg}% — level {_level(avg)}"
            if avg is not None
            else "Average score: N/A"
        )
        lines.append(
            f"Best single attempt: {best}% — level {_level(best)}"
            if best is not None
            else "Best single attempt: N/A"
        )
        lines.append(
            f"Worst single attempt: {worst}% — level {_level(worst)}"
            if worst is not None
            else "Worst single attempt: N/A"
        )
        lines.append(
            "NOTE: These are all 0-100 scaled percentages, "
            "where 100% = all answers correct and 70% is the passing "
            "threshold. A value like 25 means 25%, NOT 25 raw points "
            "and NOT full marks."
        )
    lines.append("")

    lines.append("=== RECENT ATTEMPTS (most recent first) ===")
    if not req.recent_attempts:
        lines.append("(no recent attempts)")
    else:
        for i, a in enumerate(req.recent_attempts, start=1):
            part_bit = f" Part {a.part}" if a.part is not None else ""
            lines.append(
                f"{i}. {a.date} — {a.exam_type} {a.kind}{part_bit} "
                f"({a.mode}) — {a.score}% ({_level(a.score)})"
            )
    lines.append("")

    lines.append("=== WRITING RUBRIC AVERAGES (4 criteria, each 0-5 band) ===")
    wa = req.writing_averages
    if wa is None:
        lines.append("(no graded writing submissions yet)")
    else:
        lines.append(f"Averaged across {wa.count} graded writing submission(s):")
        lines.append(f"  Content: {wa.content}/5")
        lines.append(f"  Communicative Achievement: {wa.communicative}/5")
        lines.append(f"  Organisation: {wa.organisation}/5")
        lines.append(f"  Language: {wa.language}/5")
        if wa.count < 3:
            lines.append(
                f"  (Only {wa.count} sample(s) — rubric averages have low "
                f"statistical confidence; advise more writing practice before "
                f"drawing firm conclusions.)"
            )
    lines.append("")

    lines.append(
        "=== TOP ERROR-PRONE EXAM POINTS (count = total wrong answers on "
        "that exam point) ==="
    )
    if not req.top_error_exam_points:
        lines.append("(none recorded)")
    else:
        for i, ep in enumerate(req.top_error_exam_points, start=1):
            desc = f" — {ep.description_zh}" if ep.description_zh else ""
            lines.append(
                f"{i}. {ep.id} ({ep.label_zh}){desc}: {ep.count} errors"
            )
    lines.append("")

    lines.append("=== RECENT WRITING SAMPLES ===")
    if not req.recent_writing_samples:
        lines.append("(none available)")
    else:
        for i, ws in enumerate(req.recent_writing_samples, start=1):
            lines.append(f"--- Sample {i}: {ws.exam_type} Writing Part {ws.part} ---")
            lines.append(f"Task prompt: {ws.prompt}")
            lines.append(f"Student response: {ws.response}")
            lines.append(
                f"Rubric scores (each 0-5): content={ws.scores['content']}/5, "
                f"communicative={ws.scores['communicative']}/5, "
                f"organisation={ws.scores['organisation']}/5, "
                f"language={ws.scores['language']}/5"
            )
            if ws.feedback_zh:
                lines.append(f"Prior AI feedback: {ws.feedback_zh}")
    lines.append("")

    return "\n".join(lines)


async def analyze_student(
    req: StudentAnalysisRequest,
) -> StudentAnalysisResponse:
    """Run the analysis agent, retrying up to 3 times if the output fails
    post-generation validation (e.g. percent scores written as '25 分')."""
    from app.validators.analysis import validate_student_analysis

    model = _build_deepseek_model()
    agent: Agent[None, StudentAnalysisResponse] = Agent(
        model=model,
        output_type=StudentAnalysisResponse,
        system_prompt=build_student_analysis_system_prompt(),
    )

    summary = _format_summary(req)
    base_user_message = (
        "Produce the four-field diagnostic (strengths, weaknesses, "
        "priority_actions, narrative_zh) for the student described below. "
        "Follow the scoring conventions in the system prompt EXACTLY — every "
        "percent-score (0-100) must be reported as '%' (e.g. '25%'), and "
        "never described as '满分' or '分' except for rubric band scores "
        "out of 5.\n\n"
        f"PERFORMANCE SUMMARY:\n{summary}"
    )

    last_output: StudentAnalysisResponse | None = None
    last_error_notes: list[str] = []
    for attempt_no in range(1, 4):
        if attempt_no == 1:
            user_message = base_user_message
        else:
            # Feed prior errors back so the model knows what to fix.
            feedback_lines = "\n".join(f"  - {e}" for e in last_error_notes)
            user_message = (
                base_user_message
                + "\n\nPREVIOUS ATTEMPT FAILED VALIDATION with these errors:\n"
                + feedback_lines
                + "\n\nRegenerate the full diagnostic, applying the corrections "
                "implied by the errors above. Do NOT repeat the mistakes."
            )

        result = await agent.run(user_message)
        last_output = result.output
        errors = validate_student_analysis(last_output, req)
        if not errors:
            return last_output
        last_error_notes = [f"{e.code}: {e.message}" for e in errors]

    # Exhausted retries — return the final output rather than fail hard.
    # The teacher still sees useful content; the UI can caveat accuracy.
    assert last_output is not None
    return last_output
