import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { ListeningRunner } from "@/components/listening/ListeningRunner";

export default async function KetListeningRunnerPage({
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
  if (attempt.test.examType !== "KET") notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <ListeningRunner
          attemptId={attempt.id}
          testId={attempt.test.id}
          mode={attempt.test.mode}
          portal="ket"
        />
      </main>
    </div>
  );
}
