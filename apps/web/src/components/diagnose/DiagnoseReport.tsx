"use client";

/**
 * Post-submit report viewer. Reads the payload returned by
 * GET /api/diagnose/me/report/[testId] (T22).
 *
 * Layout:
 *  1. Overall score ring (hand-rolled SVG; matches the no-chart-lib rule).
 *  2. Per-section 6-cell score grid with color thresholds (≥70 green / ≥50 amber / else red).
 *  3. Four-field summary (优势 / 薄弱点 / 重点练习方向 / 综合评语) reusing the
 *     visual idiom from `AnalysisPanel.tsx`.
 *  4. Knowledge-point clusters sorted by severity (critical first), one
 *     `<KnowledgePointCluster>` per group.
 *
 * The component sorts knowledge points by severity locally — the persisted
 * order is whatever the AI emitted, which we don't trust to be sorted.
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

import KnowledgePointCluster from "./KnowledgePointCluster";
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
 * Per-section grid card colors. Soft pastels keyed to score band — low
 * scores get butter (warm encouragement), not rose (failure red). The
 * redesign target is 10–13yr kids; a red number staring back is
 * demoralizing rather than informative.
 */
function scoreColorClasses(pct: number): {
  text: string;
  bg: string;
  ring: string;
} {
  if (pct >= 70) {
    return {
      text: "text-emerald-700",
      bg: "bg-mint-tint",
      ring: "ring-emerald-200",
    };
  }
  if (pct >= 50) {
    return {
      text: "text-amber-700",
      bg: "bg-butter-tint",
      ring: "ring-amber-200",
    };
  }
  // <50%: still warm, not punishing. Peach tint + amber text reads as
  // "more practice needed" rather than "you failed".
  return {
    text: "text-amber-800",
    bg: "bg-peach-tint",
    ring: "ring-amber-200",
  };
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

      {/* Per-section score grid. */}
      {report.perSectionScores && (
        <section>
          <h2 className="px-2 text-base font-extrabold mb-2 text-ink/85">
            六项能力本周得分
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DIAGNOSE_SECTION_KINDS.map((kind) => {
              const score = report.perSectionScores![kind as DiagnoseSectionKind];
              const hasScore = typeof score === "number";
              const styles = hasScore
                ? scoreColorClasses(score)
                : {
                    text: "text-ink/55",
                    bg: "bg-mist",
                    ring: "ring-ink/10",
                  };
              return (
                <div
                  key={kind}
                  className={`rounded-2xl p-4 ring-1 ring-inset ${styles.bg} ${styles.ring}`}
                >
                  <div className="text-xs font-bold text-ink/65">
                    {SECTION_TITLE_ZH[kind]}
                  </div>
                  <div
                    className={`mt-1 font-mono text-2xl font-extrabold ${styles.text}`}
                  >
                    {hasScore ? `${score}` : "—"}
                    {hasScore && (
                      <span className="ml-1 text-base font-normal text-ink/55">
                        / 100
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 4-field AI summary. */}
      {report.summary && (
        <section className="space-y-4">
          <SummaryBlock
            title="优势"
            items={report.summary.strengths}
            accent="bg-emerald-50 text-emerald-900 border-emerald-200"
            badgeColor="bg-emerald-600"
            numberColor="text-emerald-600/70"
          />
          <SummaryBlock
            title="薄弱点"
            items={report.summary.weaknesses}
            accent="bg-amber-50 text-amber-900 border-amber-200"
            badgeColor="bg-amber-600"
            numberColor="text-amber-600/70"
          />
          <SummaryBlock
            title="重点练习方向"
            items={report.summary.priorityActions}
            accent="bg-sky-tint text-sky-900 border-sky-soft"
            badgeColor="bg-blue-600"
            numberColor="text-blue-600/70"
          />
          {report.summary.narrativeZh && (
            <div className="rounded-2xl border-2 border-indigo-200 bg-white p-4 stitched-card">
              <div className="mb-2 text-sm font-extrabold text-indigo-900">
                综合评语
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/85">
                {report.summary.narrativeZh}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Knowledge-point clusters. */}
      {sortedKps.length > 0 && (
        <section>
          <h2 className="px-2 text-base font-extrabold mb-2 text-ink/85">
            本周知识点弱项
          </h2>
          <div className="space-y-3">
            {sortedKps.map((g, i) => (
              <KnowledgePointCluster key={`${g.knowledgePoint}-${i}`} group={g} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryBlock({
  title,
  items,
  accent,
  badgeColor,
  numberColor,
}: {
  title: string;
  items: string[];
  accent: string;
  badgeColor: string;
  numberColor: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={`rounded-2xl border-2 stitched-card p-4 ${accent}`}>
      <div className="mb-2 flex items-center gap-2 text-base font-extrabold">
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${badgeColor}`}
          aria-hidden
        />
        {title}
      </div>
      <ul className="space-y-1.5 text-sm leading-relaxed">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className={`shrink-0 ${numberColor}`}>{i + 1}.</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
