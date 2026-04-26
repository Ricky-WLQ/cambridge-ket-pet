import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { vocabAudioSignedUrl } from "@/lib/vocab/audio-url";

/**
 * GET /api/vocab/audio/[wordId]
 *
 * Auth-gated 302 redirect to a per-user audio URL for the word's pre-generated
 * Edge-TTS MP3. Reuses the Phase 3 `signR2PublicUrl` helper (via
 * `vocabAudioSignedUrl`) which routes through the existing R2 stream-proxy so
 * the R2 domain stays hidden from Chinese users.
 *
 * Cache-Control is `private, max-age=240` — 4 minutes, intentionally shorter
 * than the 5-minute logical TTL so the browser doesn't reuse a URL after the
 * presign window even if the helper is later swapped for a true presigner.
 *
 * Returns:
 *   401 — no session
 *   404 — word not found, or word has no audioKey yet (audio not generated)
 *   302 — Location: <signed audio URL>
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ wordId: string }> },
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { wordId } = await context.params;

  const word = await prisma.word.findUnique({
    where: { id: wordId },
    select: { id: true, audioKey: true },
  });
  if (!word) {
    return NextResponse.json({ error: "Word not found" }, { status: 404 });
  }
  if (!word.audioKey) {
    return NextResponse.json(
      { error: "Audio not yet generated for this word" },
      { status: 404 },
    );
  }

  const signed = await vocabAudioSignedUrl(word.audioKey);
  // signed is a server-relative path (/api/r2/...); NextResponse.redirect
  // requires absolute. Resolve against the inbound request's origin.
  const absolute = new URL(signed, request.url);
  return NextResponse.redirect(absolute, {
    status: 302,
    headers: { "cache-control": "private, max-age=240" },
  });
}
