import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/tests/[testId]/status
 *
 * Used by the listening UI to poll for audio generation progress.
 * Returns audio-state fields plus (once READY) the payload + per-segment
 * timestamps so the client can render the player + transcript.
 *
 * Ownership: `Test.userId` is set at creation time, so we compare it
 * directly to the session user. Non-owner requests get 404 (not 403)
 * to prevent test-ID enumeration.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ testId: string }> },
) {
  const { testId } = await params;

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: {
      id: true,
      userId: true,
      kind: true,
      payload: true,
      audioStatus: true,
      audioR2Key: true,
      audioSegments: true,
      audioErrorMessage: true,
      audioGenStartedAt: true,
    },
  });

  if (!test || test.userId !== userId) {
    // Return 404 (not 403) to prevent test-ID enumeration.
    return NextResponse.json({ error: "test_not_found" }, { status: 404 });
  }

  const base = {
    testId: test.id,
    kind: test.kind,
    audioStatus: test.audioStatus,
    audioReady: test.audioStatus === "READY" && !!test.audioR2Key,
    audioError: test.audioErrorMessage,
    audioElapsedMs: test.audioGenStartedAt
      ? Date.now() - test.audioGenStartedAt.getTime()
      : null,
  };

  if (test.audioStatus === "READY") {
    return NextResponse.json({
      ...base,
      payload: test.payload,
      audioSegments: test.audioSegments,
    });
  }

  return NextResponse.json(base);
}
