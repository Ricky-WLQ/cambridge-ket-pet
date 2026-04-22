import { redirect } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { t } from "@/i18n/zh-CN";

export default async function TeacherClassesPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user || (user.role !== "TEACHER" && user.role !== "ADMIN")) {
    redirect("/teacher/activate");
  }

  const classes = await prisma.class.findMany({
    where: { teacherId: userId },
    select: {
      id: true,
      name: true,
      inviteCode: true,
      examFocus: true,
      createdAt: true,
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{t.classes.teacher.title}</h1>
          <Link
            href="/teacher/classes/new"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700"
          >
            {t.classes.teacher.createButton}
          </Link>
        </div>

        {classes.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 p-10 text-center">
            <p className="text-sm text-neutral-500">
              {t.classes.teacher.empty}
            </p>
            <Link
              href="/teacher/classes/new"
              className="mt-4 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700"
            >
              {t.classes.teacher.emptyCta}
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {classes.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/teacher/classes/${c.id}`}
                  className="flex items-center justify-between gap-4 rounded-md border border-neutral-200 p-4 transition hover:border-neutral-900 hover:shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {c.name}
                      {c.examFocus && (
                        <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                          {c.examFocus}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {c._count.members} {t.classes.teacher.studentsSuffix} ·{" "}
                      {t.classes.teacher.createdAt}{" "}
                      {c.createdAt.toLocaleDateString("zh-CN")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-neutral-500">
                      {t.classes.teacher.inviteCodeLabel}
                    </div>
                    <div className="font-mono text-lg font-semibold tracking-wider">
                      {c.inviteCode}
                    </div>
                  </div>
                  <span className="text-neutral-400">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
