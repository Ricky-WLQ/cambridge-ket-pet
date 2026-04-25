/**
 * R2 photo URL builder for Speaking photos. Access is mediated by the
 * `/api/speaking/photos/[...key]` stream-proxy route, which auth-gates
 * requests via Auth.js and streams the R2 object through Zeabur so the
 * R2 domain stays hidden from Chinese users.
 *
 * The returned URL is a server-relative path; the browser resolves it
 * against the current origin. The proxy route auth-checks every request,
 * so no time-limited presigning is needed.
 */
export function signR2PublicUrl(key: string): string {
  // Encode each path segment individually so slashes inside the key are
  // preserved (the stream-proxy route uses a catch-all [...key] segment).
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  return `/api/speaking/photos/${encoded}`;
}
