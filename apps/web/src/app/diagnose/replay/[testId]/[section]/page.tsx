import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";

import { SiteHeader } from "@/components/SiteHeader";
import DiagnoseRunnerReading from "@/components/diagnose/DiagnoseRunnerReading";
import DiagnoseRunnerListening from "@/components/diagnose/DiagnoseRunnerListening";
import DiagnoseRunnerWriting from "@/components/diagnose/DiagnoseRunnerWriting";
import DiagnoseRunnerVocab from "@/components/diagnose/DiagnoseRunnerVocab";
import DiagnoseRunnerGrammar from "@/components/diagnose/DiagnoseRunnerGrammar";
import { ClientSpeakingRunner } from "@/components/speaking/ClientSpeakingRunner";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  DIAGNOSE_SECTION_KINDS,
  SECTION_TIME_LIMIT_SEC,
  type DiagnoseSectionKind,
} from "@/lib/diagnose/sectionLimits";
import type {
  DiagnoseGrammarContent,
  DiagnosePayload,
  DiagnoseReadingContent,
  DiagnoseVocabContent,
  DiagnoseWritingContent,
} from "@/lib/diagnose/types";

/**
 * Diagnose section replay page (T39c).
 *
 * Lets the student re-take a single section from a past diagnose for
 * self-study. The new attempt is in PRACTICE mode and does NOT update
 * WeeklyDiagnose section status — it's invisible to the diagnose gate.
 *
 * Why we inline the replay logic here (rather than POSTing to
 * /api/diagnose/replay): the bulk endpoint creates all 6 sections in one
 * go which is wasteful when the user only wants one. Inlining keeps the
 * page idempotent: a reload doesn't create another attempt — we look up
 * the latest PRACTICE-mode TestAttempt for this test+sectionKind first.
 *
 * I1: replay is rendered VIEW-ONLY. The reused diagnose runner components
 * (DiagnoseRunnerReading, etc.) submit to `/api/diagnose/me/section/[KIND]/
 * submit`, which expects the CURRENT-week WeeklyDiagnose. Past-week testIds
 * would 404 there. Rather than wire a separate "replay submit" endpoint we
 * pass `readOnly` to the runners — they hide the submit button and skip
 * any auto-submit-on-timer behavior. The user can still answer, see the
 * questions and reflect; for grading they would re-take a current-week
 * diagnose.
 */
export default async function DiagnoseReplayPage({
  params,
}: {
  params: Promise<{ testId: string; section: string }>;
}) {
  const { testId, section: rawSection } = await params;
  const sectionUpper = rawSection.toUpperCase();
  if (!(DIAGNOSE_SECTION_KINDS as readonly string[]).includes(sectionUpper)) {
    notFound();
  }
  const sectionKind = sectionUpper as DiagnoseSectionKind;

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  // Ownership check — replay is owner-only (a teacher can't take a student's
  // test for them, and we don't surface a teacher entry point to /replay).
  const wd = await prisma.weeklyDiagnose.findUnique({
    where: { testId },
    include: { test: true },
  });
  if (!wd || wd.userId !== userId) notFound();
  if (wd.test?.kind !== "DIAGNOSE") notFound();

  // Idempotency: reuse the most recent IN_PROGRESS PRACTICE-mode TestAttempt
  // for this test + sectionKind, if any. This way reloading the page does
  // NOT create a fresh row each time.
  const existing = await prisma.testAttempt.findFirst({
    where: {
      userId,
      testId,
      mode: "PRACTICE",
      status: "IN_PROGRESS",
      // Match the answers JSON's sectionKind discriminator. Prisma's path
      // filter walks JSON keys; the diagnose replay route writes
      // `{ sectionKind, replay: true }` and we follow the same shape.
      answers: { path: ["sectionKind"], equals: sectionKind },
    },
    orderBy: { startedAt: "desc" },
    select: { id: true, startedAt: true },
  });

  let attemptId: string;
  if (existing) {
    attemptId = existing.id;
  } else {
    const created = await prisma.testAttempt.create({
      data: {
        userId,
        testId,
        mode: "PRACTICE",
        status: "IN_PROGRESS",
        startedAt: new Date(),
        answers: {
          sectionKind,
          replay: true,
        } as Prisma.InputJsonValue,
        ...(sectionKind === "SPEAKING" ? { speakingStatus: "IDLE" } : {}),
      },
      select: { id: true, startedAt: true },
    });
    attemptId = created.id;
  }

  // PRACTICE mode: the runners' MOCK-only timer doesn't auto-submit, but the
  // diagnose runner wrappers always pass timeLimitSec from this page. We use
  // the full per-section limit so the on-screen countdown is informational.
  const examType = wd.examType;
  const payload = wd.test.payload as unknown as DiagnosePayload;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href={`/diagnose/history/${testId}`}
            className="text-sm text-neutral-500 hover:text-neutral-900"
          >
            ← 返回历史报告
          </Link>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            重做练习 · 不计分
          </span>
        </div>

        {sectionKind === "READING" && (
          <ReplayReadingSection
            attemptId={attemptId}
            examType={examType}
            content={payload.sections.READING}
          />
        )}
        {sectionKind === "LISTENING" && (
          <ReplayListeningSection
            attemptId={attemptId}
            testId={wd.testId}
            examType={examType}
          />
        )}
        {sectionKind === "WRITING" && (
          <ReplayWritingSection
            attemptId={attemptId}
            examType={examType}
            content={payload.sections.WRITING}
          />
        )}
        {sectionKind === "VOCAB" && (
          <ReplayVocabSection
            attemptId={attemptId}
            content={payload.sections.VOCAB}
          />
        )}
        {sectionKind === "GRAMMAR" && (
          <ReplayGrammarSection
            attemptId={attemptId}
            content={payload.sections.GRAMMAR}
          />
        )}
        {sectionKind === "SPEAKING" && (
          <ClientSpeakingRunner attemptId={attemptId} level={examType} />
        )}
      </main>
    </div>
  );
}

// ─── Per-section adapters (PRACTICE mode → no auto-submit timer) ─────────

function ReplayReadingSection({
  attemptId,
  examType,
  content,
}: {
  attemptId: string;
  examType: "KET" | "PET";
  content: DiagnoseReadingContent;
}) {
  const questions = content.questions.map((q) => ({
    id: q.id,
    type: "MCQ" as const,
    prompt: q.text,
    options: q.options,
  }));
  return (
    <DiagnoseRunnerReading
      attemptId={attemptId}
      examType={examType}
      part={1}
      mode="PRACTICE"
      passage={content.passage}
      questions={questions}
      timeLimitSec={SECTION_TIME_LIMIT_SEC.READING}
      readOnly
    />
  );
}

function ReplayListeningSection({
  attemptId,
  testId,
  examType,
}: {
  attemptId: string;
  testId: string;
  examType: "KET" | "PET";
}) {
  return (
    <DiagnoseRunnerListening
      attemptId={attemptId}
      testId={testId}
      mode="PRACTICE"
      portal={examType === "KET" ? "ket" : "pet"}
      readOnly
    />
  );
}

function ReplayWritingSection({
  attemptId,
  examType,
  content,
}: {
  attemptId: string;
  examType: "KET" | "PET";
  content: DiagnoseWritingContent;
}) {
  const taskTypeMap: Record<
    DiagnoseWritingContent["taskType"],
    "EMAIL" | "PICTURE_STORY" | "LETTER_OR_STORY"
  > = {
    EMAIL: "EMAIL",
    STORY: "LETTER_OR_STORY",
    ARTICLE: "EMAIL",
    MESSAGE: "EMAIL",
  };
  return (
    <DiagnoseRunnerWriting
      attemptId={attemptId}
      examType={examType}
      part={1}
      mode="PRACTICE"
      taskType={taskTypeMap[content.taskType]}
      prompt={content.prompt}
      contentPoints={content.contentPoints}
      sceneDescriptions={[]}
      minWords={content.minWords}
      timeLimitSec={SECTION_TIME_LIMIT_SEC.WRITING}
      readOnly
    />
  );
}

function ReplayVocabSection({
  attemptId,
  content,
}: {
  attemptId: string;
  content: DiagnoseVocabContent;
}) {
  return (
    <DiagnoseRunnerVocab
      attemptId={attemptId}
      items={content.items}
      timeLimitSec={SECTION_TIME_LIMIT_SEC.VOCAB}
      readOnly
    />
  );
}

function ReplayGrammarSection({
  attemptId,
  content,
}: {
  attemptId: string;
  content: DiagnoseGrammarContent;
}) {
  return (
    <DiagnoseRunnerGrammar
      attemptId={attemptId}
      questions={content.questions}
      timeLimitSec={SECTION_TIME_LIMIT_SEC.GRAMMAR}
      readOnly
    />
  );
}
