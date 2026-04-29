import { derivePortalFromPathname } from "./derivePortalFromPathname";
import type { Portal } from "./voice";

/**
 * Resolve the active portal for an API route handler.
 *
 * Strategy: read the `Referer` header — for an API call made from
 * `/ket/listening/new`, the referer is `https://host/ket/listening/new`,
 * which derivePortalFromPathname maps back to "ket". Falls back to "ket"
 * when the header is absent or unparseable (matches the same default the
 * pathname helper uses for un-routed pages like /login).
 *
 * The fallback is intentional: kid voice ("先登录一下哦 →") reads OK to
 * a teen, but the teen voice ("请先登录") reads stiff to a kid. Erring
 * on kid is the safer default.
 */
export function derivePortalFromRequest(req: Request): Portal {
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const url = new URL(referer);
      return derivePortalFromPathname(url.pathname);
    } catch {
      // Malformed referer — fall through to default.
    }
  }
  return "ket";
}
