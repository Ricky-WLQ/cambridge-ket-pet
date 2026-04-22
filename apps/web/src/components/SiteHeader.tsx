import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { t } from "@/i18n/zh-CN";

export async function SiteHeader() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const dbUser = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, email: true, name: true },
      })
    : null;

  const loggedIn = !!dbUser;
  const isTeacher = dbUser?.role === "TEACHER" || dbUser?.role === "ADMIN";

  return (
    <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
      <Link href="/" className="text-lg font-semibold">
        {t.app.name}
      </Link>
      <nav className="flex items-center gap-3 text-sm">
        {loggedIn ? (
          <>
            <span className="flex items-center gap-2 text-neutral-600">
              {isTeacher && (
                <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-xs font-medium text-white">
                  {t.nav.teacherBadge}
                </span>
              )}
              <span>{dbUser?.email}</span>
            </span>
            <Link
              href="/classes"
              className="text-neutral-700 hover:text-neutral-900"
            >
              {t.nav.myClasses}
            </Link>
            {isTeacher ? (
              <Link
                href="/teacher/classes"
                className="text-neutral-700 hover:text-neutral-900"
              >
                {t.nav.teacherPanel}
              </Link>
            ) : (
              <Link
                href="/teacher/activate"
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
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
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
              >
                {t.nav.signOut}
              </button>
            </form>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="text-neutral-700 hover:text-neutral-900"
            >
              {t.nav.login}
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-white hover:bg-neutral-700"
            >
              {t.nav.signup}
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
