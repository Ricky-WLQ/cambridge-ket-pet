/**
 * Diagnose-gate eligibility helpers (T8).
 *
 * Three layers of the diagnose-gate enforcement consume this file:
 *
 *  1. `apps/web/src/lib/auth.ts` — the JWT callback (T26) calls
 *     `getRequiredDiagnoseId(userId)` on signIn / token refresh and stores
 *     the result on the JWT. The middleware (T27) then reads this cached
 *     flag to redirect the user to /diagnose without a DB hit per request.
 *
 *  2. `apps/web/middleware.ts` — reads the JWT-cached flag, so it does
 *     not call this file directly. The flag value is fed by (1).
 *
 *  3. `apps/web/src/app/{ket,pet}/page.tsx` — calls `requireUngated(userId)`
 *     at the top as a per-page belt-and-suspenders. This catches the rare
 *     case where the JWT cache is stale (e.g., after a teacher-tool reset)
 *     by going to the DB directly.
 *
 * Role pre-filter — caller responsibility:
 *  - These functions do NOT check the user's role. The diagnose gate only
 *    applies to STUDENT users; TEACHER and ADMIN are exempt. The caller
 *    (JWT callback, middleware, page) must pre-filter to STUDENT before
 *    calling these helpers.
 *
 * "Three states" of a student this week:
 *  - GATED, NEED_GENERATE: no WeeklyDiagnose row yet for the current ISO
 *    week. The user must visit /diagnose, which will lazily create the row.
 *  - GATED, IN_PROGRESS: a row exists but its status is not yet COMPLETE
 *    or REPORT_READY. The user must finish all 6 sections.
 *  - UNBLOCKED: the row's status is COMPLETE, REPORT_READY, or REPORT_FAILED.
 *    Note that REPORT_FAILED still UNBLOCKS the user — the gate is about
 *    test submission, not about the AI report being available. A failed
 *    AI report does not re-gate the user; they can retry the report from
 *    the report page.
 *
 * Pure decision logic:
 *  - The decision (which of the 3 states applies given a row) is extracted
 *    into `decideGateState(wd)` so it can be unit-tested exhaustively
 *    without hitting Prisma. The DB-touching helpers compose
 *    `findCurrentWeekDiagnose` + `decideGateState`.
 */

import type { WeeklyDiagnose } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentWeekStart } from "./week";

/**
 * Sentinel value returned by `getRequiredDiagnoseId` when the user has no
 * current-week WeeklyDiagnose row yet (so they must visit /diagnose to
 * lazily generate one).
 *
 * Why a sentinel: the JWT cache stores this as a single `string | null`
 * field. A non-null value means "redirect to /diagnose"; null means
 * "unblocked". The middleware can't distinguish "must complete row XYZ"
 * from "must generate a new row" with a single id field — but it doesn't
 * need to: both cases redirect to /diagnose, and the /diagnose hub page
 * decides whether to generate or continue.
 */
export const NEED_GENERATE_SENTINEL = "NEED_GENERATE";

// ─── Pure decision logic (unit-testable) ─────────────────────────────────────

/** The three gate states for a student this ISO week. */
export type GateDecision =
  | { kind: "NEED_GENERATE"; id: null }
  | { kind: "IN_PROGRESS"; id: string }
  | { kind: "UNBLOCKED"; id: string };

/**
 * Pure decision: given a current-week row (or null if none exists),
 * decide which of the three gate states applies.
 *
 * Status mapping:
 *  - null (no row)                → NEED_GENERATE
 *  - PENDING                      → IN_PROGRESS  (gated)
 *  - IN_PROGRESS                  → IN_PROGRESS  (gated)
 *  - COMPLETE                     → UNBLOCKED
 *  - REPORT_READY                 → UNBLOCKED
 *  - REPORT_FAILED                → UNBLOCKED  (AI report failure does not re-gate)
 */
export function decideGateState(wd: WeeklyDiagnose | null): GateDecision {
  if (wd === null) {
    return { kind: "NEED_GENERATE", id: null };
  }
  // COMPLETE, REPORT_READY, REPORT_FAILED all unblock.
  // Only PENDING and IN_PROGRESS keep the user gated.
  if (
    wd.status === "COMPLETE" ||
    wd.status === "REPORT_READY" ||
    wd.status === "REPORT_FAILED"
  ) {
    return { kind: "UNBLOCKED", id: wd.id };
  }
  return { kind: "IN_PROGRESS", id: wd.id };
}

// ─── DB-touching helpers ─────────────────────────────────────────────────────

/**
 * Find the current ISO-week WeeklyDiagnose row for this user, or null if
 * not yet generated.
 *
 * Looks up by the compound unique `userId_weekStart` where weekStart is
 * the Monday-00:00 CST anchor of the calling instant.
 */
export async function findCurrentWeekDiagnose(
  userId: string,
): Promise<WeeklyDiagnose | null> {
  return prisma.weeklyDiagnose.findUnique({
    where: {
      userId_weekStart: {
        userId,
        weekStart: currentWeekStart(),
      },
    },
  });
}

/**
 * True iff the user has completed this week's diagnose AND the report is
 * either ready or pending (i.e., status is COMPLETE or REPORT_READY).
 *
 * Note this is STRICTER than the gate — REPORT_FAILED unblocks the gate
 * (the test was submitted; an AI report failure doesn't re-gate the user)
 * but `isCompletedThisWeek` treats REPORT_FAILED as "not yet successfully
 * completed" because consumers of this helper (e.g., teacher dashboards,
 * "did the student finish their weekly diagnose?" widgets) want a clean
 * success-only signal. Use `decideGateState(...).kind === "UNBLOCKED"`
 * directly for gate semantics.
 *
 * Returns false if no row exists.
 */
export async function isCompletedThisWeek(userId: string): Promise<boolean> {
  const wd = await findCurrentWeekDiagnose(userId);
  return wd?.status === "COMPLETE" || wd?.status === "REPORT_READY";
}

/**
 * Returns the JWT-cache value for the diagnose-gate flag:
 *  - `null` — user is unblocked (already completed this week's diagnose).
 *  - `NEED_GENERATE_SENTINEL` — user has no current-week row yet; must
 *    visit /diagnose to generate.
 *  - `<wd.id>` — user has an in-progress row (PENDING / IN_PROGRESS);
 *    must visit /diagnose to finish.
 *
 * Caller responsibility:
 *  - This function does NOT check the user's role. The caller must
 *    pre-filter: only STUDENT users are subject to the gate.
 *
 * Middleware semantics:
 *  - When the value is non-null, middleware redirects to /diagnose.
 *  - When the value is null, no redirect.
 */
export async function getRequiredDiagnoseId(
  userId: string,
): Promise<string | null> {
  const wd = await findCurrentWeekDiagnose(userId);
  const decision = decideGateState(wd);
  if (decision.kind === "NEED_GENERATE") return NEED_GENERATE_SENTINEL;
  if (decision.kind === "IN_PROGRESS") return decision.id;
  // UNBLOCKED
  return null;
}

/**
 * Per-page belt-and-suspenders: throws a Next.js redirect to /diagnose if
 * the user is gated (no row yet OR row exists with non-completed status).
 *
 * Use at the top of `apps/web/src/app/{ket,pet}/page.tsx` and any other
 * page that the middleware also protects, to catch the rare case where
 * the JWT cache is stale (e.g., after a teacher-tool reset that ran
 * mid-session).
 *
 * Behavior:
 *  - `redirect()` from `next/navigation` throws `NEXT_REDIRECT`, so the
 *    function never returns on the gated path.
 *  - On the unblocked path, returns void.
 *
 * Caller responsibility:
 *  - Pre-filter to STUDENT role. This function does not check role.
 */
export async function requireUngated(userId: string): Promise<void> {
  const wd = await findCurrentWeekDiagnose(userId);
  const decision = decideGateState(wd);
  if (decision.kind !== "UNBLOCKED") {
    redirect("/diagnose");
  }
}
