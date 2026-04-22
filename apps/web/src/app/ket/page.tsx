import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { auth } from "@/lib/auth";

export default async function KetPortalPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <h1 className="mb-2 text-2xl font-semibold">KET 门户</h1>
        <p className="mb-8 text-sm text-neutral-500">
          Cambridge A2 Key · 选择你想练习的题目类型
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/ket/reading/new"
            className="rounded-lg border border-neutral-300 p-5 transition hover:border-neutral-900 hover:shadow-sm"
          >
            <div className="text-lg font-semibold">阅读</div>
            <div className="mt-1 text-xs text-neutral-500">
              Reading · AI 即时生成仿真题
            </div>
          </Link>

          <Link
            href="/ket/writing/new"
            className="rounded-lg border border-neutral-300 p-5 transition hover:border-neutral-900 hover:shadow-sm"
          >
            <div className="text-lg font-semibold">写作</div>
            <div className="mt-1 text-xs text-neutral-500">
              Writing · AI 即时生成写作任务
            </div>
          </Link>

          <div className="rounded-lg border border-dashed border-neutral-300 p-5 opacity-60">
            <div className="text-lg font-semibold">听力</div>
            <div className="mt-1 text-xs text-neutral-500">
              Listening · Phase 2
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-neutral-300 p-5 opacity-60">
            <div className="text-lg font-semibold">口语</div>
            <div className="mt-1 text-xs text-neutral-500">
              Speaking · Phase 3
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
