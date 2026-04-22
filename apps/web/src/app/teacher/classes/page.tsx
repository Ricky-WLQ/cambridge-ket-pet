import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">我的班级</h1>
        <Link
          href="/teacher/classes/new"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700"
        >
          + 创建班级
        </Link>
      </div>

      {classes.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-300 p-10 text-center">
          <p className="text-sm text-neutral-500">你还没有创建任何班级</p>
          <Link
            href="/teacher/classes/new"
            className="mt-4 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700"
          >
            创建第一个班级
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {classes.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-md border border-neutral-200 p-4"
            >
              <div>
                <div className="font-medium">
                  {c.name}
                  {c.examFocus && (
                    <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                      {c.examFocus}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  {c._count.members} 位学生 · 创建于{" "}
                  {c.createdAt.toLocaleDateString("zh-CN")}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-neutral-500">邀请码</div>
                <div className="font-mono text-lg font-semibold tracking-wider">
                  {c.inviteCode}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 text-center text-sm">
        <Link href="/" className="text-neutral-500 hover:text-neutral-700">
          ← 返回首页
        </Link>
      </div>
    </div>
  );
}
