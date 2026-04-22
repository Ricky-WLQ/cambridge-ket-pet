import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function Home() {
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
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
        <div className="text-lg font-semibold">剑桥 KET / PET</div>
        <nav className="flex items-center gap-3 text-sm">
          {loggedIn ? (
            <>
              <span className="flex items-center gap-2 text-neutral-600">
                {isTeacher && (
                  <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-xs font-medium text-white">
                    教师
                  </span>
                )}
                <span>{dbUser?.email}</span>
              </span>
              <Link
                href="/classes"
                className="text-neutral-700 hover:text-neutral-900"
              >
                我的班级
              </Link>
              {isTeacher ? (
                <Link
                  href="/teacher/classes"
                  className="text-neutral-700 hover:text-neutral-900"
                >
                  教师面板
                </Link>
              ) : (
                <Link
                  href="/teacher/activate"
                  className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
                >
                  申请教师
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
                  退出登录
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-neutral-700 hover:text-neutral-900"
              >
                登录
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-white hover:bg-neutral-700"
              >
                注册
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
        <div className="space-y-4 text-center">
          <h1 className="text-4xl font-bold">剑桥 KET / PET 备考</h1>
          <p className="max-w-lg text-neutral-600">
            AI 生成仿真练习题，紧扣剑桥真题的题型、考点和难点
          </p>
        </div>

        {loggedIn ? (
          <div className="flex gap-4">
            <Link
              href="/ket"
              className="rounded-lg border border-neutral-300 px-8 py-4 text-center transition hover:border-neutral-900 hover:shadow-sm"
            >
              <div className="text-2xl font-semibold">KET</div>
              <div className="text-sm text-neutral-500">剑桥 A2 Key</div>
            </Link>
            <Link
              href="/pet"
              className="rounded-lg border border-neutral-300 px-8 py-4 text-center transition hover:border-neutral-900 hover:shadow-sm"
            >
              <div className="text-2xl font-semibold">PET</div>
              <div className="text-sm text-neutral-500">剑桥 B1 Preliminary</div>
            </Link>
          </div>
        ) : (
          <Link
            href="/signup"
            className="rounded-md bg-neutral-900 px-6 py-3 text-white hover:bg-neutral-700"
          >
            立即开始
          </Link>
        )}
      </main>
    </div>
  );
}
