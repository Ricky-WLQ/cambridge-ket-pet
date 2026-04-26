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
      text: "text-green-700",
      bg: "bg-green-50",
      ring: "ring-green-300",
    };
  }
  if (pct >= 50) {
    return {
      text: "text-amber-700",
      bg: "bg-amber-50",
      ring: "ring-amber-300",
    };
  }
  return {
    text: "text-red-700",
    bg: "bg-red-50",
    ring: "ring-red-300",
  };
}

function ringStrokeColor(pct: number): string {
  if (pct >= 70) return "#15803d"; // green-700
  if (pct >= 50) return "#b45309"; // amber-700
  return "#b91c1c"; // red-700
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
          className={`font-mono text-3xl font-semibold ${scoreColorClasses(pct).text}`}
        >
          {pct}
        </div>
        <div className="text-xs text-neutral-500">综合得分</div>
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
      <div className="rounded-md border border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-purple-50/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold text-indigo-900">
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white"
                aria-hidden
              >
                AI
              </span>
              本周诊断报告
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-indigo-700">
                {report.examType}
              </span>
            </h1>
            <p className="mt-0.5 text-xs text-indigo-700/80">
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
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            报告生成出错：{report.reportError}
          </div>
        )}
      </div>

      {/* Per-section score grid. */}
      {report.perSectionScores && (
        <section>
          <h2 className="mb-3 text-base font-semibold text-neutral-900">
            六项能力本周得分
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DIAGNOSE_SECTION_KINDS.map((kind) => {
              const score = report.perSectionScores![kind as DiagnoseSectionKind];
              const hasScore = typeof score === "number";
              const styles = hasScore
                ? scoreColorClasses(score)
                : {
                    text: "text-neutral-500",
                    bg: "bg-neutral-50",
                    ring: "ring-neutral-200",
                  };
              return (
                <div
                  key={kind}
                  className={`rounded-md p-4 ring-1 ring-inset ${styles.bg} ${styles.ring}`}
                >
                  <div className="text-xs text-neutral-600">
                    {SECTION_TITLE_ZH[kind]}
                  </div>
                  <div
                    className={`mt-1 font-mono text-2xl font-semibold ${styles.text}`}
                  >
                    {hasScore ? `${score}` : "—"}
                    {hasScore && (
                      <span className="ml-1 text-base font-normal text-neutral-500">
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
            accent="bg-green-50 text-green-900 border-green-200"
            badgeColor="bg-green-600"
          />
          <SummaryBlock
            title="薄弱点"
            items={report.summary.weaknesses}
            accent="bg-amber-50 text-amber-900 border-amber-200"
            badgeColor="bg-amber-600"
          />
          <SummaryBlock
            title="重点练习方向"
            items={report.summary.priorityActions}
            accent="bg-blue-50 text-blue-900 border-blue-200"
            badgeColor="bg-blue-600"
          />
          {report.summary.narrativeZh && (
            <div className="rounded-md border border-indigo-200 bg-white p-4">
              <div className="mb-2 text-sm font-semibold text-indigo-900">
                综合评语
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
                {report.summary.narrativeZh}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Knowledge-point clusters. */}
      {sortedKps.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold text-neutral-900">
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
}: {
  title: string;
  items: string[];
  accent: string;
  badgeColor: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={`rounded-md border p-4 ${accent}`}>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span
          className={`inline-block h-2 w-2 rounded-full ${badgeColor}`}
          aria-hidden
        />
        {title}
      </div>
      <ul className="space-y-1.5 text-sm leading-relaxed">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="shrink-0 text-neutral-400">{i + 1}.</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
