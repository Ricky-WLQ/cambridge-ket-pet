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

export default async function PetWritingResultPage({
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
  if (attempt.test.examType !== "PET") {
    redirect(`/ket/writing/result/${attemptId}`);
  }
  if (attempt.status !== "GRADED") {
    redirect(`/pet/writing/runner/${attemptId}`);
  }

  const payload = attempt.test.payload as unknown as WritingPayload;
  const stored = (attempt.weakPoints ?? {}) as unknown as StoredWritingResult;
  const userAnswers = (attempt.answers ?? {}) as Record<string, string>;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <WritingResultView
          examType="PET"
          part={attempt.test.part ?? 0}
          mode={attempt.mode}
          totalBand={attempt.rawScore ?? 0}
          scaledScore={attempt.scaledScore ?? 0}
          payload={payload}
          stored={stored}
          userAnswers={userAnswers}
        />
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 pb-10">
          <Link
            href="/history"
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-100"
          >
            ← 返回历史记录
          </Link>
          <div className="flex flex-wrap gap-2">
            <form action={redoAttemptAction}>
              <input type="hidden" name="attemptId" value={attempt.id} />
              <button
                type="submit"
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
              >
                再做一次
              </button>
            </form>
            <Link
              href="/pet"
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-100"
            >
              返回 PET 门户
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
