import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">我加入的班级</h1>

      <JoinForm />

      <div className="mt-8">
        {memberships.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
            你还没有加入任何班级。使用上方的邀请码加入。
          </div>
        ) : (
          <ul className="space-y-3">
            {memberships.map((m) => (
              <li
                key={m.class.id}
                className="rounded-md border border-neutral-200 p-4"
              >
                <div className="font-medium">
                  {m.class.name}
                  {m.class.examFocus && (
                    <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                      {m.class.examFocus}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  教师：{m.class.teacher.name ?? m.class.teacher.email} · 加入于{" "}
                  {m.joinedAt.toLocaleDateString("zh-CN")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 text-center text-sm">
        <Link href="/" className="text-neutral-500 hover:text-neutral-700">
          ← 返回首页
        </Link>
      </div>
    </div>
  );
}
