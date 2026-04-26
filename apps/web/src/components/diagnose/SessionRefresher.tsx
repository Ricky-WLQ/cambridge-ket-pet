"use client";

/**
 * Session refresher for the diagnose-gate JWT cache (C4).
 *
 * Problem this solves
 * --------------------
 * The diagnose-gate stores `requiredDiagnoseId` on the JWT (see
 * `apps/web/src/lib/auth.ts`). After the user finishes the 6th diagnose
 * section, the server-side row transitions to status=COMPLETE (and then
 * REPORT_READY after the finalize pipeline), which means the user is
 * unblocked at the DB layer. BUT — the JWT cache still holds the old
 * `requiredDiagnoseId` value, so middleware will keep redirecting the user
 * to /diagnose when they try to navigate to /ket or /pet routes.
 *
 * The JWT callback only refreshes its cached values when it receives a
 * `trigger === "update"` signal. NextAuth.js v5 surfaces this via a POST
 * to its session endpoint, which causes the JWT to be re-encoded with
 * trigger="update" — and our jwt callback's update branch re-reads
 * getRequiredDiagnoseId(userId), which now returns null.
 *
 * Why a fetch (not useSession().update())
 * ----------------------------------------
 * This codebase doesn't mount a `<SessionProvider>` at the root layout
 * (server-side `auth()` is used everywhere instead), so useSession() would
 * throw at runtime. The fetch-based path is officially supported by
 * NextAuth.js — internally `useSession().update()` does the same POST.
 *
 * Mounting strategy
 * -----------------
 * The hub page mounts this component with `shouldRefresh={true}` whenever
 * the WeeklyDiagnose row's status is COMPLETE / REPORT_READY / REPORT_FAILED
 * (the three "ungated" statuses). On the first mount the effect fires the
 * POST once; the JWT callback re-reads `getRequiredDiagnoseId(userId)` which
 * now returns null, and the next nav respects the unblocked state.
 *
 * After the POST succeeds we set a session-storage flag so a subsequent
 * navigation back to /diagnose doesn't re-fire the refresh.
 */

import { useEffect } from "react";

interface Props {
  /**
   * True iff the parent has detected a gate-release-eligible status
   * (COMPLETE / REPORT_READY / REPORT_FAILED). The effect fires the JWT
   * refresh the first time this is true within a browser session.
   */
  shouldRefresh: boolean;
  /**
   * Cache key (typically the WeeklyDiagnose id) used to dedupe the refresh
   * across page navigations. If the same id is seen again in this browser
   * session, the refresh is skipped.
   */
  weeklyDiagnoseId: string;
}

const SS_KEY_PREFIX = "diagnose-jwt-refreshed:";

export default function SessionRefresher({
  shouldRefresh,
  weeklyDiagnoseId,
}: Props) {
  useEffect(() => {
    if (!shouldRefresh) return;
    const key = `${SS_KEY_PREFIX}${weeklyDiagnoseId}`;
    if (typeof window === "undefined") return;
    try {
      if (window.sessionStorage.getItem(key) === "1") return;
    } catch {
      // sessionStorage unavailable (private browsing, etc.); proceed without dedup.
    }

    // POST to the NextAuth.js session endpoint with no body — this is the
    // signal NextAuth.js uses to fire trigger="update" in the jwt callback.
    void fetch("/api/auth/session", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then((res) => {
        if (res.ok) {
          try {
            window.sessionStorage.setItem(key, "1");
          } catch {
            // ignore — dedup is best-effort
          }
        }
      })
      .catch((err) => {
        console.error("[diagnose] JWT refresh failed:", err);
      });
  }, [shouldRefresh, weeklyDiagnoseId]);
  return null;
}
