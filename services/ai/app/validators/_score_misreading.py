"""Shared score-misreading detector used by both ``analysis`` and ``diagnose``
validators.

Background
----------
The DeepSeek LLM has a strong prior for "25 分" style phrasing in Chinese
K-12 educational writing (where 5-point rubric bands are the norm). When
fed a 0-100 percentage score, the model sometimes confuses the percentage
with a raw point total — emitting "听力得了 25 分（满分 100）" or
"作文得分 25 分（满分 25）" which are both DANGEROUSLY wrong:

  * "25 分" reads to a Chinese teacher as "scored 25 raw points".
  * "满分 25" / "满分 100" / "满分 40" reinforce the misreading by
    inventing a denominator that doesn't exist in the rubric.

The ONLY legitimate use of "X 分（满分 5 分）" is for rubric band scores
(content/communicative/organisation/language each scored 0-5). Anything
else is a hallucination.

Both ``validators/analysis.py`` (StudentAnalysisResponse) and
``validators/diagnose.py`` (DiagnoseSummaryResponse) need to detect this
exact failure mode in their ``narrative_zh`` + bullet-list output, against
the same set of percentage scores referenced in the request. Rather than
duplicate the regex logic, this module provides a single helper.

Public API
----------
``check_score_misreading(text, percentage_scores)`` — given a haystack of
narrative text and the set of int 0-100 percentage scores referenced in
the request, return a list of error strings describing each detected
misreading. Empty list = clean.
"""

from __future__ import annotations

import re

# '满分 X' where X != 5 is suspicious — only the rubric uses 满分 5 分 meaningfully.
_BAD_FULL_MARKS_PATTERN = re.compile(r"满分\s*([0-9]+)")


def check_score_misreading(
    text: str,
    percentage_scores: set[int],
) -> list[str]:
    """Detect percentage-as-points and bogus '满分 X' misreadings.

    Args:
        text: Combined narrative + bullet-list haystack to scan.
        percentage_scores: All 0-100 percentage scores referenced in the
            request (e.g., per_section_scores values, overall_score).
            Each score becomes a regex pattern check.

    Returns:
        List of human-readable error strings, one per detected misreading.
        Empty list when the output looks clean.
    """
    errors: list[str] = []

    # (1) Percentage scores mis-written as '分' / '点'
    for score in percentage_scores:
        # Skip 5, which collides with legitimate rubric band scores.
        if score == 5:
            continue
        # Match '25 分' / '25分' / '25 点' but NOT inside '25/5 分' rubric
        # contexts (the (?<![0-9/]) guard) and not inside a '满分 5' framing
        # (the (?!\s*（?\s*满分\s*5) lookahead).
        pattern = re.compile(
            rf"(?<![0-9/]){score}\s*[分点](?!\s*（?\s*满分\s*5)"
        )
        if pattern.search(text):
            errors.append(
                f"PCT_AS_POINTS_{score}: output writes the percentage score "
                f"{score}% as '{score} 分' — must be '{score}%' (it is a 0-100 "
                f"scaled percentage, not a raw point total)."
            )

    # (2) '满分 X' where X != 5 — only the 5-point rubric is legitimate.
    for m in _BAD_FULL_MARKS_PATTERN.finditer(text):
        denom = int(m.group(1))
        if denom != 5:
            errors.append(
                f"BAD_FULL_MARKS_DENOMINATOR: output claims '满分 {denom}' — "
                f"no score in this system is out of {denom}. Attempt scores "
                f"are 0-100 percentages; only rubric bands are out of 5."
            )

    return errors
