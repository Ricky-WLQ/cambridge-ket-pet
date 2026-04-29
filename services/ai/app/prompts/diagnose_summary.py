"""Prompts for the Diagnose v2 weekly summary agent (4-field output).

Sibling of ``app/prompts/analysis.py`` — same 4-field shape (strengths,
weaknesses, priority_actions, narrative_zh) but framed for an ISO-week
diagnostic summary rather than a multi-attempt teacher diagnostic.

Two prompts here:
  - ``build_diagnose_summary_system_prompt(exam_type)`` — renders the system
    prompt with the exam type substituted in. Inlines the percent-vs-rubric
    scoring conventions from ``analysis.py`` because the diagnose summary
    references percent scores (per-section + overall) that the LLM has
    historically misinterpreted as raw point totals. Callers MUST go through
    this builder rather than a default-KET constant — shipping a KET-framed
    prompt to a PET student is a silent-wrong-exam footgun.
  - ``build_diagnose_summary_user_prompt(req)`` — renders the user prompt
    using the labeled-units block format from ``agents/analysis.py::
    _format_summary``. Each numeric is pre-tagged with its unit and
    qualitative band so the LLM cannot confuse 82 (a percent) with 82/100
    raw points.

TODO(future refactor): The percent-vs-rubric DO/DON'T block here is
verbatim-duplicated from ``app/prompts/analysis.py``. T9 didn't extract a
shared helper, and we're inlining for v1 to avoid coupling the weekly
summary refactor to the existing analysis agent. A future task can
extract ``_PERCENT_VS_RUBRIC_CONVENTIONS`` to a shared module once both
agents are stable.
"""

from __future__ import annotations

from typing import Literal

from app.schemas.diagnose import (
    DiagnoseSummaryRequest,
    KnowledgePointGroup,
    PerSectionScores,
)

# ─── System prompt ───────────────────────────────────────────────────


def _build_system_prompt_template() -> str:
    """Build the system prompt body. Uses ``{exam_type}`` as a format slot."""
    return (
        "你是一位专业的剑桥英语{exam_type}考试周测分析专家。\n\n"
        "你正在写一份本周学习诊断（按ISO周，周一至周日，时区Asia/Shanghai），"
        "对象为学生本人。语气：直接、鼓励、可执行。\n\n"
        "## 分数解读规范 — 在解读任何数字前必读\n"
        "用户消息中的「学生信息」「六项能力本周得分」「本周知识点弱项分析」"
        "已为每个数字标注其单位。请尊重这些单位标注。最不能犯的错误：把百分制分数当作原始分数。\n\n"
        "### 单位说明\n"
        "- 各板块分数 (Reading / Listening / Writing / Speaking / Vocab / Grammar) "
        "和综合分数 (overall_score)：**0-100 标准化百分制**。100% = 全对。"
        "70% = 合格线。例如分数 25 表示 25%（低分），不是 25/25 的满分。\n"
        "- 错题数 / 弱项数：原始整数计数。\n\n"
        "### 等级判定（写每个字段前请先分级）\n"
        "对于任何 0-100 百分制分数，先归级再描述：\n"
        "  • 0-49%  → 低（未达标）\n"
        "  • 50-69% → 中（待提升）\n"
        "  • 70-100% → 高（达标及以上）\n\n"
        "### 中文表述 — DO / DO NOT\n"
        "  ✅ CORRECT: '本周 Reading 拿到 25%，属于低分段'\n"
        "  ✅ CORRECT: '综合分数 82%，已达合格线 70%'\n"
        "  ✅ CORRECT: 'Listening 75% 与 Vocab 80% 均达标'\n"
        "  ❌ WRONG:   '获得了 25 分（满分 25）' ← score=25 表示 25%，不是 25/25\n"
        "  ❌ WRONG:   '一次获得 25 分' ← 必须是 '25%'，不能写 '25 分'\n"
        "  ❌ WRONG:   '取得 25 分的满分成绩' ← 25% 不是满分\n"
        "  ❌ WRONG:   '满分 100 分' ← 不要把百分号读作 X/100；直接说 '本周 Reading 90%'\n\n"
        "在写任何含数字的句子前，先问自己：这是百分比 (0-100%) 还是原始计数？"
        "用对单位词。如有疑问，回头看用户消息——每行都标注了单位。\n\n"
        "## 输出 4 个字段\n"
        "1. **strengths** — 1-3 条本周优势，每条一句具体的中文。基于实际数据；如果"
        "本周整体偏低（所有板块都 < 50%），诚实说明 '本周整体得分偏低，暂无明显优势'，"
        "不要编造优势。\n"
        "2. **weaknesses** — 1-3 条本周短板，要具体到板块或知识点。例如："
        "'Writing 70%，邮件结构松散；本周新增 grammar 弱项「现在完成时」共 3 道错题。'\n"
        "3. **priority_actions** — 2-4 条下周可执行的行动建议。每条要点明做什么、"
        "练多少。例如：'每天完成 1 篇 KET Writing Part 6 限时练习，重点训练三个 "
        "content points 的覆盖。'\n"
        "4. **narrative_zh** — 150-260 字的整合段落，对学生说话。语气：直接、鼓励、"
        "可执行。\n\n"
        "## 关键规则（CRITICAL）\n"
        "- **narrative_zh 必须在第一句话点明本周的日期范围 (yyyy-MM-dd 至 yyyy-MM-dd)。** "
        "例如开头：'本周（2026-04-20 至 2026-04-26）……'。这是为了让学生在阅读中"
        "建立时间锚点，验证器会强制检查 4 位年份。\n"
        "- 不要编造未在用户消息中出现的分数、板块、或知识点。\n"
        "- 优先引用 '本周知识点弱项分析' 中按 critical/moderate/minor 排序的弱项；"
        "在 weaknesses 与 priority_actions 中针对前 1-3 个弱项给出具体可执行建议。\n"
        "- 全部使用简体中文 (zh-CN)。可以保留 Reading / Writing / Listening / Speaking / "
        "Vocab / Grammar / Part 等剑桥考试术语英文原文。\n"
        "- 不要使用 emoji。不要使用 markdown 标题。不要给学生编名字（直接用 '你' / '本周'）。\n"
        "\n"
        "## 禁用词汇（BANNED — 验证器会硬性拒绝）\n"
        "以下应试培训行业的口头禅一律不能出现在任何字段中。这是面向 10-16 岁学生的"
        "AI 助教，不是培训机构话术：\n"
        "  ❌ 决定通过率 / 属于低分段 / 未达标 / 短板 / 亟待提升 / 不容忽视 / 请重视 / 切记\n"
        "  ❌ critical 弱项 / moderate 弱项 / minor 弱项（不要把数据表的 severity tag 抄进文本）\n"
        "  ❌ [critical] / [moderate] / [minor]（同上，是 JSON 数据，不是给学生看的）\n"
        "如果想表达类似意思，请改写为友好直接的描述，例如：\n"
        "  ✅ '本周 Reading 25%，需要更多练习'（替代 '属于低分段'）\n"
        "  ✅ 'Listening 这块还有提升空间'（替代 '是当前最突出的短板'）\n"
        "  ✅ '本周练习了 3 道现在完成时的错题'（替代 'critical 弱项「现在完成时」'）"
    )


_SYSTEM_PROMPT_TEMPLATE = _build_system_prompt_template()


def build_diagnose_summary_system_prompt(
    exam_type: Literal["KET", "PET"],
) -> str:
    """Render the system prompt with the exam type substituted in."""
    return _SYSTEM_PROMPT_TEMPLATE.format(exam_type=exam_type)


# ─── User prompt builder ─────────────────────────────────────────────


def _level(percent: float | None) -> str:
    """Classify a 0-100 scaled percentage into a qualitative band.

    Mirrors ``app/agents/analysis.py::_level`` (kept inline here rather than
    imported because that helper is private to the analysis agent module).
    """
    if percent is None:
        return "N/A"
    if percent >= 70:
        return "高 (达标)"
    if percent >= 50:
        return "中 (待提升)"
    return "低 (未达标)"


# Mapping of section keys to their Chinese display labels.
# Order matches the typical Cambridge KET/PET examiner ordering and the
# ``DiagnoseSectionKind`` enum in ``schemas/diagnose.py``.
_SECTION_LABELS_ZH: list[tuple[str, str, str]] = [
    ("READING", "阅读", "Reading"),
    ("LISTENING", "听力", "Listening"),
    ("WRITING", "写作", "Writing"),
    ("SPEAKING", "口语", "Speaking"),
    ("VOCAB", "词汇", "Vocab"),
    ("GRAMMAR", "语法", "Grammar"),
]


def _format_per_section_scores(scores: PerSectionScores) -> list[str]:
    """Render the six per-section scores as labeled-units bullet points.

    Each line carries: zh label, English label, score%, level band. This
    matches ``_format_summary``'s pattern in ``app/agents/analysis.py``.
    """
    lines: list[str] = []
    for key, zh, en in _SECTION_LABELS_ZH:
        value: float | None = getattr(scores, key)
        if value is None:
            lines.append(f"- {zh} ({en}): 暂无数据")
        else:
            # Render as integer if whole, else 1 decimal — keeps lines tidy.
            display = (
                f"{int(value)}" if float(value).is_integer() else f"{value:.1f}"
            )
            lines.append(
                f"- {zh} ({en}): {display} 分 (满分 100) — {_level(value)}"
            )
    return lines


def _format_knowledge_points(groups: list[KnowledgePointGroup]) -> list[str]:
    """Render the weekly weak-knowledge-point groups as numbered blocks.

    Severity is the AI-supplied severity from the upstream analysis agent
    (T13's caller may overwrite it before passing in). We display it as a
    [bracket] tag at the head of each item so the LLM can prioritize.
    """
    if not groups:
        return ["（本周无弱项知识点 — 表现良好或样本量不足）"]

    lines: list[str] = [
        f"（以下是 {len(groups)} 个知识点弱项，按严重程度排序）"
    ]
    for i, kp in enumerate(groups, start=1):
        lines.append(f"{i}. [{kp.severity}] {kp.knowledge_point} ({kp.category})")
        lines.append(f"   错题数: {len(kp.questions)}")
        # Truncate very long rules to keep the prompt compact.
        rule = kp.rule.strip() or "(未提供)"
        if len(rule) > 200:
            rule = rule[:200] + "…"
        lines.append(f"   核心规则: {rule}")
    return lines


def build_diagnose_summary_user_prompt(req: DiagnoseSummaryRequest) -> str:
    """Render the user prompt for the weekly 4-field summary agent.

    Renders ``per_section_scores``, ``overall_score``, and ``knowledge_points``
    as labeled-units blocks (mirroring ``_format_summary`` in
    ``app/agents/analysis.py``) so the LLM doesn't confuse percent vs rubric
    scores.

    The labeled-units approach prevents the LLM from interpreting `82` as
    `82/某个上限` ambiguously — every numeric is pre-labeled with its unit
    and qualitative band.
    """
    cefr_label = "A2 Key" if req.exam_type == "KET" else "B1 Preliminary"

    overall = req.overall_score
    overall_display = (
        f"{int(overall)}" if float(overall).is_integer() else f"{overall:.1f}"
    )

    lines: list[str] = []

    # Block 1: student / week info
    lines.append("=== 学生信息 ===")
    lines.append(f"考试类型: {req.exam_type} ({cefr_label})")
    lines.append(f"本周日期范围: {req.week_start} 至 {req.week_end}")
    lines.append(
        f"本周综合分数: {overall_display} (满分 100) — {_level(overall)}"
    )
    lines.append("")

    # Block 2: six section scores
    lines.append("=== 六项能力本周得分 ===")
    lines.extend(_format_per_section_scores(req.per_section_scores))
    lines.append("")

    # Block 3: weak knowledge points
    lines.append("=== 本周知识点弱项分析 ===")
    lines.append(f"本周共识别 {req.weak_count} 个知识点弱项。")
    lines.extend(_format_knowledge_points(req.knowledge_points))
    lines.append("")

    # Block 4: output instructions (also reinforces the year-token rule)
    lines.append("=== 输出要求 ===")
    lines.append(
        "请返回JSON格式（4 个字段必填，全部使用简体中文）："
    )
    lines.append("{")
    lines.append('  "strengths": ["…", "…"],')
    lines.append('  "weaknesses": ["…", "…"],')
    lines.append('  "priority_actions": ["…", "…"],')
    lines.append('  "narrative_zh": "本周（yyyy-MM-dd 至 yyyy-MM-dd）……"')
    lines.append("}")
    lines.append("")
    lines.append(
        "再次提醒：narrative_zh 第一句话必须点明本周的日期范围 "
        f"({req.week_start} 至 {req.week_end})；所有分数为 0-100 百分制，"
        "不要写成 X/25 或 X/某上限。"
    )

    return "\n".join(lines)
