import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { Mascot } from "@/components/Mascot";
import { AudioPlayer } from "@/components/listening/AudioPlayer";
import { TapescriptPanel } from "@/components/listening/TapescriptPanel";
import { QuestionRenderer } from "@/components/listening/QuestionRenderer";
import { redoAttemptAction } from "@/lib/attemptActions";
import type {
  AudioSegmentRecord,
  ListeningTestPayloadV2,
} from "@/lib/audio/types";

export default async function PetListeningResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");
  const { attemptId } = await params;
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: { test: true },
  });
  if (!attempt || attempt.userId !== userId) notFound();
  if (attempt.test.examType !== "PET") notFound();

  const payload = attempt.test.payload as unknown as ListeningTestPayloadV2;
  const segments = (attempt.test.audioSegments ??
    []) as unknown as AudioSegmentRecord[];
  const answers = (attempt.answers ?? {}) as Record<string, string>;

  const rawScore = attempt.rawScore ?? 0;
  const totalPossible = attempt.totalPossible ?? 0;
  const passRate = totalPossible > 0 ? (rawScore / totalPossible) * 100 : 0;
  const pose: "celebrating" | "thinking" | "confused" =
    passRate >= 70 ? "celebrating" : passRate >= 50 ? "thinking" : "confused";

  return (
    <div className="page-section">
      <SiteHeader />
      <main className="flex flex-1 flex-col gap-3.5">
        <div className="mx-auto max-w-3xl w-full">
          <div className="mb-4 flex items-center gap-3 px-1">
            <Mascot pose={pose} portal="pet" width={56} height={56} decorative />
            <div className="flex-1">
              <h1 className="text-base font-extrabold leading-tight">
                PET 听力 · 成绩
              </h1>
              <p className="mt-0.5 text-xs font-medium text-ink/60">
                得分 {rawScore} / {totalPossible}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/history"
                className="rounded-full bg-white border-2 border-ink/15 px-3 py-1.5 text-sm font-bold hover:border-ink"
              >
                ← 历史
              </Link>
              <Link
                href="/pet"
                className="rounded-full bg-white border-2 border-ink/15 px-3 py-1.5 text-sm font-bold hover:border-ink"
              >
                PET 门户
              </Link>
            </div>
          </div>

          <div className="mb-6">
            <AudioPlayer
              src={`/api/listening/${attempt.id}/audio`}
              segments={segments}
              controls={{
                playPause: true,
                scrub: true,
                skip10: true,
                speed: true,
                perSegmentReplay: true,
              }}
            />
          </div>

          <TapescriptPanel
            parts={payload.parts}
            segments={segments}
            currentSegmentId={null}
            defaultOpen={true}
            canToggle={false}
          />

          <div className="mt-6">
            {payload.parts.map((part) => (
              <section key={part.partNumber} className="mb-6">
                <h3 className="text-lg font-extrabold mb-3">第 {part.partNumber} 部分</h3>
                {part.questions.map((q) => (
                  <QuestionRenderer
                    key={q.id}
                    question={q}
                    value={answers[q.id]}
                    disabled={true}
                    showCorrectness={true}
                    correctAnswer={q.answer}
                  />
                ))}
              </section>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t-2 border-ink/10 pt-4">
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
                href="/pet/listening/new"
                className="rounded-full bg-white border-2 border-ink/15 px-4 py-2 text-sm font-bold hover:border-ink"
              >
                新的听力测试
              </Link>
              <Link
                href="/pet"
                className="rounded-full bg-white border-2 border-ink/15 px-4 py-2 text-sm font-bold hover:border-ink"
              >
                返回 PET 门户
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
