/**
 * Diagnose-gate middleware (T27).
 *
 * Runs on the Edge runtime — JWT-only, NO Prisma imports. The JWT carries
 * `role` and `requiredDiagnoseId` (refreshed on signIn / update() in the
 * `jwt` callback at `apps/web/src/lib/auth.ts`).
 *
 * Behavior:
 *  - Anonymous users: pass through (existing per-page redirects to /login
 *    handle them).
 *  - TEACHER / ADMIN: pass through unconditionally.
 *  - STUDENT with non-null `requiredDiagnoseId`: redirect to /diagnose.
 *  - STUDENT with null `requiredDiagnoseId`: pass through (unblocked).
 *
 * The matcher excludes:
 *  - `/_next` static / build assets
 *  - `favicon.ico`
 *  - any path containing a file extension (e.g. `*.png`, `*.css`, `*.js`)
 *
 * Allowlist semantics (paths that are safe to access while gated):
 *  - `/diagnose` and sub-pages — the gate's destination.
 *  - `/login`, `/signup` — auth flow.
 *  - `/history`, `/history/*` — historical attempts (read-only, doesn't
 *    bypass the gate's intent).
 *  - `/classes` — student class membership.
 *  - `/teacher/activate` — students applying for teacher role.
 *  - `/teacher/*` — teacher dashboards (already role-gated).
 *  - `/api/auth` — NextAuth endpoints.
 *  - `/api/diagnose` — diagnose endpoints (the gated user must be able to
 *    submit sections).
 *  - `/api/cron` — cron triggers (Bearer-token auth).
 *  - `/api/teacher` — teacher endpoints (role-gated).
 *  - `/api/r2` — signed-URL proxy for assets used during the diagnose runner.
 *  - `/api/speaking/photos` — speaking-section photo prompts used by the
 *    diagnose runner.
 */

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const ALLOW_PATHS = new Set<string>([
  "/login",
  "/signup",
  "/diagnose",
  "/history",
  "/classes",
  "/teacher/activate",
]);

const ALLOW_PREFIXES = [
  "/api/auth",
  "/api/diagnose",
  "/api/cron",
  "/api/teacher",
  "/api/r2",
  "/api/speaking/photos",
  "/_next",
  "/teacher/",
  "/diagnose/",
  "/history/",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allowlisted paths/prefixes pass through.
  if (ALLOW_PATHS.has(pathname)) return;
  if (ALLOW_PREFIXES.some((p) => pathname.startsWith(p))) return;

  // Anonymous users: let per-page redirects handle them (this middleware
  // only enforces the diagnose gate, not auth).
  const u = req.auth?.user as
    | { role?: string; requiredDiagnoseId?: string | null }
    | undefined;
  if (!u) return;

  // Teachers and admins are exempt from the gate.
  if (u.role !== "STUDENT") return;

  // STUDENT with no required diagnose: unblocked.
  if (!u.requiredDiagnoseId) return;

  // Gated: redirect to /diagnose.
  const url = req.nextUrl.clone();
  url.pathname = "/diagnose";
  return NextResponse.redirect(url);
});

export const config = {
  // Match everything except _next, favicon, and any path with a file extension.
  matcher: ["/((?!_next|favicon.ico|.*\\..*).*)"],
};
