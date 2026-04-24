import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteCtx {
  params: Promise<{ attemptId: string }>;
}

export async function GET(_req: Request, ctx: RouteCtx) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { attemptId } = await ctx.params;

  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    select: {
      userId: true,
      speakingStatus: true,
      rubricScores: true,
      speakingError: true,
    },
  });
  if (!attempt || attempt.userId !== userId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    speakingStatus: attempt.speakingStatus,
    rubricScores: attempt.rubricScores ?? null,
    speakingError: attempt.speakingError ?? null,
  });
}
