import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import AssignmentList from "@/components/student/AssignmentList";
import { auth } from "@/lib/auth";
import { getStudentAssignments } from "@/lib/assignments";

export default async function KetPortalPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const assignments = await getStudentAssignments(userId, { examType: "KET" });

  return (
    <div className="page-section">
      <SiteHeader />
      <main className="flex flex-1 flex-col gap-3.5">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-[1.1]">
            <span className="marker-yellow-thick">KET 门户</span>
          </h1>
          <p className="mt-3 text-sm sm:text-base font-medium text-ink/70">
            Cambridge A2 Key · 选择你想练习的题目类型
          </p>
        </div>

        <AssignmentList examType="KET" assignments={assignments} />

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 grow-fill">
          <Link
            href="/ket/reading/new"
            className="skill-tile tile-lavender stitched-card group"
          >
            <div className="flex items-start justify-between">
              <div className="text-3xl" aria-hidden>📖</div>
              <span className="arrow-chip">→</span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-extrabold leading-tight">阅读</div>
              <div className="mt-1.5 text-sm font-medium text-ink/70 leading-snug">
                Reading · AI 即时生成仿真题
              </div>
            </div>
          </Link>

          <Link
            href="/ket/writing/new"
            className="skill-tile tile-butter stitched-card group"
          >
            <div className="flex items-start justify-between">
              <div className="text-3xl" aria-hidden>✍️</div>
              <span className="arrow-chip">→</span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-extrabold leading-tight">写作</div>
              <div className="mt-1.5 text-sm font-medium text-ink/70 leading-snug">
                Writing · AI 即时生成写作任务
              </div>
            </div>
          </Link>

          <Link
            href="/ket/listening/new"
            className="skill-tile tile-sky stitched-card group"
          >
            <div className="flex items-start justify-between">
              <div className="text-3xl" aria-hidden>🎧</div>
              <span className="arrow-chip">→</span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-extrabold leading-tight">听力</div>
              <div className="mt-1.5 text-sm font-medium text-ink/70 leading-snug">
                Listening · AI 即时生成真题听力
              </div>
            </div>
          </Link>

          <Link
            href="/ket/speaking/new"
            className="skill-tile tile-peach stitched-card group"
          >
            <div className="flex items-start justify-between">
              <div className="text-3xl" aria-hidden>🎤</div>
              <span className="arrow-chip">→</span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-extrabold leading-tight">口语</div>
              <div className="mt-1.5 text-sm font-medium text-ink/70 leading-snug">
                Speaking · 与 AI 考官 Mina 实时对话
              </div>
            </div>
          </Link>

          <Link
            href="/ket/vocab"
            className="skill-tile tile-mint stitched-card group"
          >
            <div className="flex items-start justify-between">
              <div className="text-3xl" aria-hidden>🔠</div>
              <span className="arrow-chip">→</span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-extrabold leading-tight">词汇</div>
              <div className="mt-1.5 text-sm font-medium text-ink/70 leading-snug">
                Vocabulary · A2 Key 官方词表 · 1,599 词
              </div>
            </div>
          </Link>

          <Link
            href="/ket/grammar"
            className="skill-tile tile-cream stitched-card group"
          >
            <div className="flex items-start justify-between">
              <div className="text-3xl" aria-hidden>📐</div>
              <span className="arrow-chip">→</span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-extrabold leading-tight">语法</div>
              <div className="mt-1.5 text-sm font-medium text-ink/70 leading-snug">
                Grammar · A2 Key 官方语法清单 · 19 个主题
              </div>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
