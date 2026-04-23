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
 * Ownership model note: the `Test` row has no `userId` column (tests are
 * owned-through `TestAttempt`). For listening tests the attempt is only
 * created after the learner starts playing, so during the GENERATING window
 * there is no direct owner link to verify. We therefore:
 *   - Require authentication.
 *   - If any `TestAttempt` exists for this test, require one of them belongs
 *     to the current user.
 *   - Otherwise (common case for still-generating listening tests), accept
 *     the request — test IDs are unguessable cuids.
 * Non-owner requests get 404 (not 403) to prevent enumeration.
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
      kind: true,
      payload: true,
      audioStatus: true,
      audioR2Key: true,
      audioSegments: true,
      audioErrorMessage: true,
      audioGenStartedAt: true,
      attempts: {
        select: { userId: true },
      },
    },
  });

  if (!test) {
    return NextResponse.json({ error: "未找到测试" }, { status: 404 });
  }

  // If any attempts exist, require one of them to belong to the current user.
  if (test.attempts.length > 0) {
    const ownsAttempt = test.attempts.some((a) => a.userId === userId);
    if (!ownsAttempt) {
      // Return 404 rather than 403 to prevent test-ID enumeration.
      return NextResponse.json({ error: "未找到测试" }, { status: 404 });
    }
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
