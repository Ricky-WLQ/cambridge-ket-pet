import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAudioStream } from "@/lib/audio/r2-client";

/**
 * GET /api/listening/[attemptId]/audio
 *
 * Stream-proxies the listening audio from Cloudflare R2 through Zeabur's
 * Next.js so the R2 domain stays hidden from Chinese users (they only see
 * our Zeabur Singapore endpoint). Forwards the `Range` header so the
 * browser can scrub + resume; R2's `Content-Range`/`Accept-Ranges` are
 * passed back unchanged.
 *
 * Ownership: non-owner attempt IDs return 404 (not 403) to prevent
 * enumeration. A matching attempt whose Test has no audioR2Key returns
 * 404 `audio_not_ready` with a zh-CN message.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ attemptId: string }> },
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { attemptId } = await ctx.params;

  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: { test: true },
  });

  // Ownership check — student owns the attempt. 404 (not 403) on miss to
  // prevent attempt-ID enumeration.
  if (!attempt || attempt.userId !== userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!attempt.test.audioR2Key) {
    return NextResponse.json(
      { error: "audio_not_ready", message: "音频加载失败，请重新生成" },
      { status: 404 },
    );
  }

  const range = req.headers.get("range") ?? undefined;
  const r2Key = attempt.test.audioR2Key;

  let result;
  try {
    result = await getAudioStream({ r2Key, range });
  } catch {
    // One retry on R2 5xx / transient network blip.
    try {
      await new Promise((r) => setTimeout(r, 500));
      result = await getAudioStream({ r2Key, range });
    } catch {
      return NextResponse.json({ error: "r2_error" }, { status: 502 });
    }
  }

  const headers = new Headers();
  headers.set("Content-Type", "audio/mpeg");
  if (result.contentLength !== undefined) {
    headers.set("Content-Length", String(result.contentLength));
  }
  if (result.contentRange) headers.set("Content-Range", result.contentRange);
  if (result.acceptRanges) headers.set("Accept-Ranges", result.acceptRanges);
  else headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, max-age=3600");

  const status = range && result.contentRange ? 206 : 200;
  return new NextResponse(result.stream as unknown as BodyInit, {
    status,
    headers,
  });
}
