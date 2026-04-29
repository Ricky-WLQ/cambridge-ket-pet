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
  const allDone = completedCount === total;

  // The hub has three visual states for the top section:
  //  IN_PROGRESS — slim progress bar + counter; mascot is "thinking"
  //  REPORT_READY — celebration card replaces the progress bar; mascot
  //                  is "celebrating" inside the card; CTA is the obvious
  //                  next action so we don't repeat it as a separate pill
  //  REPORT_FAILED — same hero shape but rose-tinted with a retry hint
  //
  // The 100%-filled progress bar at 6/6 is intentionally hidden — at
  // completion the success card carries the visual emphasis instead of
  // a solid black slab.

  return (
    <div className="flex flex-col gap-3.5">
      {/* Compact hero strip: mascot + week pill. Only renders the
          mascot+title row when we're NOT in a terminal state (the
          terminal-state hero card below carries its own mascot). */}
      {!reportReady && !reportFailed && (
        <div className="flex items-center gap-3 px-2">
          <Mascot
            pose="thinking"
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
      )}

      {/* Slim progress bar — only while in progress. */}
      {!allDone && (
        <div className="mx-2 h-2 overflow-hidden rounded-full bg-mist border border-ink/10">
          <div
            className="h-full bg-ink rounded-full transition-all"
            style={{ width: `${(completedCount / total) * 100}%` }}
          />
        </div>
      )}

      {/* Hero success card: replaces the progress bar at 6/6 with
          report-ready. Mascot celebrating + headline + prominent CTA. */}
      {reportReady && testId && (
        <Link
          href={`/diagnose/report/${testId}`}
          className="mx-2 group flex items-center gap-4 rounded-3xl border-2 border-ink/10 bg-gradient-to-br from-mint-tint via-butter-tint to-peach-tint p-4 sm:p-5 stitched-card hover:border-ink transition cursor-pointer"
        >
          <Mascot
            pose="celebrating"
            portal={portal}
            width={88}
            height={88}
            decorative
            className="shrink-0 drop-shadow-sm"
          />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-ink/55">
              {t.diagnose.weekRange(weekStart, weekEnd)} · {examType}
            </div>
            <div className="mt-0.5 text-lg sm:text-xl font-extrabold leading-tight">
              本周诊断完成 {completedCount}/{total}
            </div>
            <div className="mt-0.5 text-sm font-medium text-ink/70">
              点这里看你的本周 AI 报告
            </div>
          </div>
          <span className="hidden sm:inline-flex shrink-0 items-center justify-center rounded-full bg-ink text-white text-sm font-extrabold px-5 py-2.5 group-hover:bg-ink/90 transition shadow-sm whitespace-nowrap">
            查看报告 →
          </span>
        </Link>
      )}

      {/* Hero failure card: 6/6 done but AI report failed. Same shape
          as success but rose-tinted; back to /diagnose retries via the
          finalize trigger on next render. */}
      {reportFailed && (
        <div className="mx-2 flex items-center gap-4 rounded-3xl border-2 border-rose-200 bg-rose-50 p-4 sm:p-5 stitched-card">
          <Mascot
            pose="confused"
            portal={portal}
            width={72}
            height={72}
            decorative
            className="shrink-0 drop-shadow-sm"
          />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700/70">
              {t.diagnose.weekRange(weekStart, weekEnd)} · {examType}
            </div>
            <div className="mt-0.5 text-base font-extrabold leading-tight text-rose-800">
              {t.diagnose.reportFailedHint}
            </div>
          </div>
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
