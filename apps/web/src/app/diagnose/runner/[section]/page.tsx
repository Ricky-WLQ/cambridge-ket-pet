import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";

import { SiteHeader } from "@/components/SiteHeader";
import DiagnoseRunnerReading from "@/components/diagnose/DiagnoseRunnerReading";
import DiagnoseRunnerListening from "@/components/diagnose/DiagnoseRunnerListening";
import DiagnoseRunnerWriting from "@/components/diagnose/DiagnoseRunnerWriting";
import DiagnoseRunnerVocab from "@/components/diagnose/DiagnoseRunnerVocab";
import DiagnoseRunnerGrammar from "@/components/diagnose/DiagnoseRunnerGrammar";
import { SECTION_TITLE_ZH } from "@/components/diagnose/SectionStatusCard";
import { ClientSpeakingRunner } from "@/components/speaking/ClientSpeakingRunner";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentWeekStart } from "@/lib/diagnose/week";
import {
  DIAGNOSE_SECTION_KINDS,
  SECTION_TIME_LIMIT_SEC,
  remainingSec,
  type DiagnoseSectionKind,
} from "@/lib/diagnose/sectionLimits";
import type {
  DiagnoseGrammarContent,
  DiagnoseListeningContent,
  DiagnosePayload,
  DiagnoseReadingContent,
  DiagnoseVocabContent,
  DiagnoseWritingContent,
} from "@/lib/diagnose/types";

/**
 * Diagnose section runner page (T37).
 *
 * Dynamic route: /diagnose/runner/[section]. The URL param is lowercase
 * (e.g. `reading`); we resolve to the uppercase `DiagnoseSectionKind` enum
 * for our internal API contracts.
 *
 * Server-side flow:
 *  1. Auth → /login if no session.
 *  2. Resolve + validate the section param (404 if not one of the 6 kinds).
 *  3. Fetch the user's current-week WeeklyDiagnose + parent Test row.
 *      - 404 if no row exists. The user is supposed to land here from the
 *        hub which only links once a row is generated; if they URL-typed,
 *        bouncing them back to /diagnose lets them generate.
 *  4. If the section's attemptId is unset, create a fresh TestAttempt
 *     directly via Prisma (mirroring the /start API route's logic). This
 *     is idempotent thanks to the per-section attemptId FK on
 *     WeeklyDiagnose: a second visit reuses the row already created.
 *  5. If the section is already submitted/graded, route back to the hub
 *     so the student doesn't accidentally re-attempt.
 *  6. Dispatch to the section-specific runner component, passing the
 *     section's parsed payload + the surviving time on the deadline.
 *
 * Why a server component (not a client one fetching `/api/...` from the
 * browser): the runner needs the section's full content (passage, audio
 * segments etc.) at first paint, and we already have it server-side via
 * the parent Test.payload. Round-tripping through fetch would just add
 * latency with no upside.
 */
export default async function DiagnoseRunnerSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section: rawSection } = await params;
  const sectionUpper = rawSection.toUpperCase();
  if (!(DIAGNOSE_SECTION_KINDS as readonly string[]).includes(sectionUpper)) {
    notFound();
  }
  const sectionKind = sectionUpper as DiagnoseSectionKind;

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const weekStart = currentWeekStart();
  const wd = await prisma.weeklyDiagnose.findUnique({
    where: { userId_weekStart: { userId, weekStart } },
    include: { test: true },
  });
  if (!wd) {
    redirect("/diagnose");
  }
  if (wd.test?.kind !== "DIAGNOSE") {
    redirect("/diagnose");
  }

  // Lookup the section's attemptId + status. If unset, create now.
  let attemptId = pickAttemptId(wd, sectionKind);
  let attemptStatus = pickStatus(wd, sectionKind);

  if (!attemptId) {
    // Mirrors POST /api/diagnose/me/section/[sectionKind]/start logic.
    const created = await prisma.testAttempt.create({
      data: {
        userId,
        testId: wd.testId,
        mode: "MOCK",
        status: "IN_PROGRESS",
        startedAt: new Date(),
        answers: { sectionKind } as Prisma.InputJsonValue,
        ...(sectionKind === "SPEAKING" ? { speakingStatus: "IDLE" } : {}),
      },
      select: { id: true, startedAt: true },
    });
    await updateSectionFk(wd.id, sectionKind, created.id);
    attemptId = created.id;
    attemptStatus = "IN_PROGRESS";
  }

  // If the section is already submitted/graded/auto-submitted we send the
  // user back to the hub. Re-running the runner would risk overwriting
  // their submitted state.
  if (
    attemptStatus === "SUBMITTED" ||
    attemptStatus === "AUTO_SUBMITTED" ||
    attemptStatus === "GRADED"
  ) {
    redirect("/diagnose");
  }

  // Re-fetch the attempt's startedAt so we can compute the surviving time.
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, startedAt: true },
  });
  if (!attempt) notFound();

  const remaining = remainingSec(sectionKind, attempt.startedAt);
  const examType = wd.examType;

  // Parse the section's payload from the parent Test row.
  const payload = wd.test.payload as unknown as DiagnosePayload;

  return (
    <div className="page-section">
      <SiteHeader />
      <main className="flex flex-1 flex-col gap-3.5">
        <div className="flex items-center justify-between gap-2 px-2">
          <Link
            href="/diagnose"
            className="text-sm font-bold text-ink/70 hover:text-ink hover:underline"
          >
            ← 返回本周诊断
          </Link>
          <span className="pill-tag !py-0.5 !px-2 !text-[11px] bg-white border border-ink/10">
            本周诊断 · {SECTION_TITLE_ZH[sectionKind]}
          </span>
        </div>

        {sectionKind === "READING" && (
          <ReadingSection
            attemptId={attempt.id}
            examType={examType}
            content={payload.sections.READING}
            timeLimitSec={remaining || SECTION_TIME_LIMIT_SEC.READING}
          />
        )}
        {sectionKind === "LISTENING" && (
          <ListeningSection
            attemptId={attempt.id}
            testId={wd.testId}
            examType={examType}
          />
        )}
        {sectionKind === "WRITING" && (
          <WritingSection
            attemptId={attempt.id}
            examType={examType}
            content={payload.sections.WRITING}
            timeLimitSec={remaining || SECTION_TIME_LIMIT_SEC.WRITING}
          />
        )}
        {sectionKind === "VOCAB" && (
          <VocabSection
            attemptId={attempt.id}
            examType={examType}
            content={payload.sections.VOCAB}
            timeLimitSec={remaining || SECTION_TIME_LIMIT_SEC.VOCAB}
          />
        )}
        {sectionKind === "GRAMMAR" && (
          <GrammarSection
            attemptId={attempt.id}
            examType={examType}
            content={payload.sections.GRAMMAR}
            timeLimitSec={remaining || SECTION_TIME_LIMIT_SEC.GRAMMAR}
          />
        )}
        {sectionKind === "SPEAKING" && (
          <SpeakingSection attemptId={attempt.id} examType={examType} />
        )}
      </main>
    </div>
  );
}

// ─── Per-section view-model adapters ─────────────────────────────────────────

function ReadingSection({
  attemptId,
  examType,
  content,
  timeLimitSec,
}: {
  attemptId: string;
  examType: "KET" | "PET";
  content: DiagnoseReadingContent;
  timeLimitSec: number;
}) {
  // The reading runner needs RunnerQuestion shape (id/type/prompt/options).
  // The diagnose generator emits questions as MCQ (correctIndex), so map
  // them back into the runner's question shape.
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
      mode="MOCK"
      passage={content.passage}
      questions={questions}
      timeLimitSec={timeLimitSec}
    />
  );
}

function ListeningSection({
  attemptId,
  testId,
  examType,
}: {
  attemptId: string;
  testId: string;
  examType: "KET" | "PET";
}) {
  // The existing listening runner polls /api/listening/tests/[id]/status to
  // pick up audio + payload once Edge-TTS finishes; we just hand it the
  // testId and let it manage its own state.
  return (
    <DiagnoseRunnerListening
      attemptId={attemptId}
      testId={testId}
      mode="MOCK"
      portal={examType === "KET" ? "ket" : "pet"}
    />
  );
}

function WritingSection({
  attemptId,
  examType,
  content,
  timeLimitSec,
}: {
  attemptId: string;
  examType: "KET" | "PET";
  content: DiagnoseWritingContent;
  timeLimitSec: number;
}) {
  // The writing runner's taskType union is EMAIL | PICTURE_STORY | LETTER_OR_STORY,
  // but the diagnose generator uses EMAIL | STORY | ARTICLE | MESSAGE. Map back:
  // STORY → LETTER_OR_STORY (closest semantic match), ARTICLE/MESSAGE → EMAIL
  // as a safe fallback (the runner's UI mostly treats them identically).
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
      mode="MOCK"
      taskType={taskTypeMap[content.taskType]}
      prompt={content.prompt}
      contentPoints={content.contentPoints}
      sceneDescriptions={[]}
      minWords={content.minWords}
      timeLimitSec={timeLimitSec}
    />
  );
}

function VocabSection({
  attemptId,
  examType,
  content,
  timeLimitSec,
}: {
  attemptId: string;
  examType: "KET" | "PET";
  content: DiagnoseVocabContent;
  timeLimitSec: number;
}) {
  return (
    <DiagnoseRunnerVocab
      attemptId={attemptId}
      portal={examType === "KET" ? "ket" : "pet"}
      items={content.items}
      timeLimitSec={timeLimitSec}
    />
  );
}

function GrammarSection({
  attemptId,
  examType,
  content,
  timeLimitSec,
}: {
  attemptId: string;
  examType: "KET" | "PET";
  content: DiagnoseGrammarContent;
  timeLimitSec: number;
}) {
  return (
    <DiagnoseRunnerGrammar
      attemptId={attemptId}
      portal={examType === "KET" ? "ket" : "pet"}
      questions={content.questions}
      timeLimitSec={timeLimitSec}
    />
  );
}

function SpeakingSection({
  attemptId,
  examType,
}: {
  attemptId: string;
  examType: "KET" | "PET";
}) {
  // Speaking is a thin pass-through to the existing TRTC-based ClientSpeakingRunner,
  // which lives in apps/web/src/components/speaking/. The runner internally
  // calls /api/speaking/[attemptId]/* — those routes are part of the existing
  // speaking pipeline and already handle DIAGNOSE TestAttempts because the
  // attempt's parent Test row has kind=DIAGNOSE with the speaking* columns
  // populated by the diagnose generator.
  //
  // redirectAfterSubmit="/diagnose" so the post-submit nav lands on the
  // diagnose hub. Without it, SpeakingRunner navigates to
  // `/${portal}/speaking/result/${attemptId}` which 404s for diagnose
  // attempts (the regular result page rejects kind != "SPEAKING").
  return (
    <ClientSpeakingRunner
      attemptId={attemptId}
      level={examType}
      redirectAfterSubmit="/diagnose"
    />
  );
}

// ─── Per-section FK helpers (mirror /start API route) ─────────────────────

function pickAttemptId(
  wd: {
    readingAttemptId: string | null;
    listeningAttemptId: string | null;
    writingAttemptId: string | null;
    speakingAttemptId: string | null;
    vocabAttemptId: string | null;
    grammarAttemptId: string | null;
  },
  kind: DiagnoseSectionKind,
): string | null {
  switch (kind) {
    case "READING":
      return wd.readingAttemptId;
    case "LISTENING":
      return wd.listeningAttemptId;
    case "WRITING":
      return wd.writingAttemptId;
    case "SPEAKING":
      return wd.speakingAttemptId;
    case "VOCAB":
      return wd.vocabAttemptId;
    case "GRAMMAR":
      return wd.grammarAttemptId;
    default: {
      const _exhaustive: never = kind;
      void _exhaustive;
      return null;
    }
  }
}

function pickStatus(
  wd: {
    readingStatus: string;
    listeningStatus: string;
    writingStatus: string;
    speakingStatus: string;
    vocabStatus: string;
    grammarStatus: string;
  },
  kind: DiagnoseSectionKind,
): string {
  switch (kind) {
    case "READING":
      return wd.readingStatus;
    case "LISTENING":
      return wd.listeningStatus;
    case "WRITING":
      return wd.writingStatus;
    case "SPEAKING":
      return wd.speakingStatus;
    case "VOCAB":
      return wd.vocabStatus;
    case "GRAMMAR":
      return wd.grammarStatus;
    default: {
      const _exhaustive: never = kind;
      void _exhaustive;
      return "NOT_STARTED";
    }
  }
}

async function updateSectionFk(
  wdId: string,
  sectionKind: DiagnoseSectionKind,
  attemptId: string,
): Promise<void> {
  const overall = { status: "IN_PROGRESS" as const };
  switch (sectionKind) {
    case "READING":
      await prisma.weeklyDiagnose.update({
        where: { id: wdId },
        data: {
          readingAttemptId: attemptId,
          readingStatus: "IN_PROGRESS",
          ...overall,
        },
      });
      return;
    case "LISTENING":
      await prisma.weeklyDiagnose.update({
        where: { id: wdId },
        data: {
          listeningAttemptId: attemptId,
          listeningStatus: "IN_PROGRESS",
          ...overall,
        },
      });
      return;
    case "WRITING":
      await prisma.weeklyDiagnose.update({
        where: { id: wdId },
        data: {
          writingAttemptId: attemptId,
          writingStatus: "IN_PROGRESS",
          ...overall,
        },
      });
      return;
    case "SPEAKING":
      await prisma.weeklyDiagnose.update({
        where: { id: wdId },
        data: {
          speakingAttemptId: attemptId,
          speakingStatus: "IN_PROGRESS",
          ...overall,
        },
      });
      return;
    case "VOCAB":
      await prisma.weeklyDiagnose.update({
        where: { id: wdId },
        data: {
          vocabAttemptId: attemptId,
          vocabStatus: "IN_PROGRESS",
          ...overall,
        },
      });
      return;
    case "GRAMMAR":
      await prisma.weeklyDiagnose.update({
        where: { id: wdId },
        data: {
          grammarAttemptId: attemptId,
          grammarStatus: "IN_PROGRESS",
          ...overall,
        },
      });
      return;
    default: {
      const _exhaustive: never = sectionKind;
      void _exhaustive;
    }
  }
}
