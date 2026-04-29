"use client";

/**
 * Post-submit report viewer. Reads the payload returned by
 * GET /api/diagnose/me/report/[testId] (T22).
 *
 * Three-layer layout (kid-friendly redesign):
 *  1. Hero card — Mascot + reframed headline + small score chip.
 *     Warm butter→peach gradient. Never the harsh red ring of v1.
 *  2. "下周练这 3 个" — top three priorityActions as numbered tinted
 *     cards. The PRIMARY takeaway, replaces the old 4-block summary.
 *  3. "六项练习情况" — 5-star list per section (gamified, scannable
 *     in 3s). Replaces the 6-cell number grid.
 *  4. Collapsible "看看 AI 的详细评语" — narrative + simple list of
 *     weak knowledge points. Hidden by default.
 *
 * Accuracy contract: every datapoint comes from `report` directly.
 * Stars derive from real per-section scores. Top-3 actions are the
 * AI's actual priorityActions[0..2] (no padding when fewer than 3
 * exist). Knowledge-point list shows only category + topic + count,
 * no fabricated severity labels (no "critical 弱项" tags etc.).
 */
import { Mascot, type MascotPose } from "@/components/Mascot";
import {
  type DiagnoseSectionKind,
  DIAGNOSE_SECTION_KINDS,
} from "@/lib/diagnose/sectionLimits";
import { sortBySeverity } from "@/lib/diagnose/severity";
import type {
  DiagnoseSummary,
  KnowledgePointGroup,
  PerSectionScores,
} from "@/lib/diagnose/types";

import { SECTION_TITLE_ZH } from "./SectionStatusCard";

interface ReportPayload {
  weeklyDiagnoseId: string;
  testId: string;
  examType: "KET" | "PET";
  weekStart: string;
  weekEnd: string;
  status: string;
  knowledgePoints: KnowledgePointGroup[] | null;
  summary: DiagnoseSummary | null;
  perSectionScores: PerSectionScores | null;
  overallScore: number | null;
  reportError: string | null;
  student: { id: string; name: string | null };
}

interface Props {
  report: ReportPayload;
  /**
   * When true, renders the student name + role context (teacher or admin
   * viewing). When false (the default), assumes the viewer is the student.
   */
  showStudentName?: boolean;
}

/**
 * Map a 0–100 percentage to a 0–5 star count. Mirrors the mockup's
 * progressive bands so a kid's first attempt at 10–20% still earns
 * one star (acknowledges effort), while ≥80% earns the full 5.
 *
 *   0%      -> 0 stars
 *   1–19%   -> 1
 *   20–39%  -> 2
 *   40–59%  -> 3
 *   60–79%  -> 4
 *   80–100% -> 5
 *
 * `null` means the section was never attempted — caller renders dots.
 */
function scoreToStars(pct: number | null): number {
  if (pct === null) return 0;
  if (pct <= 0) return 0;
  if (pct < 20) return 1;
  if (pct < 40) return 2;
  if (pct < 60) return 3;
  if (pct < 80) return 4;
  return 5;
}

/**
 * Mascot pose for the report hero. Never `confused` (judgmental on the
 * student) — use `reading` at low/mid bands ("we're going through this
 * together") and `celebrating` only when the score genuinely earns it.
 */
function poseForScore(score: number | null): MascotPose {
  if (score === null) return "reading";
  if (score >= 70) return "celebrating";
  return "reading";
}

/**
 * Reframe the headline by score band. A 10-year-old seeing 16/100 needs
 * "this is your starting point" energy, not "you scored 16". The number
 * itself appears as a small inline chip; the headline carries the tone.
 */
function getReportFraming(score: number | null): {
  headline: string;
  subtitle: string;
} {
  if (score === null) {
    return { headline: "本周诊断报告", subtitle: "AI 报告还在生成…" };
  }
  if (score >= 70) {
    return {
      headline: "本周做得很棒！",
      subtitle: "继续保持，看看下面的练习方向",
    };
  }
  if (score >= 50) {
    return {
      headline: "本周已经走在路上了",
      subtitle: "再练几个重点，下周会更稳",
    };
  }
  return {
    headline: "这是本周的起点",
    subtitle: "一步步来，下面有具体可以练的方向",
  };
}

export default function DiagnoseReport({ report, showStudentName }: Props) {
  const sortedKps = report.knowledgePoints
    ? sortBySeverity(report.knowledgePoints)
    : [];
  const portal = report.examType === "KET" ? "ket" : "pet";
  const framing = getReportFraming(report.overallScore);

  return (
    <div className="flex flex-col gap-4">
      {/* Hero card: mascot + reframed headline + small score chip. The
          score number is intentionally a small inline chip rather than a
          big red ring — the headline carries the tone, the number is just
          honest data. Warm butter→peach gradient avoids the "you failed"
          energy a red number would project on a 10–13yr student. */}
      <div className="rounded-3xl bg-gradient-to-br from-butter-tint to-peach-tint border-2 border-ink/10 p-4 sm:p-5 stitched-card">
        <div className="flex items-center gap-3 sm:gap-4">
          <Mascot
            pose={poseForScore(report.overallScore)}
            portal={portal}
            width={88}
            height={88}
            decorative
            className="shrink-0 drop-shadow-sm"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-extrabold leading-tight">
                {framing.headline}
              </h1>
              <span className="pill-tag bg-white border border-ink/10">
                {report.examType}
              </span>
            </div>
            <p className="mt-0.5 text-xs sm:text-sm font-medium text-ink/65">
              {framing.subtitle}
            </p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {report.overallScore !== null && (
                <span className="inline-flex items-baseline gap-1.5 rounded-full bg-white border border-ink/10 px-3 py-1">
                  <span className="text-[11px] font-bold text-ink/55">
                    综合得分
                  </span>
                  <span className="font-mono text-base font-extrabold text-ink">
                    {report.overallScore}
                  </span>
                  <span className="text-[11px] text-ink/40">/100</span>
                </span>
              )}
              <span className="text-[11px] font-medium text-ink/55">
                {report.weekStart} 至 {report.weekEnd}
                {showStudentName && report.student.name && (
                  <span className="ml-1">· {report.student.name}</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {report.reportError && (
        <div className="mx-2 rounded-2xl border-2 border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
          报告生成出错：{report.reportError}
        </div>
      )}

      {/* Top 3 priority actions — the primary takeaway. Only renders
          if the AI actually returned actions (no padding, no fakes). */}
      {report.summary && report.summary.priorityActions.length > 0 && (
        <ActionsCard actions={report.summary.priorityActions.slice(0, 3)} />
      )}

      {/* Six sections as a 5-star scannable list. */}
      {report.perSectionScores && (
        <SectionStarsCard scores={report.perSectionScores} />
      )}

      {/* Collapsible details — the verbose AI text + KP list, hidden
          by default. Only rendered if there's something to put in. */}
      {(report.summary || sortedKps.length > 0) && (
        <DetailsCollapsible
          summary={report.summary}
          knowledgePoints={sortedKps}
        />
      )}
    </div>
  );
}

// ── Top 3 actions ──────────────────────────────────────────────────────

const ACTION_TINTS = ["bg-lavender-tint", "bg-sky-tint", "bg-mint-tint"] as const;

function ActionsCard({ actions }: { actions: string[] }) {
  return (
    <section className="rounded-3xl border-2 border-ink/10 bg-white stitched-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-extrabold text-ink">
          下周练这{" "}
          <span className="font-mono">{actions.length}</span> 个
        </h2>
        <span className="text-xs font-bold text-ink/55">优先级排序</span>
      </div>
      <ol className="space-y-2.5">
        {actions.map((action, idx) => (
          <li
            key={idx}
            className={`flex items-start gap-3 rounded-2xl border-2 border-ink/10 p-3.5 stitched-card ${ACTION_TINTS[idx % ACTION_TINTS.length]}`}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-extrabold text-white">
              {idx + 1}
            </span>
            <p className="flex-1 min-w-0 text-sm font-bold leading-relaxed text-ink/90 whitespace-pre-wrap">
              {action}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ── Six sections — 5-star list ─────────────────────────────────────────

function SectionStarsCard({ scores }: { scores: PerSectionScores }) {
  return (
    <section className="rounded-3xl border-2 border-ink/10 bg-white stitched-card p-5">
      <h2 className="mb-3 text-base font-extrabold text-ink">六项练习情况</h2>
      <div className="space-y-2.5">
        {DIAGNOSE_SECTION_KINDS.map((kind) => (
          <SectionStarRow
            key={kind}
            kind={kind as DiagnoseSectionKind}
            score={scores[kind as DiagnoseSectionKind] ?? null}
          />
        ))}
      </div>
      <p className="mt-3 text-xs font-medium text-ink/55">
        五颗星表示满分 · 三颗星即为达标
      </p>
    </section>
  );
}

function SectionStarRow({
  kind,
  score,
}: {
  kind: DiagnoseSectionKind;
  score: number | null;
}) {
  const stars = scoreToStars(score);
  const attempted = score !== null;
  return (
    <div className="flex items-center gap-3">
      <div className="w-12 shrink-0 text-sm font-extrabold text-ink">
        {SECTION_TITLE_ZH[kind]}
      </div>
      <div
        className="flex-1 flex items-center gap-1 text-2xl leading-none tracking-wider"
        aria-label={attempted ? `${stars} of 5 stars` : "not attempted"}
      >
        {attempted
          ? Array.from({ length: 5 }).map((_, i) => (
              <span
                key={i}
                className={i < stars ? "text-amber-500" : "text-ink/15"}
                aria-hidden
              >
                ★
              </span>
            ))
          : Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className="text-ink/15" aria-hidden>
                ·
              </span>
            ))}
      </div>
      <div
        className={`w-12 shrink-0 text-right font-mono text-sm font-extrabold ${attempted ? (stars >= 3 ? "text-amber-700" : "text-ink/40") : "text-ink/40"}`}
      >
        {attempted ? `${Math.round(score)}%` : "—"}
      </div>
    </div>
  );
}

// ── Collapsible details ────────────────────────────────────────────────

const KP_CATEGORY_ZH: Record<string, string> = {
  grammar: "语法",
  collocation: "搭配",
  vocabulary: "词汇",
  sentence_pattern: "句型",
  reading_skill: "阅读",
  listening_skill: "听力",
  cambridge_strategy: "考试策略",
  writing_skill: "写作",
};

function DetailsCollapsible({
  summary,
  knowledgePoints,
}: {
  summary: DiagnoseSummary | null;
  knowledgePoints: KnowledgePointGroup[];
}) {
  // Only the narrative + topic list go in here. The 4-block summary
  // (优势/薄弱点/重点练习方向/综合评语) was retired — the top-3 actions
  // card replaces priorityActions, and narrativeZh subsumes the rest
  // by design (the AI prompt instructs it to put strengths/weaknesses
  // into the narrative).
  const hasNarrative = (summary?.narrativeZh.trim().length ?? 0) > 0;
  if (!hasNarrative && knowledgePoints.length === 0) return null;

  return (
    <details className="rounded-3xl border-2 border-ink/10 bg-white stitched-card group">
      <summary className="flex cursor-pointer items-center justify-between p-4 sm:p-5 list-none">
        <span className="text-base font-extrabold text-ink">
          看看 AI 的详细评语
        </span>
        <span
          className="text-xl text-ink/55 transition-transform group-open:rotate-180"
          aria-hidden
        >
          ⌄
        </span>
      </summary>
      <div className="border-t-2 border-ink/10 p-5 space-y-4">
        {hasNarrative && summary && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/90">
            {summary.narrativeZh}
          </p>
        )}
        {knowledgePoints.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-extrabold text-ink">
              本周想多练的知识点
            </div>
            <ul className="space-y-1.5">
              {knowledgePoints.map((kp, i) => (
                <KnowledgePointItem
                  key={`${kp.knowledgePoint}-${i}`}
                  group={kp}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

// ── Per-knowledge-point expandable item ────────────────────────────────

const SECTION_LABEL_ZH: Record<string, string> = {
  READING: "阅读",
  LISTENING: "听力",
  WRITING: "写作",
  SPEAKING: "口语",
  VOCAB: "词汇",
  GRAMMAR: "语法",
};

function KnowledgePointItem({ group }: { group: KnowledgePointGroup }) {
  // Collapsed by default. Expanded view shows the AI's mini-lesson
  // (1–2 sentences) plus each wrong question with the user's actual
  // answer, the correct answer, and the why_wrong from the agent.
  // No fabrication — every field comes straight from `group`.
  const hasMiniLesson = group.miniLesson?.trim().length > 0;
  const questionCount = group.questions.length;
  return (
    <li>
      <details className="group rounded-xl border border-ink/10 bg-mist">
        <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 list-none">
          <span className="pill-tag bg-amber-100 text-amber-800">
            {KP_CATEGORY_ZH[group.category] ?? group.category}
          </span>
          <span className="flex-1 min-w-0 text-sm font-bold text-ink truncate">
            {group.knowledgePoint}
          </span>
          <span className="shrink-0 text-xs font-medium text-ink/55">
            {questionCount} 道错题
          </span>
          <span
            className="shrink-0 text-base text-ink/55 transition-transform group-open:rotate-180"
            aria-hidden
          >
            ⌄
          </span>
        </summary>
        <div className="border-t border-ink/10 p-3 space-y-3 bg-white rounded-b-xl">
          {hasMiniLesson && (
            <p className="text-xs leading-relaxed text-ink/85">
              {group.miniLesson}
            </p>
          )}
          {questionCount > 0 && (
            <ol className="space-y-2">
              {group.questions.map((q, i) => (
                <li
                  key={i}
                  className="rounded-lg border border-ink/10 bg-mist p-2.5 text-xs"
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-ink text-[10px] font-extrabold text-white">
                      {i + 1}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-ink/55">
                      {SECTION_LABEL_ZH[q.section] ?? q.section}
                    </span>
                  </div>
                  <p className="font-medium text-ink/90 leading-relaxed">
                    {q.questionText}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                    <div>
                      <span className="font-bold text-ink/55">你的答案：</span>
                      <span className="text-rose-700 font-bold">
                        {q.userAnswer || "(未作答)"}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-ink/55">正确答案：</span>
                      <span className="text-emerald-700 font-bold">
                        {q.correctAnswer}
                      </span>
                    </div>
                  </div>
                  {q.whyWrong?.trim() && (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-ink/70">
                      <span className="font-bold text-ink/55">为什么：</span>
                      {q.whyWrong}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </details>
    </li>
  );
}
