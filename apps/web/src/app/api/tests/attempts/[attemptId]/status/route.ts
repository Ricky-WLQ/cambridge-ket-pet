import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { t } from "@/i18n/zh-CN";
import { pickTone } from "@/i18n/voice";
import { derivePortalFromRequest } from "@/i18n/derivePortalFromRequest";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ attemptId: string }> },
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
  const { attemptId } = await ctx.params;
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: { test: true },
  });
  if (!attempt || attempt.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const timeLimitSec = Number(process.env.LISTENING_TIME_LIMIT_SEC ?? 1800);
  const elapsedSec = Math.floor(
    (Date.now() - attempt.startedAt.getTime()) / 1000,
  );
  const remainingSeconds = Math.max(0, timeLimitSec - elapsedSec);

  return NextResponse.json({
    attemptId,
    status: attempt.status,
    startedAt: attempt.startedAt,
    elapsedSec,
    remainingSeconds,
    timeLimitSec,
  });
}
