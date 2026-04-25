"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { prisma } from "./prisma";

/**
 * Redo a past attempt: create a NEW TestAttempt on the same testId with
 * mode copied from the source attempt, then redirect to the runner.
 *
 * Shared server action — used by /history page rows and by all 4
 * result pages (ket/pet × reading/writing).
 */
export async function redoAttemptAction(formData: FormData) {
  const attemptId = formData.get("attemptId");
  if (typeof attemptId !== "string") return;

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const oldAttempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: {
      test: { select: { id: true, examType: true, kind: true } },
    },
  });
  if (!oldAttempt || oldAttempt.userId !== userId) {
    redirect("/history");
  }

  const portal = oldAttempt.test.examType === "KET" ? "ket" : "pet";

  // Speaking attempts can't share a Test row across attempts: the
  // examinerScript + photoKey are randomized per attempt by /api/speaking/
  // tests/generate, so "redo same test" doesn't recreate the same exam.
  // Send the user to /new which generates fresh prompts — the right
  // semantics for "再做一次".
  if (oldAttempt.test.kind === "SPEAKING") {
    revalidatePath("/history");
    redirect(`/${portal}/speaking/new`);
  }

  const newAttempt = await prisma.testAttempt.create({
    data: {
      userId,
      testId: oldAttempt.testId,
      mode: oldAttempt.mode,
      status: "IN_PROGRESS",
    },
    select: { id: true },
  });

  revalidatePath("/history");
  const kindPath =
    oldAttempt.test.kind === "WRITING"
      ? "writing"
      : oldAttempt.test.kind === "LISTENING"
        ? "listening"
        : "reading";
  redirect(`/${portal}/${kindPath}/runner/${newAttempt.id}`);
}
