import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import ReadingResultView, {
  type ResultViewProps as ReadingResultProps,
} from "@/components/reading/ResultView";
import WritingResultView from "@/components/writing/ResultView";
import { RubricBar } from "@/components/speaking/RubricBar";
import { TranscriptViewer } from "@/components/speaking/TranscriptViewer";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { GradableQuestionType } from "@/lib/grading";

type ReadingPayload = {
  passage: string | null;
  questions: Array<{
    id: string;
    type: GradableQuestionType;
    prompt: string;
    options: string[] | null;
    answer: string;
    explanation_zh: string;
    exam_point_id: string;
    difficulty_point_id: string | null;
  }>;
  time_limit_sec: number;
};

type StoredWeakPoints = {
  examPoints: Array<{ id: string; errorCount: number }>;
  difficultyPoints: Array<{ id: string; errorCount: number }>;
};

type WritingPayload = {
  prompt: string;
  content_points: string[];
  scene_descriptions?: string[];
  options?: Array<{ label: string; prompt: string; content_points: string[] }>;
};

type StoredWritingResult = {
  scores: {
    content: number;
    communicative: number;
    organisation: number;
    language: number;
  };
  feedback_zh: string;
  specific_suggestions_zh: string[];
};

type SpeakingRubric = {
  grammarVocab: number;
  discourseManagement: number;
  pronunciation: number;
  interactive: number;
  overall: number;
  justification: string;
  weakPoints: Array<{ tag: string; quote: string; suggestion: string }>;
};

type SpeakingTurn = {
  role: "user" | "assistant";
  content: string;
  part: number;
};

const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: "进行中",
  SUBMITTED: "已提交",
  GRADED: "已批改",
  ABANDONED: "已放弃",
};

function formatDateTime(d: Date): string {
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function TeacherAttemptDetailPage({
  params,
}: {
  params: Promise<{ classId: string; studentId: string; attemptId: string }>;
}) {
  const { classId, studentId, attemptId } = await params;

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const teacher = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!teacher || (teacher.role !== "TEACHER" && teacher.role !== "ADMIN")) {
    redirect("/teacher/activate");
  }

  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, name: true, teacherId: true },
  });
  if (!cls || cls.teacherId !== userId) notFound();

  const membership = await prisma.classMember.findUnique({
    where: { classId_userId: { classId, userId: studentId } },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });
  if (!membership) notFound();

  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: {
      test: {
        select: {
          examType: true,
          kind: true,
          part: true,
          payload: true,
        },
      },
    },
  });

  if (!attempt || attempt.userId !== studentId) notFound();

  const backHref = `/teacher/classes/${classId}/students/${studentId}`;

  const headerBlock = (
    <div className="mx-auto w-full max-w-3xl px-6 pt-8">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 rounded-full border-2 border-ink/15 bg-white px-3 py-1.5 text-sm font-bold text-ink hover:bg-ink/5 transition"
      >
        <span aria-hidden>←</span> 返回学生详情
      </Link>
      <div className="mt-4 rounded-2xl border-2 border-ink/10 bg-sky-tint p-4 text-sm text-ink stitched-card">
        <div className="font-extrabold">
          查看学生：{membership.user.name ?? membership.user.email}
        </div>
        <div className="mt-0.5 text-xs font-medium text-ink/70">
          {membership.user.email} · {cls.name} · 作答时间：
          {formatDateTime(attempt.startedAt)}
          {attempt.submittedAt && ` → ${formatDateTime(attempt.submittedAt)}`}
          <span className="ml-2 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-bold">
            {STATUS_LABEL[attempt.status] ?? attempt.status}
          </span>
        </div>
      </div>
    </div>
  );

  // Ungraded attempt: no ResultView to show — render a minimal card.
  if (attempt.status !== "GRADED") {
    return (
      <div className="page-section">
        <SiteHeader />
        <main className="flex-1">
          {headerBlock}
          <div className="mx-auto mt-6 max-w-3xl px-6 pb-10">
            <div className="rounded-2xl border-2 border-dashed border-ink/15 p-8 text-center text-sm font-medium text-ink/60">
              该答卷尚未批改完成，暂无详细成绩可查看。
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (attempt.test.kind === "READING") {
    const payload = (attempt.test.payload ?? {}) as Partial<ReadingPayload>;
    const questions = payload.questions ?? [];
    const passage = payload.passage ?? null;
    // `weakPoints` may be `{}` (truthy → ?? skipped) or have missing keys
    // for older attempts. Default each list independently.
    const stored = (attempt.weakPoints ?? {}) as Partial<StoredWeakPoints>;
    const storedExam = stored.examPoints ?? [];
    const storedDifficulty = stored.difficultyPoints ?? [];

    const [examPoints, difficultyPoints] = await Promise.all([
      prisma.examPoint.findMany({
        where: { id: { in: storedExam.map((e) => e.id) } },
        select: { id: true, label: true, descriptionZh: true },
      }),
      prisma.difficultyPoint.findMany({
        where: { id: { in: storedDifficulty.map((d) => d.id) } },
        select: { id: true, label: true, descriptionZh: true },
      }),
    ]);

    const weakPoints: ReadingResultProps["weakPoints"] = {
      examPoints: storedExam.map((wp) => {
        const ep = examPoints.find((e) => e.id === wp.id);
        return {
          id: wp.id,
          errorCount: wp.errorCount,
          label: ep?.label ?? wp.id,
          descriptionZh: ep?.descriptionZh ?? "",
        };
      }),
      difficultyPoints: storedDifficulty.map((wp) => {
        const dp = difficultyPoints.find((d) => d.id === wp.id);
        return {
          id: wp.id,
          errorCount: wp.errorCount,
          label: dp?.label ?? wp.id,
          descriptionZh: dp?.descriptionZh ?? "",
        };
      }),
    };

    const userAnswers = (attempt.answers ?? {}) as Record<string, string>;

    return (
      <div className="page-section">
        <SiteHeader />
        <main className="flex-1">
          {headerBlock}
          <ReadingResultView
            examType={attempt.test.examType}
            part={attempt.test.part ?? 0}
            mode={attempt.mode}
            rawScore={attempt.rawScore ?? 0}
            totalPossible={attempt.totalPossible ?? questions.length}
            scaledScore={attempt.scaledScore ?? 0}
            userAnswers={userAnswers}
            passage={passage}
            questions={questions}
            weakPoints={weakPoints}
          />
        </main>
      </div>
    );
  }

  if (attempt.test.kind === "WRITING") {
    const payload = attempt.test.payload as unknown as WritingPayload;
    const stored = (attempt.weakPoints ?? {}) as unknown as StoredWritingResult;
    const userAnswers = (attempt.answers ?? {}) as Record<string, string>;

    return (
      <div className="page-section">
        <SiteHeader />
        <main className="flex-1">
          {headerBlock}
          <WritingResultView
            examType={attempt.test.examType}
            part={attempt.test.part ?? 0}
            mode={attempt.mode}
            totalBand={attempt.rawScore ?? 0}
            scaledScore={attempt.scaledScore ?? 0}
            payload={payload}
            stored={stored}
            userAnswers={userAnswers}
          />
        </main>
      </div>
    );
  }

  if (attempt.test.kind === "SPEAKING") {
    const transcript = (attempt.transcript as SpeakingTurn[] | null) ?? [];
    const rubric = (attempt.rubricScores as SpeakingRubric | null) ?? null;

    return (
      <div className="page-section">
        <SiteHeader />
        <main className="flex-1">
          {headerBlock}
          <div className="mx-auto mt-6 max-w-3xl space-y-6 px-6 pb-10">
            {rubric ? (
              <>
                <section className="rounded-2xl border-2 border-ink/10 bg-mint-tint p-4 stitched-card">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-xl font-extrabold">
                      得分：{attempt.rawScore ?? 0} /{" "}
                      {attempt.totalPossible ?? 20}
                    </p>
                    {typeof attempt.scaledScore === "number" && (
                      <p className="text-base font-medium text-ink/70">
                        折算 {attempt.scaledScore}%
                      </p>
                    )}
                  </div>
                  <p className="mt-1 text-xs font-medium text-ink/55">
                    Cambridge Speaking 四项评分（0–5）
                  </p>
                </section>

                <section className="rounded-2xl border-2 border-ink/10 bg-white p-4 stitched-card">
                  <div className="mb-4 flex items-baseline justify-between">
                    <h2 className="text-base font-extrabold text-ink">
                      评分细项
                    </h2>
                    <span className="tabular-nums text-2xl font-extrabold text-emerald-600">
                      {rubric.overall.toFixed(1)}
                      <span className="ml-1 text-sm font-medium text-ink/55">
                        / 5
                      </span>
                    </span>
                  </div>
                  <div className="space-y-3">
                    <RubricBar
                      label="Grammar & Vocabulary"
                      score={rubric.grammarVocab}
                    />
                    <RubricBar
                      label="Discourse Management"
                      score={rubric.discourseManagement}
                    />
                    <RubricBar
                      label="Pronunciation"
                      score={rubric.pronunciation}
                    />
                    <RubricBar
                      label="Interactive Communication"
                      score={rubric.interactive}
                    />
                  </div>
                  {rubric.justification && (
                    <p className="mt-4 border-t-2 border-ink/10 pt-3 text-sm leading-relaxed text-ink/85">
                      {rubric.justification}
                    </p>
                  )}
                </section>

                {rubric.weakPoints?.length > 0 && (
                  <section className="rounded-2xl border-2 border-ink/10 bg-white p-4 stitched-card">
                    <h2 className="text-base font-extrabold text-ink">易错点</h2>
                    <ul className="mt-3 space-y-3">
                      {rubric.weakPoints.map((wp, i) => (
                        <li
                          key={i}
                          className="rounded-xl border-2 border-ink/10 bg-cream-tint p-3 text-sm"
                        >
                          <span className="text-xs font-extrabold uppercase tracking-wide text-ink/55">
                            {wp.tag}
                          </span>
                          <p className="mt-1 italic text-ink/85">
                            “{wp.quote}”
                          </p>
                          <p className="mt-1 text-ink">
                            建议：{wp.suggestion}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-ink/15 p-6 text-center text-sm font-medium text-ink/60">
                未生成评分（学生可能未完成或评分异常）。
                {attempt.speakingError && (
                  <p className="mt-2 text-xs text-red-600">
                    {attempt.speakingError}
                  </p>
                )}
              </div>
            )}

            <TranscriptViewer transcript={transcript} defaultOpen={!rubric} />
          </div>
        </main>
      </div>
    );
  }

  // Future phases (listening/mock). For now, show a polite placeholder.
  return (
    <div className="page-section">
      <SiteHeader />
      <main className="flex-1">
        {headerBlock}
        <div className="mx-auto mt-6 max-w-3xl px-6 pb-10">
          <div className="rounded-2xl border-2 border-dashed border-ink/15 p-8 text-center text-sm font-medium text-ink/60">
            该题型（{attempt.test.kind}）的详细视图尚未上线。
          </div>
        </div>
      </main>
    </div>
  );
}
