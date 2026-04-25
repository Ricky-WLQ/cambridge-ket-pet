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
 * Remove this shim once Phase 4 ships and any in-flight Phase 3
 * sessions have completed (≈1-2 weeks of soak).
 */
export function GET(
  request: Request,
  ctx: { params: Promise<{ key: string[] }> },
): Promise<Response> {
  return ctx.params.then(({ key }) => {
    const url = new URL(request.url);
    const newPath = `/api/r2/${key.map(encodeURIComponent).join("/")}`;
    return NextResponse.redirect(new URL(newPath, url.origin), 308);
  });
}
