import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import AssignmentList from "@/components/student/AssignmentList";
import { auth } from "@/lib/auth";
import { getStudentAssignments } from "@/lib/assignments";
import { requireUngated } from "@/lib/diagnose/eligibility";

export default async function PetPortalPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  // Belt-and-suspenders against stale JWT cache: the middleware should have
  // already redirected gated STUDENTs to /diagnose, but the JWT cache may
  // be stale (e.g., a teacher tool reset the user's diagnose mid-session,
  // or this is the first request after generate before update() ran).
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role === "STUDENT") {
    await requireUngated(userId); // throws redirect to /diagnose if gated
  }

  const assignments = await getStudentAssignments(userId, { examType: "PET" });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="mb-2 text-2xl font-semibold">PET 门户</h1>
        <p className="mb-6 text-sm text-neutral-500">
          Cambridge B1 Preliminary · 选择你想练习的题目类型
        </p>

        <AssignmentList examType="PET" assignments={assignments} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/pet/reading/new"
            className="rounded-lg border border-neutral-300 p-5 transition hover:border-neutral-900 hover:shadow-sm"
          >
            <div className="text-lg font-semibold">阅读</div>
            <div className="mt-1 text-xs text-neutral-500">
              Reading · AI 即时生成仿真题
            </div>
          </Link>

          <Link
            href="/pet/writing/new"
            className="rounded-lg border border-neutral-300 p-5 transition hover:border-neutral-900 hover:shadow-sm"
          >
            <div className="text-lg font-semibold">写作</div>
            <div className="mt-1 text-xs text-neutral-500">
              Writing · AI 即时生成写作任务
            </div>
          </Link>

          <Link
            href="/pet/listening/new"
            className="rounded-lg border border-neutral-300 p-5 transition hover:border-neutral-900 hover:shadow-sm"
          >
            <div className="text-lg font-semibold">听力</div>
            <div className="mt-1 text-xs text-neutral-500">
              Listening · AI 即时生成真题听力
            </div>
          </Link>

          <Link
            href="/pet/speaking/new"
            className="rounded-lg border border-neutral-300 p-5 transition hover:border-neutral-900 hover:shadow-sm"
          >
            <div className="text-lg font-semibold">口语</div>
            <div className="mt-1 text-xs text-neutral-500">
              Speaking · 与 AI 考官 Mina 实时对话
            </div>
          </Link>

          <Link
            href="/pet/vocab"
            className="rounded-lg border border-neutral-300 p-5 transition hover:border-neutral-900 hover:shadow-sm"
          >
            <div className="text-lg font-semibold">词汇</div>
            <div className="mt-1 text-xs text-neutral-500">
              Vocabulary · B1 Preliminary 官方词表 · 3,046 词
            </div>
          </Link>

          <Link
            href="/pet/grammar"
            className="rounded-lg border border-neutral-300 p-5 transition hover:border-neutral-900 hover:shadow-sm"
          >
            <div className="text-lg font-semibold">语法</div>
            <div className="mt-1 text-xs text-neutral-500">
              Grammar · B1 Preliminary 官方语法清单 · 21 个主题
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
