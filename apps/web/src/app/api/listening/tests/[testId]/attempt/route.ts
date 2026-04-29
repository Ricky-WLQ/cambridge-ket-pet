import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { t } from "@/i18n/zh-CN";
import { pickTone } from "@/i18n/voice";
import { derivePortalFromRequest } from "@/i18n/derivePortalFromRequest";

/**
 * POST /api/listening/tests/[testId]/attempt
 *
 * Creates a TestAttempt row for the given Test. Used by the listening flow:
 * the READING branch of /api/tests/generate creates the test and the attempt
 * atomically, but the LISTENING branch only creates the Test (audio is
 * generated asynchronously), so the UI needs to create the attempt separately
 * once the user is ready to enter the runner.
 *
 * Ownership: returns 404 (not 403) when the Test belongs to another user,
 * to avoid test-ID enumeration.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ testId: string }> },
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    const portal = derivePortalFromRequest(req);
    return NextResponse.json(
      { error: pickTone(t.api.unauthorized, portal) },
      { status: 401 },
    );
  }
  const { testId } = await ctx.params;
  const test = await prisma.test.findUnique({ where: { id: testId } });
  if (!test || test.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const attempt = await prisma.testAttempt.create({
    data: {
      userId: userId,
      testId: test.id,
      status: "IN_PROGRESS",
      mode: test.mode,
      startedAt: new Date(),
    },
  });
  return NextResponse.json({ attemptId: attempt.id });
}
