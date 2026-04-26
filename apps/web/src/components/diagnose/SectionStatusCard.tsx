"use client";

/**
 * One card in the diagnose hub's 6-section grid.
 *
 * Displays the per-section title, a status pill, and an action button:
 *  - NOT_STARTED       → "开始" (links to /diagnose/runner/[section])
 *  - IN_PROGRESS       → "继续" (same target)
 *  - SUBMITTED/GRADED  → "查看作答" → /diagnose/report/[testId] when the
 *                        WeeklyDiagnose has reached REPORT_READY; a
 *                        non-clickable "查看报告生成中…" hint when the row
 *                        is still in COMPLETE awaiting finalize; CTA is
 *                        hidden otherwise (I2).
 *  - AUTO_SUBMITTED    → same as SUBMITTED/GRADED with an "自动提交" pill.
 *
 * Color tokens follow the existing convention in `history/page.tsx`:
 *  - green for completed (GRADED / SUBMITTED for writing — both treated as
 *    "done" from the student's perspective even though writing's AI grade
 *    runs at finalize time)
 *  - amber for in-progress
 *  - blue for auto-submitted (matches "已提交" elsewhere)
 *  - neutral for not-started
 */
import Link from "next/link";

import { t } from "@/i18n/zh-CN";
import type { DiagnoseSectionKind } from "@/lib/diagnose/sectionLimits";

export type DiagnoseSectionStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "AUTO_SUBMITTED"
  | "GRADED";

/**
 * Mirrors `DiagnoseHubStatus` from ./DiagnoseHub. We keep a local copy
 * (rather than importing DiagnoseHub) because SectionStatusCard is a child
 * of DiagnoseHub — pulling the type from the parent would establish a
 * circular import. The shape is stable (matches the WeeklyDiagnoseStatus
 * Prisma enum surface), so duplication is cheap.
 */
type WeeklyDiagnoseStatus =
  | "NEED_GENERATE"
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETE"
  | "REPORT_READY"
  | "REPORT_FAILED";

export const SECTION_TITLE_ZH: Record<DiagnoseSectionKind, string> = {
  READING: "阅读",
  LISTENING: "听力",
  WRITING: "写作",
  SPEAKING: "口语",
  VOCAB: "词汇",
  GRAMMAR: "语法",
};

const SECTION_ICON: Record<DiagnoseSectionKind, string> = {
  READING: "📖",
  LISTENING: "🎧",
  WRITING: "✍",
  SPEAKING: "🎤",
  VOCAB: "🔤",
  GRAMMAR: "📐",
};

const STATUS_PILL: Record<
  DiagnoseSectionStatus,
  { label: string; className: string }
> = {
  NOT_STARTED: {
    label: t.diagnose.notStartedLabel,
    className: "bg-neutral-100 text-neutral-600",
  },
  IN_PROGRESS: {
    label: t.diagnose.inProgressLabel,
    className: "bg-amber-100 text-amber-800",
  },
  SUBMITTED: {
    label: t.diagnose.submittedLabel,
    className: "bg-green-100 text-green-800",
  },
  AUTO_SUBMITTED: {
    label: t.diagnose.autoSubmittedLabel,
    className: "bg-blue-100 text-blue-800",
  },
  GRADED: {
    label: t.diagnose.gradedLabel,
    className: "bg-green-100 text-green-800",
  },
};

interface Props {
  kind: DiagnoseSectionKind;
  status: DiagnoseSectionStatus;
  /** TestAttempt id once the section has been started; null for NOT_STARTED. */
  attemptId: string | null;
  /**
   * Parent WeeklyDiagnose status — used by the "查看作答" CTA to decide whether
   * to link to the report viewer (REPORT_READY) or show a non-clickable
   * "report being generated" hint (COMPLETE) (I2).
   */
  weeklyDiagnoseStatus?: WeeklyDiagnoseStatus;
  /** Parent Test row id — needed to deep-link the report viewer. */
  testId?: string | null;
}

export default function SectionStatusCard({
  kind,
  status,
  attemptId,
  weeklyDiagnoseStatus,
  testId,
}: Props) {
  const title = SECTION_TITLE_ZH[kind];
  const icon = SECTION_ICON[kind];
  const pill = STATUS_PILL[status];

  const isDone =
    status === "GRADED" ||
    status === "SUBMITTED" ||
    status === "AUTO_SUBMITTED";
  const isInProgress = status === "IN_PROGRESS";

  // Section URL — page itself lives at /diagnose/runner/[section] (Phase 7).
  // The URL uses lowercase to match the rest of the app's URL conventions
  // (e.g. /ket/reading/runner/...); the page resolves it back to the uppercase
  // DiagnoseSectionKind enum.
  const sectionUrl = `/diagnose/runner/${kind.toLowerCase()}`;

  // I2: when the section is done the CTA's destination depends on the
  // PARENT WeeklyDiagnose status, not the section's own status:
  //  - REPORT_READY  → link to /diagnose/report/[testId] (real review)
  //  - COMPLETE      → show a non-clickable "查看报告生成中…" hint
  //  - everything else (the report failed, or report not yet generated
  //    because the user pulled this single section ahead of others) →
  //    hide the CTA entirely. Routing back to the section runner here
  //    would be wrong: the section is locked once submitted.
  let ctaMode: "LINK" | "DISABLED" | "HIDDEN";
  let ctaLabel: string;
  let ctaUrl = "/diagnose";
  if (isDone) {
    if (weeklyDiagnoseStatus === "REPORT_READY" && testId) {
      ctaMode = "LINK";
      ctaLabel = t.diagnose.viewAttempt;
      ctaUrl = `/diagnose/report/${testId}`;
    } else if (weeklyDiagnoseStatus === "COMPLETE") {
      ctaMode = "DISABLED";
      ctaLabel = "查看报告生成中…";
    } else {
      ctaMode = "HIDDEN";
      ctaLabel = "";
    }
  } else if (isInProgress) {
    ctaMode = "LINK";
    ctaLabel = t.diagnose.continueSection;
    ctaUrl = sectionUrl;
  } else {
    ctaMode = "LINK";
    ctaLabel = t.diagnose.startSection;
    ctaUrl = sectionUrl;
  }

  // Visual accent for the card border — green for done, amber for in-progress.
  const borderClass = isDone
    ? "border-green-200"
    : isInProgress
      ? "border-amber-200"
      : "border-neutral-200";

  return (
    <div
      className={`flex flex-col gap-3 rounded-md border bg-white p-4 ${borderClass}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden>
            {icon}
          </span>
          <div>
            <div className="text-sm font-semibold text-neutral-900">
              {title}
            </div>
          </div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${pill.className}`}
        >
          {pill.label}
        </span>
      </div>

      {ctaMode === "LINK" && (
        <Link
          href={ctaUrl}
          className={`mt-auto inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium transition ${
            isDone
              ? "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100"
              : "bg-neutral-900 text-white hover:bg-neutral-700"
          }`}
        >
          {ctaLabel}
        </Link>
      )}
      {ctaMode === "DISABLED" && (
        <div className="mt-auto inline-flex items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-500">
          {ctaLabel}
        </div>
      )}
      {/* attemptId surfaced for E2E tests / future deep-links even when CTA is hidden. */}
      {ctaMode === "HIDDEN" && attemptId !== null && (
        <span data-attempt-id={attemptId} className="hidden" aria-hidden />
      )}
    </div>
  );
}
