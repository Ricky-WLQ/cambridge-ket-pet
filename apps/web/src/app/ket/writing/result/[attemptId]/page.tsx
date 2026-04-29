import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import WritingResultView from "@/components/writing/ResultView";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redoAttemptAction } from "@/lib/attemptActions";

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

export default async function KetWritingResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

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

  if (!attempt || attempt.userId !== userId) notFound();
  if (attempt.test.kind !== "WRITING") notFound();
  if (attempt.test.examType !== "KET") {
    redirect(`/pet/writing/result/${attemptId}`);
  }
  if (attempt.status !== "GRADED") {
    redirect(`/ket/writing/runner/${attemptId}`);
  }

  const payload = attempt.test.payload as unknown as WritingPayload;
  const stored = (attempt.weakPoints ?? {}) as unknown as StoredWritingResult;
  const userAnswers = (attempt.answers ?? {}) as Record<string, string>;

  return (
    <div className="page-section">
      <SiteHeader />
      <main className="flex flex-1 flex-col gap-3.5">
        <WritingResultView
          examType="KET"
          part={attempt.test.part ?? 0}
          mode={attempt.mode}
          totalBand={attempt.rawScore ?? 0}
          scaledScore={attempt.scaledScore ?? 0}
          payload={payload}
          stored={stored}
          userAnswers={userAnswers}
        />
        <div className="mx-auto flex max-w-3xl w-full flex-wrap items-center justify-between gap-3 px-1">
          <Link
            href="/history"
            className="rounded-full bg-white border-2 border-ink/15 px-4 py-2 text-sm font-bold hover:border-ink"
          >
            ← 返回历史记录
          </Link>
          <div className="flex flex-wrap gap-2">
            <form action={redoAttemptAction}>
              <input type="hidden" name="attemptId" value={attempt.id} />
              <button
                type="submit"
                className="rounded-full bg-ink text-white px-4 py-2 text-sm font-extrabold hover:bg-ink/90 transition"
              >
                再做一次
              </button>
            </form>
            <Link
              href="/ket"
              className="rounded-full bg-white border-2 border-ink/15 px-4 py-2 text-sm font-bold hover:border-ink"
            >
              返回 KET 门户
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
