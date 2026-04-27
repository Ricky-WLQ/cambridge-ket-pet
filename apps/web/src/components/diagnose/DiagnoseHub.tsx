"use client";

/**
 * Hub UI for /diagnose. Renders the week banner, the 6 section cards, and
 * (when the user's diagnose is REPORT_READY) a CTA to open the report viewer.
 *
 * Why client component: button state and (in Phase 7) a generate-button
 * polling loop. The static rendering is server-friendly but keeping this in
 * one client component keeps the wiring straightforward; the parent page
 * owns the data fetch.
 */
import Link from "next/link";

import { t } from "@/i18n/zh-CN";
import {
  DIAGNOSE_SECTION_KINDS,
  type DiagnoseSectionKind,
} from "@/lib/diagnose/sectionLimits";

import SectionStatusCard, {
  type DiagnoseSectionStatus,
} from "./SectionStatusCard";

export type DiagnoseHubStatus =
  | "NEED_GENERATE"
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETE"
  | "REPORT_READY"
  | "REPORT_FAILED";

interface SectionState {
  status: DiagnoseSectionStatus;
  attemptId: string | null;
}

interface Props {
  weekStart: string;
  weekEnd: string;
  status: DiagnoseHubStatus;
  sections: Record<DiagnoseSectionKind, SectionState>;
  examType: "KET" | "PET";
  /** Parent Test row id — needed to link the report viewer when REPORT_READY. */
  testId?: string | null;
}

const COMPLETED_STATUSES: DiagnoseSectionStatus[] = [
  "SUBMITTED",
  "AUTO_SUBMITTED",
  "GRADED",
];

export default function DiagnoseHub({
  weekStart,
  weekEnd,
  status,
  sections,
  examType,
  testId,
}: Props) {
  const completedCount = DIAGNOSE_SECTION_KINDS.filter((k) =>
    COMPLETED_STATUSES.includes(sections[k].status),
  ).length;
  const total = DIAGNOSE_SECTION_KINDS.length;

  const reportReady = status === "REPORT_READY";
  const reportFailed = status === "REPORT_FAILED";

  return (
    <div className="space-y-6">
      {/* Week + exam header banner. */}
      <div
        className="rounded-3xl border-2 border-ink/10 p-6 sm:p-7 stitched-card relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #ede7ff 0%, #e4efff 100%)",
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-[260px]">
            <div className="flex items-center gap-2.5 mb-3">
              <span
                className="grid h-8 w-8 place-items-center rounded-full bg-ink text-white text-[11px] font-extrabold tracking-wider"
                aria-hidden
              >
                AI
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold">
                <span className="marker-yellow">{t.diagnose.pageTitle}</span>
              </h1>
              <span className="pill-tag bg-white border-2 border-ink/10">
                {examType}
              </span>
            </div>
            <p className="text-sm font-medium text-ink/70 leading-relaxed">
              {t.diagnose.pageSubtitle}
            </p>
            <p className="mt-1 text-xs font-bold text-ink/60">
              {t.diagnose.weekRange(weekStart, weekEnd)}
            </p>
          </div>

          {reportReady && testId && (
            <Link
              href={`/diagnose/report/${testId}`}
              className="rounded-full bg-ink text-white text-sm font-extrabold px-5 py-2.5 hover:bg-ink/90 transition"
            >
              查看本周诊断报告 →
            </Link>
          )}
        </div>

        {reportFailed && (
          <div className="mt-3 rounded-2xl border-2 border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
            {t.diagnose.reportFailedHint}
          </div>
        )}
      </div>

      {/* Progress + sections grid. */}
      <div>
        <div className="mb-3.5 flex items-baseline justify-between">
          <h2 className="text-xl sm:text-2xl font-extrabold">
            <span className="marker-yellow">{t.diagnose.sectionsTitle}</span>
          </h2>
          <div className="text-sm font-bold text-ink/70">
            已完成{" "}
            <span className="text-ink text-base font-extrabold">
              {completedCount} / {total}
            </span>
          </div>
        </div>

        {/* Hand-rolled progress bar. */}
        <div className="mb-5 h-3 w-full overflow-hidden rounded-full bg-mist border-2 border-ink/10">
          <div
            className="h-full bg-ink rounded-full transition-all"
            style={{ width: `${(completedCount / total) * 100}%` }}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DIAGNOSE_SECTION_KINDS.map((kind) => (
            <SectionStatusCard
              key={kind}
              kind={kind}
              status={sections[kind].status}
              attemptId={sections[kind].attemptId}
              weeklyDiagnoseStatus={status}
              testId={testId ?? null}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
