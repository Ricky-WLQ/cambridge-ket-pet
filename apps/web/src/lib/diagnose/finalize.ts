/**
 * Shared finalize pipeline (extracted from /api/diagnose/me/finalize/route.ts).
 *
 * Why a shared helper:
 *  - The hub page (/diagnose) needs to trigger finalize server-side when it
 *    detects status===COMPLETE && reportAt===null on render. Calling the
 *    /finalize HTTP route from the hub page is awkward because it would
 *    require either an internal-token bypass or a fetch with the user's
 *    cookies — both add complexity.
 *  - Extracting the body of the route handler into this pure function lets
 *    both the route handler AND the hub page invoke the pipeline directly
 *    using the userId already in scope.
 *
 * Idempotency:
 *  - Mirrors the route's idempotency: returns immediately when status is
 *    already REPORT_READY (no re-AI), and the route can be re-fired safely
 *    after partial failures.
 *
 * Failure semantics:
 *  - Same as the route: writing-grade and speaking-poll failures are
 *    soft (the pipeline proceeds with null sub-scores). Analysis or
 *    summary failures hard-stop and persist status=REPORT_FAILED.
 */

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { currentWeekStart } from "@/lib/diagnose/week";
import {
  analyzeDiagnose,
  gradeWriting,
  summarizeDiagnose,
  type DiagnoseWireKnowledgePointGroup,
  type DiagnoseWirePerSectionScores,
} from "@/lib/aiClient";
import { collectWrongAnswers } from "@/lib/diagnose/collectWrongAnswers";
import {
  applySeverityToAll,
  sortBySeverity,
} from "@/lib/diagnose/severity";
import type {
  DiagnoseGradeResults,
  DiagnosePayload,
  ItemResult,
  KnowledgePointGroup,
  PerSectionScores,
  SectionGradeResult,
  SpeakingGrade,
  WritingGrade,
} from "@/lib/diagnose/types";

/** Result of running the finalize pipeline. */
export type FinalizeResult =
  | { kind: "NOT_READY"; inProgressSections: string[] }
  | { kind: "MISSING"; reason: string }
  | { kind: "ALREADY_FINALIZED"; overallScore: number | null; weakCount: number }
  | { kind: "FAILED"; stage: "analysis" | "summary"; detail: string }
  | { kind: "READY"; overallScore: number; weakCount: number };

/**
 * Run the post-submit finalize pipeline for the calling user's current-week
 * WeeklyDiagnose row. See route.ts docstring for the full pipeline shape;
 * this is a near-direct extraction with the only difference being that the
 * caller passes `userId` directly (no auth() lookup) and receives a
 * structured result rather than a NextResponse.
 *
 * Steps mirror the route handler's steps 1-G (auth is the caller's
 * responsibility — pass userId).
 */
export async function runFinalizePipeline(
  userId: string,
): Promise<FinalizeResult> {
  // ──── Step 1: Find current-week WeeklyDiagnose ───────────────────
  const weekStart = currentWeekStart();
  const wd = await prisma.weeklyDiagnose.findUnique({
    where: { userId_weekStart: { userId, weekStart } },
    include: { test: { select: { payload: true, kind: true } } },
  });
  if (!wd) {
    return { kind: "MISSING", reason: "本周诊断尚未生成" };
  }

  // Idempotency: already-finalized — return cached report immediately.
  if (wd.status === "REPORT_READY") {
    return {
      kind: "ALREADY_FINALIZED",
      overallScore: wd.overallScore ?? null,
      weakCount: Array.isArray(wd.knowledgePoints)
        ? (wd.knowledgePoints as unknown[]).length
        : 0,
    };
  }

  // ──── Step 2: Verify all 6 sections done ─────────────────────────
  const finishedSet: Set<string> = new Set([
    "SUBMITTED",
    "GRADED",
    "AUTO_SUBMITTED",
  ]);
  const inProgressSections: string[] = [];
  if (!finishedSet.has(wd.readingStatus))
    inProgressSections.push("READING");
  if (!finishedSet.has(wd.listeningStatus))
    inProgressSections.push("LISTENING");
  if (!finishedSet.has(wd.writingStatus))
    inProgressSections.push("WRITING");
  if (!finishedSet.has(wd.speakingStatus))
    inProgressSections.push("SPEAKING");
  if (!finishedSet.has(wd.vocabStatus))
    inProgressSections.push("VOCAB");
  if (!finishedSet.has(wd.grammarStatus))
    inProgressSections.push("GRAMMAR");
  if (inProgressSections.length > 0) {
    return { kind: "NOT_READY", inProgressSections };
  }

  // ──── Step 3: Load all 6 attempts + payload ──────────────────────
  if (wd.test?.kind !== "DIAGNOSE") {
    return {
      kind: "MISSING",
      reason: "Linked Test is not a DIAGNOSE row",
    };
  }
  const payload = wd.test.payload as unknown as DiagnosePayload;
  const examType = payload.examType;

  const attemptIds = [
    wd.readingAttemptId,
    wd.listeningAttemptId,
    wd.writingAttemptId,
    wd.speakingAttemptId,
    wd.vocabAttemptId,
    wd.grammarAttemptId,
  ];
  if (attemptIds.some((id) => !id)) {
    return {
      kind: "MISSING",
      reason: "Some sections are missing attemptId — cannot finalize",
    };
  }

  const attempts = await prisma.testAttempt.findMany({
    where: { id: { in: attemptIds.filter((x): x is string => Boolean(x)) } },
  });
  const byId = new Map(attempts.map((a) => [a.id, a] as const));
  const readingAttempt = byId.get(wd.readingAttemptId!);
  const listeningAttempt = byId.get(wd.listeningAttemptId!);
  let writingAttempt = byId.get(wd.writingAttemptId!);
  let speakingAttempt = byId.get(wd.speakingAttemptId!);
  const vocabAttempt = byId.get(wd.vocabAttemptId!);
  const grammarAttempt = byId.get(wd.grammarAttemptId!);
  if (
    !readingAttempt ||
    !listeningAttempt ||
    !writingAttempt ||
    !speakingAttempt ||
    !vocabAttempt ||
    !grammarAttempt
  ) {
    return { kind: "MISSING", reason: "Failed to load all section attempts" };
  }

  // ──── Step A: AI-grade writing (if SUBMITTED, not yet GRADED) ────
  if (
    writingAttempt.status === "SUBMITTED" &&
    writingAttempt.scaledScore === null
  ) {
    const writingContent = payload.sections.WRITING;
    const writingAnswers = writingAttempt.answers as { text?: string } | null;
    const studentResponse =
      typeof writingAnswers?.text === "string" ? writingAnswers.text : "";

    try {
      const result = await gradeWriting({
        exam_type: examType,
        part: 0,
        prompt: writingContent.prompt,
        content_points: writingContent.contentPoints ?? [],
        scene_descriptions: [],
        chosen_option: null,
        student_response: studentResponse,
      });
      const totalPossible = 20; // 4 criteria × 5 max
      const scaledScore = Math.round(
        (result.total_band / totalPossible) * 100,
      );
      writingAttempt = await prisma.testAttempt.update({
        where: { id: writingAttempt.id },
        data: {
          status: "GRADED",
          rawScore: result.total_band,
          totalPossible,
          scaledScore,
          weakPoints: {
            scores: result.scores,
            feedback_zh: result.feedback_zh,
            specific_suggestions_zh: result.specific_suggestions_zh,
          } as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      console.error("Writing AI grading failed during finalize:", err);
      writingAttempt = await prisma.testAttempt.update({
        where: { id: writingAttempt.id },
        data: {
          weakPoints: {
            error: "writing_grade_failed",
            message: err instanceof Error ? err.message : String(err),
          } as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }

  // ──── Step B: Wait for speaking score (poll up to 90s) ───────────
  if (
    speakingAttempt.speakingStatus !== "SCORED" &&
    speakingAttempt.speakingStatus !== "FAILED"
  ) {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const updated = await prisma.testAttempt.findUnique({
        where: { id: speakingAttempt.id },
      });
      if (
        updated?.speakingStatus === "SCORED" ||
        updated?.speakingStatus === "FAILED"
      ) {
        speakingAttempt = updated;
        break;
      }
    }
    // I4: final re-read after the loop closes the small race window where
    // the speaking pipeline transitions to SCORED between our last poll
    // tick and writing the timeout marker.
    if (
      speakingAttempt.speakingStatus !== "SCORED" &&
      speakingAttempt.speakingStatus !== "FAILED"
    ) {
      const finalCheck = await prisma.testAttempt.findUnique({
        where: { id: speakingAttempt.id },
      });
      if (finalCheck) speakingAttempt = finalCheck;
    }
    if (
      speakingAttempt.speakingStatus !== "SCORED" &&
      speakingAttempt.speakingStatus !== "FAILED"
    ) {
      await prisma.testAttempt.update({
        where: { id: speakingAttempt.id },
        data: {
          weakPoints: {
            error: "speaking_score_pending",
          } as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }

  // ──── Step C: Build DiagnoseGradeResults ──────────────────────────
  const readingResult = sectionResultFromAttempt(readingAttempt);
  const listeningResult = sectionResultFromAttempt(listeningAttempt);
  const vocabResult = sectionResultFromAttempt(vocabAttempt);
  const grammarResult = sectionResultFromAttempt(grammarAttempt);
  const writingGrade = writingGradeFromAttempt(writingAttempt);
  const speakingGrade = speakingGradeFromAttempt(speakingAttempt);

  const results: DiagnoseGradeResults = {
    READING: readingResult,
    LISTENING: listeningResult,
    VOCAB: vocabResult,
    GRAMMAR: grammarResult,
    WRITING: writingGrade,
    SPEAKING: speakingGrade,
  };

  // ──── Step D: AI 8-category analysis ─────────────────────────────
  const wrongAnswers = collectWrongAnswers(payload, results);
  let analysisResp;
  try {
    analysisResp = await analyzeDiagnose({
      exam_type: examType,
      wrong_answers: wrongAnswers.map((w) => ({
        section: w.section,
        question_text: w.questionText,
        user_answer: w.userAnswer,
        correct_answer: w.correctAnswer,
        ...(w.options ? { options: w.options } : {}),
      })),
    });
  } catch (err) {
    console.error("Diagnose analysis failed:", err);
    const errMsg =
      err instanceof Error ? err.message.slice(0, 400) : String(err).slice(0, 400);
    await prisma.weeklyDiagnose.update({
      where: { id: wd.id },
      data: {
        status: "REPORT_FAILED",
        reportError: `analysis_failed: ${errMsg}`,
      },
    });
    return { kind: "FAILED", stage: "analysis", detail: errMsg };
  }

  // ──── Step E: Apply severity + sort ──────────────────────────────
  const knowledgePointsCamel: KnowledgePointGroup[] =
    analysisResp.knowledge_points.map(
      (k: DiagnoseWireKnowledgePointGroup) => ({
        knowledgePoint: k.knowledge_point,
        category: k.category,
        miniLesson: k.mini_lesson,
        rule: k.rule,
        exampleSentences: k.example_sentences,
        questions: k.questions.map((q) => ({
          section: q.section,
          questionText: q.question_text,
          userAnswer: q.user_answer,
          correctAnswer: q.correct_answer,
          whyWrong: q.why_wrong,
          rule: q.rule,
        })),
        severity: k.severity, // overwritten by applySeverityToAll
      }),
    );
  const knowledgePoints = sortBySeverity(applySeverityToAll(knowledgePointsCamel));

  // ──── Step F: AI 4-field summary ─────────────────────────────────
  const perSectionScores: PerSectionScores = {
    READING: readingAttempt.scaledScore ?? null,
    LISTENING: listeningAttempt.scaledScore ?? null,
    WRITING: writingAttempt.scaledScore ?? null,
    SPEAKING: speakingAttempt.scaledScore ?? null,
    VOCAB: vocabAttempt.scaledScore ?? null,
    GRAMMAR: grammarAttempt.scaledScore ?? null,
  };
  const overallScore = computeOverallScore(perSectionScores);

  let summaryResp;
  try {
    summaryResp = await summarizeDiagnose({
      exam_type: examType,
      week_start: wd.weekStart.toISOString().slice(0, 10),
      week_end: wd.weekEnd.toISOString().slice(0, 10),
      per_section_scores: perSectionScores as DiagnoseWirePerSectionScores,
      overall_score: overallScore,
      knowledge_points: analysisResp.knowledge_points,
      weak_count: analysisResp.knowledge_points.length,
    });
  } catch (err) {
    console.error("Diagnose summary failed:", err);
    const errMsg =
      err instanceof Error ? err.message.slice(0, 400) : String(err).slice(0, 400);
    await prisma.weeklyDiagnose.update({
      where: { id: wd.id },
      data: {
        status: "REPORT_FAILED",
        reportError: `summary_failed: ${errMsg}`,
        knowledgePoints: knowledgePoints as unknown as Prisma.InputJsonValue,
        perSectionScores: perSectionScores as unknown as Prisma.InputJsonValue,
        overallScore,
      },
    });
    return { kind: "FAILED", stage: "summary", detail: errMsg };
  }

  // ──── Step G: Save final report ──────────────────────────────────
  const summary = {
    strengths: summaryResp.strengths,
    weaknesses: summaryResp.weaknesses,
    priorityActions: summaryResp.priority_actions,
    narrativeZh: summaryResp.narrative_zh,
  };

  await prisma.weeklyDiagnose.update({
    where: { id: wd.id },
    data: {
      status: "REPORT_READY",
      reportAt: new Date(),
      knowledgePoints: knowledgePoints as unknown as Prisma.InputJsonValue,
      summary: summary as unknown as Prisma.InputJsonValue,
      perSectionScores: perSectionScores as unknown as Prisma.InputJsonValue,
      overallScore,
      reportError: null,
    },
  });

  return {
    kind: "READY",
    overallScore,
    weakCount: knowledgePoints.length,
  };
}

// ─── Helpers (mirrors route.ts) ──────────────────────────────────────

function sectionResultFromAttempt(attempt: {
  rawScore: number | null;
  totalPossible: number | null;
  scaledScore: number | null;
  weakPoints: unknown;
}): SectionGradeResult {
  const perItem = Array.isArray(attempt.weakPoints)
    ? (attempt.weakPoints as ItemResult[])
    : [];
  return {
    rawScore: attempt.rawScore ?? 0,
    totalPossible: attempt.totalPossible ?? perItem.length,
    scaledScore: attempt.scaledScore ?? 0,
    perItem,
  };
}

function writingGradeFromAttempt(attempt: {
  scaledScore: number | null;
  weakPoints: unknown;
}): WritingGrade | null {
  if (attempt.scaledScore === null) return null;
  const wp = attempt.weakPoints as
    | {
        scores?: {
          content?: number;
          communicative?: number;
          organisation?: number;
          language?: number;
        };
        feedback_zh?: string;
        error?: string;
      }
    | null;
  if (!wp || wp.error) return null;
  const s = wp.scores;
  if (
    !s ||
    typeof s.content !== "number" ||
    typeof s.communicative !== "number" ||
    typeof s.organisation !== "number" ||
    typeof s.language !== "number"
  ) {
    return null;
  }
  return {
    scores: {
      content: s.content,
      communicative: s.communicative,
      organisation: s.organisation,
      language: s.language,
    },
    feedbackZh: typeof wp.feedback_zh === "string" ? wp.feedback_zh : "",
  };
}

function speakingGradeFromAttempt(attempt: {
  speakingStatus: string | null;
  rubricScores: unknown;
  transcript: unknown;
}): SpeakingGrade | null {
  if (attempt.speakingStatus !== "SCORED") return null;
  const rs = attempt.rubricScores as
    | {
        grammarVocab?: number;
        discourseManagement?: number;
        pronunciation?: number;
        interactive?: number;
      }
    | null;
  if (
    !rs ||
    typeof rs.grammarVocab !== "number" ||
    typeof rs.pronunciation !== "number" ||
    typeof rs.interactive !== "number"
  ) {
    return null;
  }

  const transcript = transcriptToText(attempt.transcript);

  return {
    scores: {
      grammar: rs.grammarVocab,
      vocabulary: rs.grammarVocab,
      pronunciation: rs.pronunciation,
      interactiveCommunication: rs.interactive,
    },
    transcript,
  };
}

function transcriptToText(transcript: unknown): string {
  if (!Array.isArray(transcript)) return "";
  const parts: string[] = [];
  for (const turn of transcript) {
    if (
      typeof turn === "object" &&
      turn !== null &&
      "role" in turn &&
      "content" in turn &&
      (turn as { role: unknown }).role === "user" &&
      typeof (turn as { content: unknown }).content === "string"
    ) {
      parts.push((turn as { content: string }).content);
    }
  }
  return parts.join(" ").trim();
}

function computeOverallScore(scores: PerSectionScores): number {
  const values = Object.values(scores).filter(
    (v): v is number => typeof v === "number",
  );
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round(sum / values.length);
}
