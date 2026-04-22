"""Post-generation validators for the student-analysis agent.

The LLM has a strong prior for '25 分' style phrasing in Chinese K-12
educational writing. Even with an explicit prompt, deepseek-chat
sometimes converts '25%' in the input to '25 分（满分 25）' in the
output — a dangerous misreading that confuses teachers. These
validators detect common misreadings and let the agent retry.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.schemas.analysis import StudentAnalysisRequest, StudentAnalysisResponse


@dataclass(frozen=True)
class AnalysisValidationError:
    code: str
    message: str


# Chinese surnames we've observed the model invent (non-exhaustive but common).
_TEACHER_NAME_PATTERN = re.compile(
    r"(王|李|张|刘|陈|杨|赵|吴|周|徐|孙|胡|朱|高|林|郭|何|马|罗|黄)老师"
)

# '25 分' / '25分' / '25 点' — any bare number followed by 分/点 without a '/N 分'
# denominator. We still allow '3/5 分' or 'X 分（满分 5 分）' in rubric contexts
# by excluding patterns that have '/' or '5 分' nearby.
_POINTS_PATTERN = re.compile(r"(\d{1,3})\s*分(?!\s*（?\s*满分\s*5)")

# '满分 X' where X != 5 is suspicious — only the rubric uses 满分 5 分 meaningfully.
_BAD_FULL_MARKS_PATTERN = re.compile(r"满分\s*([0-9]+)")


def _collect_percentage_scores(req: StudentAnalysisRequest) -> set[int]:
    """All 0-100 percentage scores that appear in the input."""
    scores: set[int] = set()
    for field in ("avg_score", "best_score", "worst_score"):
        v = getattr(req.stats, field)
        if v is not None:
            scores.add(int(v))
    for a in req.recent_attempts:
        scores.add(int(a.score))
    return scores


def _all_text(resp: StudentAnalysisResponse) -> str:
    return "\n".join(
        [
            *resp.strengths,
            *resp.weaknesses,
            *resp.priority_actions,
            resp.narrative_zh,
        ]
    )


def validate_student_analysis(
    resp: StudentAnalysisResponse,
    req: StudentAnalysisRequest,
) -> list[AnalysisValidationError]:
    """Return a list of errors; empty list means the output is acceptable."""
    errors: list[AnalysisValidationError] = []
    text = _all_text(resp)

    # (1) Invented teacher name
    m = _TEACHER_NAME_PATTERN.search(text)
    if m:
        errors.append(
            AnalysisValidationError(
                code="INVENTED_TEACHER_NAME",
                message=(
                    f"Output invents the teacher's surname: '{m.group(0)}'. "
                    f"Use '您' or '老师' generically instead."
                ),
            )
        )

    # (2) Percentage scores mis-written as '分'
    percent_scores = _collect_percentage_scores(req)
    for score in percent_scores:
        # Skip 5, which collides with legitimate rubric band scores.
        if score == 5:
            continue
        # Match '25 分' / '25分' / '25 点' but NOT inside '25/5 分' rubric contexts.
        pattern = re.compile(rf"(?<![0-9/]){score}\s*[分点](?!\s*（?\s*满分\s*5)")
        if pattern.search(text):
            errors.append(
                AnalysisValidationError(
                    code=f"PCT_AS_POINTS_{score}",
                    message=(
                        f"Output writes the percentage score {score}% as "
                        f"'{score} 分' — must be '{score}%' (it is a 0-100 "
                        f"scaled percentage, not a raw point total)."
                    ),
                )
            )

    # (3) '满分 X' where X is 25, 40, 50, 100 etc. — no attempt score is out
    # of those values. Only '满分 5 分' is legal (rubric band).
    for m in _BAD_FULL_MARKS_PATTERN.finditer(text):
        denom = int(m.group(1))
        if denom != 5:
            errors.append(
                AnalysisValidationError(
                    code="BAD_FULL_MARKS_DENOMINATOR",
                    message=(
                        f"Output claims '满分 {denom}' — no score in this "
                        f"system is out of {denom}. Attempt scores are 0-100 "
                        f"percentages; only rubric bands are out of 5."
                    ),
                )
            )

    return errors
