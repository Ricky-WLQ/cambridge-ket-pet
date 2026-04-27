import { NextRequest, NextResponse } from "next/server";

import { forceSubmitExpiredDiagnoseSections } from "@/lib/cron/diagnose-expired";

export const maxDuration = 120;

/**
 * POST /api/cron/diagnose-force-submit-expired
 *
 * Cron entrypoint. Mirrors `/api/cron/expired-attempts`:
 *  - Secured by the `x-cron-secret` header (must match `CRON_SECRET` env).
 *  - Returns `{ forcedSubmitted: N }` — the count of IN_PROGRESS DIAGNOSE
 *    section attempts whose deadline + GRACE_SEC has passed and were
 *    auto-graded on this tick.
 *
 * The actual logic lives in `lib/cron/diagnose-expired.ts` so the cron-
 * unauthenticated unit tests can call it directly without spinning up a
 * fetch flow. This route exists purely to gate the helper behind the
 * shared cron secret.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const result = await forceSubmitExpiredDiagnoseSections();
    return NextResponse.json(result);
  } catch (err) {
    console.error("diagnose-force-submit-expired failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
