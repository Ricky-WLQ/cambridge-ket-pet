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
    <div className="page-section">
      <SiteHeader />
      <main className="flex flex-1 flex-col gap-3.5">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-[1.1]">
            <span className="marker-yellow-thick">PET 门户</span>
          </h1>
          <p className="mt-3 text-sm sm:text-base font-medium text-ink/70">
            Cambridge B1 Preliminary · 选择你想练习的题目类型
          </p>
        </div>

        <AssignmentList examType="PET" assignments={assignments} />

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 grow-fill">
          <Link
            href="/pet/reading/new"
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
            href="/pet/writing/new"
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
            href="/pet/listening/new"
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
            href="/pet/speaking/new"
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
            href="/pet/vocab"
            className="skill-tile tile-mint stitched-card group"
          >
            <div className="flex items-start justify-between">
              <div className="text-3xl" aria-hidden>🔠</div>
              <span className="arrow-chip">→</span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-extrabold leading-tight">词汇</div>
              <div className="mt-1.5 text-sm font-medium text-ink/70 leading-snug">
                Vocabulary · B1 Preliminary 官方词表 · 3,046 词
              </div>
            </div>
          </Link>

          <Link
            href="/pet/grammar"
            className="skill-tile tile-cream stitched-card group"
          >
            <div className="flex items-start justify-between">
              <div className="text-3xl" aria-hidden>📐</div>
              <span className="arrow-chip">→</span>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-extrabold leading-tight">语法</div>
              <div className="mt-1.5 text-sm font-medium text-ink/70 leading-snug">
                Grammar · B1 Preliminary 官方语法清单 · 21 个主题
              </div>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
