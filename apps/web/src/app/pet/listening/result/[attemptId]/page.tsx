import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { AudioPlayer } from "@/components/listening/AudioPlayer";
import { TapescriptPanel } from "@/components/listening/TapescriptPanel";
import { QuestionRenderer } from "@/components/listening/QuestionRenderer";
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

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">听力结果 — PET</h1>
      <div className="p-4 bg-slate-100 rounded mb-6">
        <p className="text-xl font-semibold">
          得分: {attempt.rawScore ?? 0} / {attempt.totalPossible ?? 0}
        </p>
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
            <h3 className="text-lg font-semibold">第 {part.partNumber} 部分</h3>
            {part.questions.map((q) => (
              <QuestionRenderer
                key={q.id}
                question={q}
                value={answers[q.id]}
                onChange={() => {}}
                disabled={true}
                showCorrectness={true}
                correctAnswer={q.answer}
              />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
