import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { t } from "@/i18n/zh-CN";

export async function SiteHeader() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const requiredDiagnoseId = (
    session?.user as { requiredDiagnoseId?: string | null } | undefined
  )?.requiredDiagnoseId ?? null;

  const dbUser = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, email: true, name: true },
      })
    : null;

  const loggedIn = !!dbUser;
  const isTeacher = dbUser?.role === "TEACHER" || dbUser?.role === "ADMIN";
  // Teachers/admins are exempt from the gate, so no red-dot for them — but
  // we still surface the link so they can navigate to /diagnose for class scope.
  const showGateDot = loggedIn && !isTeacher && requiredDiagnoseId !== null;

  return (
    <header className="site-header">
      <Link href="/" className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink text-white font-extrabold text-sm">
          K
        </span>
        <span className="font-extrabold text-base">{t.app.name}</span>
      </Link>
      <nav className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
        {loggedIn ? (
          <>
            <span className="hidden sm:inline-flex items-center gap-2">
              {isTeacher && (
                <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-extrabold text-white">
                  {t.nav.teacherBadge}
                </span>
              )}
              <span className="rounded-full bg-mist px-3.5 py-1.5 text-ink/70">
                {dbUser?.email}
              </span>
            </span>
            <Link
              href="/history"
              className="rounded-full px-3.5 py-1.5 hover:bg-ink/5 transition"
            >
              {t.nav.history}
            </Link>
            <Link
              href="/diagnose"
              className="relative text-neutral-700 hover:text-neutral-900"
            >
              {t.nav.diagnose}
              {showGateDot && (
                <span
                  className="absolute -right-1.5 -top-0.5 inline-block h-2 w-2 rounded-full bg-red-500"
                  aria-label="本周诊断未完成"
                />
              )}
            </Link>
            <Link
              href="/classes"
              className="rounded-full px-3.5 py-1.5 hover:bg-ink/5 transition"
            >
              {t.nav.myClasses}
            </Link>
            {isTeacher ? (
              <Link
                href="/teacher/classes"
                className="rounded-full px-3.5 py-1.5 hover:bg-ink/5 transition"
              >
                {t.nav.teacherPanel}
              </Link>
            ) : (
              <Link
                href="/teacher/activate"
                className="rounded-full border-2 border-ink/15 px-3.5 py-1.5 text-sm font-bold hover:bg-ink/5 transition"
              >
                {t.nav.applyTeacher}
              </Link>
            )}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="rounded-full border-2 border-ink/15 px-3.5 py-1.5 text-sm font-bold hover:bg-ink/5 transition"
              >
                {t.nav.signOut}
              </button>
            </form>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-full px-3.5 py-1.5 hover:bg-ink/5 transition"
            >
              {t.nav.login}
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-ink px-4 py-1.5 text-white font-extrabold hover:bg-ink/90 transition"
            >
              {t.nav.signup}
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
