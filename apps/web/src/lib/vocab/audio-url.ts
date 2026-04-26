/**
 * Vocab audio URL builder.
 *
 * Wraps the Phase 3 `signR2PublicUrl` helper for vocab `Word.audioKey` keys.
 * Centralizes the choice of TTL/cache-control semantics for the
 * `/api/vocab/audio/[wordId]` route in one place.
 *
 * Note: `signR2PublicUrl` does not produce a time-limited presigned URL — it
 * returns a server-relative path to the generic `/api/r2/[...key]`
 * stream-proxy route, which auth-gates every request via Auth.js. We re-use
 * that pattern for vocab audio so the R2 domain stays hidden from Chinese
 * users. The TTL constant below is therefore the suggested client cache
 * window (mirrored in the redirect's `Cache-Control` header), not a real
 * presign expiry.
 */
import { signR2PublicUrl } from "@/lib/r2-signed-url";

/** Suggested client-side cache TTL for vocab audio URLs (5 minutes). */
export const VOCAB_AUDIO_TTL_SECONDS = 60 * 5;

/** Convert a `Word.audioKey` into a per-user URL the browser can `<audio>` from. */
export async function vocabAudioSignedUrl(audioKey: string): Promise<string> {
  return signR2PublicUrl(audioKey);
}
