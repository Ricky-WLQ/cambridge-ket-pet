"""Prompts for the Diagnose v2 wrong-answer → knowledge-point analysis agent.

Ported from the reference project's ``diagnostic-analysis.ts`` batch-analysis
prompt, with three Cambridge adaptations baked in:
  1. Exam frame is ``Cambridge ${exam_type}`` (KET / PET) — KET is A2 Key,
     PET is B1 Preliminary.
  2. The ``translation_skill`` category is replaced by ``cambridge_strategy``
     in the closed-set taxonomy, the user-prompt category bullet list, and
     the JSON output schema. KET/PET have no translation paper; the slot is
     reused for exam-strategy guidance (timing, skimming, distractor
     avoidance, answer-sheet discipline).
  3. The system prompt explicitly tells the model to use Cambridge
     exam-point terminology when justifying ``category`` choices.

Caller (T13's analysis agent) is responsible for:
  - Capping ``wrong_answers`` at 40 BEFORE calling this builder (the schema
    already enforces ``max_length=40`` on ``DiagnoseAnalysisRequest``).
  - Validating the AI's structured output via
    ``app.validators.diagnose.validate_diagnose_analysis``.

The 8-category enum lives in ``app.schemas.diagnose.KnowledgePointCategory``
— if the taxonomy changes, update both files in the same commit.
"""

from __future__ import annotations

from typing import Literal

from app.schemas.diagnose import WrongAnswer

# ─── System prompt ───────────────────────────────────────────────────
#
# The system prompt is a string template with an ``{exam_type}`` placeholder
# that requires runtime substitution. Callers MUST go through
# ``build_diagnose_analysis_system_prompt(exam_type)`` — there is no
# default-KET module-level constant, because shipping a KET-framed prompt
# to a PET student is a silent-wrong-exam footgun that's hard to debug
# from downstream symptoms.

_SYSTEM_PROMPT_TEMPLATE = (
    "你是一位专业的剑桥英语{exam_type}考试分析专家。请分析学生的每一道错题，"
    "识别涉及的知识点，并按知识点分类归纳。回复必须是纯JSON格式。\n\n"
    "剑桥KET（A2 Key）与PET（B1 Preliminary）——请使用剑桥考点术语作为category的归类依据。"
)


def build_diagnose_analysis_system_prompt(
    exam_type: Literal["KET", "PET"],
) -> str:
    """Render the system prompt with the exam type substituted in."""
    return _SYSTEM_PROMPT_TEMPLATE.format(exam_type=exam_type)


# ─── User prompt builder ─────────────────────────────────────────────


def _format_wrong_answer(idx: int, wa: WrongAnswer) -> str:
    """Render one wrong-answer block. Mirrors pretco-app's per-question format.

    Format (matches reference project's ``diagnostic-analysis.ts:210-216``):

        ### 错题{i+1} ({section})
        题目: {questionText}
        学生答案: {userAnswer}
        正确答案: {correctAnswer}
        选项: {options}    # only when options is non-empty
    """
    lines = [
        f"### 错题{idx + 1} ({wa.section})",
        f"题目: {wa.question_text}",
        f"学生答案: {wa.user_answer}",
        f"正确答案: {wa.correct_answer}",
    ]
    if wa.options:
        # MCQ sections — render the options inline as a comma-separated list.
        # Format mirrors how MCQ options appear in apps/web Reading/Listening
        # rendering (each option already contains its "A. ..." prefix).
        lines.append(f"选项: {' | '.join(wa.options)}")
    return "\n".join(lines)


def build_diagnose_analysis_user_prompt(
    exam_type: Literal["KET", "PET"],
    wrong_answers: list[WrongAnswer],
) -> str:
    """Render the user prompt for the wrong-answer → knowledge-point agent.

    Mirrors the reference project's ``analyzeBatch`` user-prompt structure
    (diagnostic-analysis.ts:207-255) but for Cambridge KET/PET context.
    Returns a Chinese-language prompt string ready for the analysis agent.

    Args:
        exam_type: "KET" or "PET" — used in the intro and the level label.
        wrong_answers: pre-batched list of incorrect answers across all
            sections. Caller must cap at 40 entries (schema enforces this).

    The 8 category values must match
    ``app.schemas.diagnose.KnowledgePointCategory`` exactly.
    """
    cefr_label = "A2 Key" if exam_type == "KET" else "B1 Preliminary"

    # Per-question blocks — joined with blank lines for readability.
    error_blocks = "\n\n".join(
        _format_wrong_answer(i, wa) for i, wa in enumerate(wrong_answers)
    )

    return f"""以下是学生在剑桥英语{exam_type}（{cefr_label}）周测诊断中答错的题目。请逐题分析并按知识点归类。

## 错题列表

{error_blocks}

## 知识点分类（category必须是以下8个值之一）

- `grammar` (语法)：时态、语态、从句、非谓语等英语语法规则
- `collocation` (搭配)：动词+介词、形容词+介词、固定搭配等
- `vocabulary` (词汇)：单词含义、词形变化、近义词辨析等
- `sentence_pattern` (句型)：常见英语句型与表达方式
- `reading_skill` (阅读策略)：略读、扫读、推断、主旨大意等阅读技巧
- `listening_skill` (听力策略)：抓关键词、辨别细节、推断说话人意图等听力技巧
- `cambridge_strategy` (剑桥应试策略)：时间分配、答题卡填涂、干扰项识别、剑桥KET/PET题型套路等
- `writing_skill` (写作策略)：邮件/故事/文章写作的结构、衔接词、内容点覆盖等

## 输出格式

请以JSON格式返回分析结果（字段名必须使用 snake_case，与下例完全一致）：
{{
  "knowledge_points": [
    {{
      "knowledge_point": "知识点名称（如：现在完成时、look forward to 搭配）",
      "category": "grammar|collocation|vocabulary|sentence_pattern|reading_skill|listening_skill|cambridge_strategy|writing_skill",
      "mini_lesson": "2-3句话讲解这个知识点的核心规则",
      "rule": "一句话总结规则",
      "example_sentences": [
        "正确例句1 — 中文翻译",
        "正确例句2 — 中文翻译",
        "正确例句3 — 中文翻译"
      ],
      "questions": [
        {{
          "section": "来源板块（READING/LISTENING/WRITING/SPEAKING/VOCAB/GRAMMAR）",
          "question_text": "题目文本",
          "user_answer": "学生答案",
          "correct_answer": "正确答案",
          "why_wrong": "具体解释为什么学生的答案是错的",
          "rule": "适用的规则"
        }}
      ],
      "severity": "critical|moderate|minor"
    }}
  ]
}}

## 要求

1. 每道错题必须归入一个知识点分类
2. 相同知识点的错题归到同一组
3. category必须是以上8个类别之一（注意：使用 cambridge_strategy 而非 translation_skill —— 剑桥KET/PET不考翻译）
4. mini_lesson 要简洁但有教学价值，包含核心规则和易错点
5. example_sentences 提供3个正确用法的例句，附带中文翻译
6. why_wrong 要具体说明学生这道题的错误原因，不要泛泛而谈，并使用剑桥考点术语
7. 如果题目有选项（如A/B/C/D），user_answer 和 correct_answer 必须包含完整选项内容，格式为"A. 选项内容"，不要只写字母
8. severity 根据该知识点关联的错题数量给出："critical"（≥3 题）、"moderate"（=2 题）、"minor"（=1 题）

只返回JSON。"""
