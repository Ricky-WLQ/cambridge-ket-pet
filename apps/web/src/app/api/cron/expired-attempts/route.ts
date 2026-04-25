import { NextRequest, NextResponse } from "next/server";
import { forceSubmitExpired } from "@/lib/cron/expired-attempts";

/**
 * POST /api/cron/expired-attempts
 *
 * Secured by the `x-cron-secret` header (must match `CRON_SECRET` env).
 * Returns `{ forcedSubmitted: N }` — the count of IN_PROGRESS LISTENING
 * attempts that were past the time-limit + grace window and were graded
 * on this tick.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const count = await forceSubmitExpired();
  return NextResponse.json({ forcedSubmitted: count });
}
