"""Post-generation validators for the student-analysis agent.

The LLM has a strong prior for '25 分' style phrasing in Chinese K-12
educational writing. Even with an explicit prompt, deepseek-chat
sometimes converts '25%' in the input to '25 分（满分 25）' in the
output — a dangerous misreading that confuses teachers. These
validators detect common misreadings and let the agent retry.

Score-misreading checks (PCT_AS_POINTS_*, BAD_FULL_MARKS_DENOMINATOR)
are shared with the diagnose summary validator via the
``_score_misreading`` helper module.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.schemas.analysis import StudentAnalysisRequest, StudentAnalysisResponse
from app.validators._score_misreading import check_score_misreading


@dataclass(frozen=True)
class AnalysisValidationError:
    code: str
    message: str


# Chinese surnames we've observed the model invent (non-exhaustive but common).
_TEACHER_NAME_PATTERN = re.compile(
    r"(王|李|张|刘|陈|杨|赵|吴|周|徐|孙|胡|朱|高|林|郭|何|马|罗|黄)老师"
)


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

    # (2) + (3) Score-misreading checks (delegated to shared helper).
    # The helper returns plain strings prefixed with the error code; we
    # split that prefix back into AnalysisValidationError fields so existing
    # callers see the same dataclass shape.
    percent_scores = _collect_percentage_scores(req)
    for raw in check_score_misreading(text, percent_scores):
        # Format produced by the helper is "CODE: message".
        code, _, msg = raw.partition(": ")
        errors.append(
            AnalysisValidationError(code=code, message=msg or raw)
        )

    return errors
