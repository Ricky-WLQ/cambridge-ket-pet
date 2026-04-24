/**
 * R2 public-URL builder for objects whose access is mediated by a
 * Next.js stream-proxy route (rather than pre-signed R2 URLs). This keeps
 * the R2 domain hidden from the browser and matches the Phase 2 listening
 * pipeline's approach.
 *
 * For Phase 3 Speaking photos, the returned URL points at a
 * forthcoming `/api/speaking/photos/[...key]` route (see Phase E). The
 * `ttl` parameter is accepted to preserve the signature expected by
 * call-sites and tests, but is currently a no-op because access is
 * enforced by session auth inside the proxy route rather than by
 * time-limited URL signing.
 *
 * Note: signing via AWS presign is deferred — adding
 * `@aws-sdk/s3-request-presigner` is a separate dep decision. When/if
 * Phase 3 decides to ship a true presigned flow, this function's body
 * can be swapped to call `getSignedUrl(new GetObjectCommand(...))`
 * without touching call-sites.
 */
export function signR2PublicUrl(key: string, _ttlSeconds: number): string {
  // Encode each path segment individually so slashes inside the key are
  // preserved (the stream-proxy route uses a catch-all [...key] segment).
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  return `/api/speaking/photos/${encoded}`;
}
