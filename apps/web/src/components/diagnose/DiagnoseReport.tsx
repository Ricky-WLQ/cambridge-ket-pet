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

function scoreColorClasses(pct: number): {
  text: string;
  bg: string;
  ring: string;
} {
  if (pct >= 70) {
    return {
      text: "text-emerald-700",
      bg: "bg-emerald-50",
      ring: "ring-emerald-200",
    };
  }
  if (pct >= 50) {
    return {
      text: "text-amber-700",
      bg: "bg-amber-50",
      ring: "ring-amber-200",
    };
  }
  return {
    text: "text-rose-700",
    bg: "bg-rose-50",
    ring: "ring-rose-200",
  };
}

function ringStrokeColor(pct: number): string {
  if (pct >= 70) return "#15803d"; // emerald-700
  if (pct >= 50) return "#b45309"; // amber-700
  return "#b91c1c"; // rose-700
}

/**
 * Hand-rolled SVG score ring. Radius 50, stroke 12. The arc length is the
 * pct of full circumference; the rest is the muted track.
 */
function ScoreRing({ pct }: { pct: number }) {
  const R = 50;
  const stroke = 12;
  const C = 2 * Math.PI * R;
  const dash = (pct / 100) * C;
  const rest = C - dash;
  return (
    <div className="relative inline-flex h-36 w-36 items-center justify-center">
      <svg
        viewBox="0 0 120 120"
        className="h-full w-full -rotate-90"
        aria-hidden
      >
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={stroke}
        />
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke={ringStrokeColor(pct)}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${rest}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div
          className={`font-mono text-3xl font-extrabold ${scoreColorClasses(pct).text}`}
        >
          {pct}
        </div>
        <div className="text-xs font-bold text-ink/60">综合得分</div>
      </div>
    </div>
  );
}

export default function DiagnoseReport({ report, showStudentName }: Props) {
  const sortedKps = report.knowledgePoints
    ? sortBySeverity(report.knowledgePoints)
    : [];

  return (
    <div className="space-y-6">
      {/* Header banner. */}
      <div
        className="rounded-3xl border-2 border-ink/10 p-6 sm:p-7 stitched-card relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #ede7ff 0%, #e4efff 100%)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span
                className="grid h-8 w-8 place-items-center rounded-full bg-ink text-white text-[11px] font-extrabold tracking-wider"
                aria-hidden
              >
                AI
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold">
                <span className="marker-yellow">本周诊断报告</span>
              </h1>
              <span className="pill-tag bg-white border-2 border-ink/10">
                {report.examType}
              </span>
            </div>
            <p className="text-xs font-bold text-ink/60">
              {report.weekStart} 至 {report.weekEnd}
              {showStudentName && report.student.name && (
                <span className="ml-2">· {report.student.name}</span>
              )}
            </p>
          </div>
          {report.overallScore !== null && (
            <ScoreRing pct={report.overallScore} />
          )}
        </div>
        {report.reportError && (
          <div className="mt-3 rounded-2xl border-2 border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
            报告生成出错：{report.reportError}
          </div>
        )}
      </div>

      {/* Per-section score grid. */}
      {report.perSectionScores && (
        <section>
          <h2 className="text-xl sm:text-2xl font-extrabold mb-3">
            <span className="marker-yellow">六项能力本周得分</span>
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
          <h2 className="text-xl sm:text-2xl font-extrabold mb-3">
            <span className="marker-yellow">本周知识点弱项</span>
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
