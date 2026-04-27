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
    <div className="page-section">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            <span className="marker-yellow-thick">
              {t.classes.teacher.title}
            </span>
          </h1>
          <Link
            href="/teacher/classes/new"
            className="rounded-full bg-ink px-4 py-2 text-sm font-extrabold text-white hover:bg-ink/90 transition"
          >
            {t.classes.teacher.createButton}
          </Link>
        </div>

        {classes.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-ink/15 p-10 text-center">
            <p className="text-sm text-ink/60">{t.classes.teacher.empty}</p>
            <Link
              href="/teacher/classes/new"
              className="mt-4 inline-block rounded-full bg-ink px-4 py-2 text-sm font-extrabold text-white hover:bg-ink/90 transition"
            >
              {t.classes.teacher.emptyCta}
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {classes.map((c, idx) => {
              const tints = [
                "bg-lavender-tint",
                "bg-sky-tint",
                "bg-mint-tint",
                "bg-butter-tint",
                "bg-peach-tint",
                "bg-cream-tint",
              ];
              const tint = tints[idx % tints.length];
              return (
                <li key={c.id}>
                  <Link
                    href={`/teacher/classes/${c.id}`}
                    className={`flex items-center justify-between gap-4 rounded-2xl border-2 border-ink/10 p-4 stitched-card transition hover:border-ink/30 ${tint}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold">
                        {c.name}
                        {c.examFocus && (
                          <span className="ml-2 rounded-full bg-white/70 px-2 py-0.5 text-xs font-bold text-ink/65">
                            {c.examFocus}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs font-medium text-ink/60">
                        {c._count.members} {t.classes.teacher.studentsSuffix} ·{" "}
                        {t.classes.teacher.createdAt}{" "}
                        {c.createdAt.toLocaleDateString("zh-CN")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-ink/60">
                        {t.classes.teacher.inviteCodeLabel}
                      </div>
                      <div className="font-mono text-lg font-extrabold tracking-wider">
                        {c.inviteCode}
                      </div>
                    </div>
                    <span className="text-ink/40">→</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
