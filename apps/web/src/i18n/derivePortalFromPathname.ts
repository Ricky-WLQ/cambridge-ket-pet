import type { Portal } from "./voice";

/**
 * Resolve the active portal from a Next.js URL pathname.
 *
 * - `/ket` and `/ket/*` → "ket"
 * - `/pet` and `/pet/*` → "pet"
 * - Anything else → "ket" (the kid voice is more inviting for un-routed pages
 *   like landing / login / signup; spec §5.2)
 */
export function derivePortalFromPathname(pathname: string): Portal {
  if (pathname === "/pet" || pathname.startsWith("/pet/")) return "pet";
  if (pathname === "/ket" || pathname.startsWith("/ket/")) return "ket";
  return "ket";
}
