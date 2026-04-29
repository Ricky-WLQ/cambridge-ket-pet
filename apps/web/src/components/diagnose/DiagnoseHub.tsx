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
import { Mascot } from "@/components/Mascot";
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
  const portal = examType === "KET" ? "ket" : "pet";

  return (
    <div className="flex flex-col gap-3.5">
      {/* Compact hero strip: mascot + week pill. */}
      <div className="flex items-center gap-3 px-2">
        <Mascot
          pose={reportReady ? "celebrating" : "thinking"}
          portal={portal}
          width={56}
          height={56}
          className="rounded-xl"
        />
        <div className="flex-1">
          <h1 className="text-base font-extrabold leading-tight">
            {t.diagnose.pageTitle}
            <span className="ml-2 pill-tag bg-white border border-ink/10 align-middle">
              {examType}
            </span>
          </h1>
          <p className="mt-0.5 text-xs font-medium text-ink/60">
            {t.diagnose.weekRange(weekStart, weekEnd)}
          </p>
        </div>
        <div className="text-xs font-extrabold text-ink/70 whitespace-nowrap">
          {completedCount} / {total}
        </div>
      </div>

      {/* Slim progress bar. */}
      <div className="mx-2 h-2 overflow-hidden rounded-full bg-mist border border-ink/10">
        <div
          className="h-full bg-ink rounded-full transition-all"
          style={{ width: `${(completedCount / total) * 100}%` }}
        />
      </div>

      {reportReady && testId && (
        <div className="px-2">
          <Link
            href={`/diagnose/report/${testId}`}
            className="inline-flex rounded-full bg-ink text-white text-sm font-extrabold px-5 py-2.5 hover:bg-ink/90 transition"
          >
            {t.diagnose.viewReport}
          </Link>
        </div>
      )}

      {reportFailed && (
        <div className="mx-2 rounded-2xl border-2 border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
          {t.diagnose.reportFailedHint}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 grow-fill">
        {DIAGNOSE_SECTION_KINDS.map((kind) => (
          <SectionStatusCard
            key={kind}
            kind={kind}
            status={sections[kind].status}
            attemptId={sections[kind].attemptId}
            weeklyDiagnoseStatus={status}
            testId={testId ?? null}
            portal={portal}
          />
        ))}
      </div>
    </div>
  );
}
