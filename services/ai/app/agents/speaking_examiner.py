"""speaking_examiner — non-streaming turn handler.

Accepts the full conversation history + script context, returns a single
SpeakingExaminerReply with sentinels already parsed into flags.
"""

from __future__ import annotations

import json
import os
import re

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from app.prompts.speaking_examiner_system import EXAMINER_SYSTEM_PROMPT
from app.schemas.speaking import SpeakingExaminerReply, SpeakingPrompts
from app.validators.speaking import (
    ParsedExaminerOutput,
    SentinelParseError,
    enforce_reply_caps,
    parse_examiner_output,
)


def _build_deepseek_model() -> OpenAIChatModel:
    """Construct the DeepSeek chat model. Mirrors the Phase 1/2 pattern
    in services/ai/app/agents/reading.py and speaking_generator.py.
    Raises RuntimeError if DEEPSEEK_API_KEY is not set.
    """
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY is not set; cannot build examiner model")
    provider = OpenAIProvider(
        base_url="https://api.deepseek.com/v1",
        api_key=api_key,
    )
    return OpenAIChatModel(model_name="deepseek-chat", provider=provider)


async def _run_llm(
    *,
    system_prompt: str,
    user_payload: str,
    max_tokens: int = 150,
    temperature: float = 0.7,
) -> str:
    """Thin wrapper around the DeepSeek chat call. Patched in tests.

    In production, goes through pydantic_ai's Agent with no output_type
    (plain string completion). Returns the raw assistant text.
    """
    agent = Agent(
        model=_build_deepseek_model(),
        system_prompt=system_prompt,
    )
    result = await agent.run(
        user_payload,
        model_settings={"max_tokens": max_tokens, "temperature": temperature},
    )
    raw_output = result.output
    if not raw_output:
        raise RuntimeError("examiner LLM returned empty output")
    return str(raw_output)


def _photo_topic_from_key(photo_key: str | None) -> str | None:
    """Extract the topic tag from a photo key WITHOUT revealing visual
    contents. e.g. "speaking/photos/shopping-01.jpg" -> "shopping".

    The examiner agent uses this to phrase topic-appropriate follow-ups
    ("What do you usually buy when you go shopping?") while staying blind
    to what's actually depicted in the image — which is correct, because
    the candidate must do the describing.
    """
    if not photo_key:
        return None
    basename = photo_key.rsplit("/", 1)[-1]
    stem = basename.rsplit(".", 1)[0]  # drop extension
    # Stem looks like "shopping-01" or "choice-gifts-01"; strip trailing
    # "-NN" sequence numbers.
    parts = stem.rsplit("-", 1)
    if len(parts) == 2 and parts[1].isdigit():
        return parts[0]
    return stem


def _build_user_payload(
    *,
    prompts: SpeakingPrompts,
    history: list[dict[str, str]],
    current_part: int,
) -> str:
    """Compose the user-role payload for the examiner LLM call."""
    part = next(p for p in prompts.parts if p.partNumber == current_part)
    topic = _photo_topic_from_key(part.photoKey)
    return json.dumps(
        {
            "current_part": current_part,
            "script": {
                "title": part.title,
                "target_minutes": part.targetMinutes,
                "examiner_script": part.examinerScript,
                "coaching_hints": part.coachingHints,
                # Only the topic tag — never the visual contents. Agent is
                # instructed (in the system prompt's PHOTO-DESCRIPTION
                # PARTS section) to never describe what's in the photo.
                "photo_topic": topic,
            },
            "history": history,
        },
        ensure_ascii=False,
    )


_SENTINEL_STRIP_RE = re.compile(r"\[\[[^\]]*\]\]")


async def run_examiner_turn(
    *,
    prompts: SpeakingPrompts,
    history: list[dict[str, str]],
    current_part: int,
) -> SpeakingExaminerReply:
    last_part = prompts.parts[-1].partNumber
    next_part_hint = min(current_part + 1, last_part)

    system = EXAMINER_SYSTEM_PROMPT.format(
        level=prompts.level,
        current_part=current_part,
        last_part=last_part,
        next_part_hint=next_part_hint,
    )
    user = _build_user_payload(
        prompts=prompts, history=history, current_part=current_part
    )
    raw = await _run_llm(system_prompt=system, user_payload=user)

    try:
        parsed = parse_examiner_output(
            raw, current_part=current_part, last_part=last_part
        )
    except SentinelParseError:
        # Recover gracefully: strip any sentinel-shaped tokens, keep the
        # text, continue. Better a polite reply than a broken turn.
        # Substitute a space (not empty) to avoid welding adjacent words,
        # then collapse whitespace — mirrors Task 3 Fix-3 hardening.
        cleaned = _SENTINEL_STRIP_RE.sub(" ", raw)
        cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()
        reply_text = cleaned or "Could you say that again, please?"
        parsed = ParsedExaminerOutput(
            reply=reply_text, advancePart=None, sessionEnd=False
        )

    capped = enforce_reply_caps(parsed.reply)

    return SpeakingExaminerReply(
        reply=capped,
        advancePart=parsed.advancePart,
        sessionEnd=parsed.sessionEnd,
    )
