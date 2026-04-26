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
              {t.diagnose.pageTitle}
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-indigo-700">
                {examType}
              </span>
            </h1>
            <p className="mt-0.5 text-xs text-indigo-700/80">
              {t.diagnose.pageSubtitle}
            </p>
            <p className="mt-1 text-xs text-indigo-700/70">
              {t.diagnose.weekRange(weekStart, weekEnd)}
            </p>
          </div>

          {reportReady && testId && (
            <Link
              href={`/diagnose/report/${testId}`}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700"
            >
              查看本周诊断报告 →
            </Link>
          )}
        </div>

        {reportFailed && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {t.diagnose.reportFailedHint}
          </div>
        )}
      </div>

      {/* Progress + sections grid. */}
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-neutral-900">
            {t.diagnose.sectionsTitle}
          </h2>
          <div className="text-xs text-neutral-500">
            <span className="font-medium text-neutral-900">
              已完成 {completedCount} / {total}
            </span>
          </div>
        </div>

        {/* Hand-rolled progress bar. */}
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-neutral-200">
          <div
            className="h-full bg-indigo-600 transition-all"
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
            />
          ))}
        </div>
      </div>
    </div>
  );
}
