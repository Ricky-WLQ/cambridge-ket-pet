import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { t } from "@/i18n/zh-CN";
import JoinForm from "./JoinForm";

export default async function MyClassesPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const memberships = await prisma.classMember.findMany({
    where: { userId },
    select: {
      joinedAt: true,
      class: {
        select: {
          id: true,
          name: true,
          examFocus: true,
          teacher: { select: { email: true, name: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return (
    <div className="page-section">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="mb-4 text-3xl sm:text-4xl font-extrabold leading-[1.1] tracking-tight">
          <span className="marker-yellow-thick">{t.classes.student.title}</span>
        </h1>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-ink/55">快速跳转：</span>
          <Link
            href="/ket"
            className="rounded-full border-2 border-ink/15 bg-white px-3.5 py-1.5 text-sm font-bold hover:bg-ink/5 transition"
          >
            KET 门户
          </Link>
          <Link
            href="/pet"
            className="rounded-full border-2 border-ink/15 bg-white px-3.5 py-1.5 text-sm font-bold hover:bg-ink/5 transition"
          >
            PET 门户
          </Link>
          <Link
            href="/history"
            className="rounded-full border-2 border-ink/15 bg-white px-3.5 py-1.5 text-sm font-bold hover:bg-ink/5 transition"
          >
            历史记录
          </Link>
        </div>

        <JoinForm />

        <div className="mt-8">
          {memberships.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-ink/15 bg-white/40 p-10 text-center text-sm font-medium text-ink/55">
              {t.classes.student.empty}
            </div>
          ) : (
            <ul className="space-y-3">
              {memberships.map((m) => (
                <li
                  key={m.class.id}
                  className="rounded-2xl bg-white border-2 border-ink/10 p-4 stitched-card"
                >
                  <div className="flex items-center gap-2 font-extrabold">
                    {m.class.name}
                    {m.class.examFocus && (
                      <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs font-bold text-ink/65">
                        {m.class.examFocus}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs font-medium text-ink/55">
                    {t.classes.student.teacherLabel}
                    {m.class.teacher.name ?? m.class.teacher.email} ·{" "}
                    {t.classes.student.joinedAt}{" "}
                    {m.joinedAt.toLocaleDateString("zh-CN")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
