import { NextResponse } from "next/server";

/**
 * GET /api/speaking/photos/[...key] — DEPRECATED
 *
 * Back-compat shim. Renamed to the generic `/api/r2/[...key]` proxy so
 * the same stream-proxy logic can serve vocab audio MP3s, future
 * grammar audio, etc. — not just speaking photos.
 *
 * Redirects 308 (preserves method + body, signals permanent move) so
 * any browser holding an in-flight session's photoUrls follows over.
 *
 * Location is a server-relative path. Browsers resolve relative
 * Location headers against the request URI per RFC 7231 §7.1.2, which
 * is the only correct shape on platforms whose reverse proxy does not
 * preserve the public Host header (e.g. Zeabur — see the parallel note
 * in `app/api/vocab/audio/[wordId]/route.ts`).
 *
 * Remove this shim once Phase 4 ships and any in-flight Phase 3
 * sessions have completed (≈1-2 weeks of soak).
 */
export function GET(
  _request: Request,
  ctx: { params: Promise<{ key: string[] }> },
): Promise<Response> {
  return ctx.params.then(({ key }) => {
    const newPath = `/api/r2/${key.map(encodeURIComponent).join("/")}`;
    return new NextResponse(null, {
      status: 308,
      headers: { Location: newPath },
    });
  });
}
