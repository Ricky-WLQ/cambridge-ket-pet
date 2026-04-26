import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { auth } from "@/lib/auth";
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

export const maxDuration = 180;

/**
 * POST /api/diagnose/me/finalize
 *
 * The post-submit pipeline that runs after all 6 sections are submitted to
 * produce the final weekly report. Idempotent — safe to re-call after a
 * partial failure; only re-runs steps that haven't completed.
 *
 * Pipeline (T21):
 *   A. AI-grade writing (gradeWriting from aiClient) if writing is SUBMITTED
 *      but not yet GRADED.
 *   B. Wait for the speaking pipeline to finish scoring (poll up to 90s).
 *   C. Collect wrong answers across all 6 sections (collectWrongAnswers).
 *   D. AI 8-category knowledge-point analysis (analyzeDiagnose).
 *   E. Apply severity rule and sort.
 *   F. AI 4-field summary (summarizeDiagnose).
 *   G. Persist on WeeklyDiagnose: knowledgePoints, summary, perSectionScores,
 *      overallScore, status=REPORT_READY.
 *
 * Failure semantics:
 *   - Writing grading failure: per-attempt weakPoints.error flag, but the
 *     pipeline proceeds (writing sub-score becomes null in perSectionScores).
 *   - Speaking still pending after 90s: weakPoints.error="speaking_score_pending"
 *     mirror, pipeline proceeds.
 *   - Analysis or summary failure: WeeklyDiagnose.status=REPORT_FAILED with
 *     reportError. The student is unblocked either way per spec — both
 *     REPORT_READY and REPORT_FAILED count as ungated states.
 *
 * Idempotency:
 *   - If status===REPORT_READY, return existing report immediately (no re-AI).
 *   - If writing is already GRADED, skip step A.
 *   - If speaking is already SCORED, skip step B's poll.
 */
export async function POST() {
  // ──── Step 1: Auth ────────────────────────────────────────────────
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // ──── Step 2: Find current-week WeeklyDiagnose ───────────────────
  const weekStart = currentWeekStart();
  const wd = await prisma.weeklyDiagnose.findUnique({
    where: { userId_weekStart: { userId, weekStart } },
    include: { test: { select: { payload: true, kind: true } } },
  });
  if (!wd) {
    return NextResponse.json(
      { error: "本周诊断尚未生成" },
      { status: 404 },
    );
  }

  // Idempotency: already-finalized — return cached report.
  if (wd.status === "REPORT_READY") {
    return NextResponse.json({
      status: "REPORT_READY",
      overallScore: wd.overallScore,
      weakCount: Array.isArray(wd.knowledgePoints)
        ? (wd.knowledgePoints as unknown[]).length
        : 0,
      cached: true,
    });
  }

  // ──── Step 3: Verify all 6 sections done ─────────────────────────
  // Section status in {SUBMITTED, GRADED, AUTO_SUBMITTED} = ready to finalize.
  const finishedSet = new Set([
    "SUBMITTED",
    "GRADED",
    "AUTO_SUBMITTED",
  ] as const);
  const inProgressSections: string[] = [];
  if (!finishedSet.has(wd.readingStatus as never)) inProgressSections.push("READING");
  if (!finishedSet.has(wd.listeningStatus as never)) inProgressSections.push("LISTENING");
  if (!finishedSet.has(wd.writingStatus as never)) inProgressSections.push("WRITING");
  if (!finishedSet.has(wd.speakingStatus as never)) inProgressSections.push("SPEAKING");
  if (!finishedSet.has(wd.vocabStatus as never)) inProgressSections.push("VOCAB");
  if (!finishedSet.has(wd.grammarStatus as never)) inProgressSections.push("GRAMMAR");
  if (inProgressSections.length > 0) {
    return NextResponse.json(
      {
        error: "部分诊断尚未提交",
        inProgressSections,
      },
      { status: 409 },
    );
  }

  // ──── Step 4: Load all 6 attempts + payload ──────────────────────
  if (wd.test?.kind !== "DIAGNOSE") {
    return NextResponse.json(
      { error: "Linked Test is not a DIAGNOSE row" },
      { status: 500 },
    );
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
    return NextResponse.json(
      { error: "Some sections are missing attemptId — cannot finalize" },
      { status: 500 },
    );
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
    return NextResponse.json(
      { error: "Failed to load all section attempts" },
      { status: 500 },
    );
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
      // Mark with error flag; don't fail finalize. Writing score is null in report.
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
    // Speaking is graded asynchronously by the speaking pipeline. Poll the
    // row at 3-second intervals up to 90s (30 attempts).
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
    // Re-load if poll loop didn't break (still pending after 90s).
    if (
      speakingAttempt.speakingStatus !== "SCORED" &&
      speakingAttempt.speakingStatus !== "FAILED"
    ) {
      const reloaded = await prisma.testAttempt.findUnique({
        where: { id: speakingAttempt.id },
      });
      if (reloaded) speakingAttempt = reloaded;
    }
    if (
      speakingAttempt.speakingStatus !== "SCORED" &&
      speakingAttempt.speakingStatus !== "FAILED"
    ) {
      // Persist a marker on weakPoints to surface the timeout in the report,
      // but proceed with finalize. Speaking score will be null.
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
  // R/L/V/G: weakPoints JSON holds the perItem[] array (from T20).
  const readingResult = sectionResultFromAttempt(readingAttempt);
  const listeningResult = sectionResultFromAttempt(listeningAttempt);
  const vocabResult = sectionResultFromAttempt(vocabAttempt);
  const grammarResult = sectionResultFromAttempt(grammarAttempt);

  // Writing: extract from weakPoints.scores + feedback_zh.
  const writingGrade = writingGradeFromAttempt(writingAttempt);
  // Speaking: extract from rubricScores (4-criteria mapping) + transcript.
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
    return NextResponse.json(
      {
        status: "REPORT_FAILED",
        error: "Analysis step failed",
        detail: errMsg,
      },
      { status: 502 },
    );
  }

  // ──── Step E: Apply severity + sort ──────────────────────────────
  const knowledgePointsCamel: KnowledgePointGroup[] = analysisResp.knowledge_points.map(
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
        // Save partial: knowledgePoints + perSectionScores can still drive
        // the UI even without the narrative summary.
        knowledgePoints: knowledgePoints as unknown as Prisma.InputJsonValue,
        perSectionScores: perSectionScores as unknown as Prisma.InputJsonValue,
        overallScore,
      },
    });
    return NextResponse.json(
      {
        status: "REPORT_FAILED",
        error: "Summary step failed",
        detail: errMsg,
      },
      { status: 502 },
    );
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

  return NextResponse.json({
    status: "REPORT_READY",
    overallScore,
    weakCount: knowledgePoints.length,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Reconstruct a SectionGradeResult from a graded R/L/V/G TestAttempt.
 * The submit route (T20) stored `weakPoints` as the perItem[] array, and
 * `rawScore`/`totalPossible`/`scaledScore` as scalar columns. If
 * weakPoints is missing or malformed we fall back to an empty perItem so
 * collectWrongAnswers degrades to "no contribution from this section"
 * rather than crashing finalize.
 */
function sectionResultFromAttempt(
  attempt: { rawScore: number | null; totalPossible: number | null; scaledScore: number | null; weakPoints: unknown },
): SectionGradeResult {
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

/**
 * Reconstruct a WritingGrade from the writing TestAttempt's weakPoints JSON
 * (which the writing grader stored as { scores, feedback_zh, specific_suggestions_zh }).
 * Returns null if the attempt was never successfully graded — this signals
 * collectWrongAnswers to skip the WRITING rubric synthesis.
 */
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

/**
 * Reconstruct a SpeakingGrade from the speaking TestAttempt's rubricScores
 * (stored by the speaking-scoring pipeline as { grammarVocab,
 * discourseManagement, pronunciation, interactive, ... }) + transcript JSON.
 *
 * The Cambridge speaking rubric in collectWrongAnswers uses 4 fields named
 * { grammar, vocabulary, pronunciation, interactiveCommunication }. We map:
 *   - grammarVocab        → grammar AND vocabulary (split)
 *   - discourseManagement → not used directly (rolled into interactiveCommunication)
 *   - pronunciation       → pronunciation
 *   - interactive         → interactiveCommunication
 *
 * Returns null if the speaking attempt never reached SCORED — signals
 * collectWrongAnswers to skip SPEAKING rubric synthesis.
 */
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

  // Best-effort: flatten transcript turns into a single string for rubric
  // synthesis (collectWrongAnswers shows the user's spoken response when a
  // criterion is < 4/5). We only extract user-side content.
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

/** Flatten a transcript JSON (TranscriptTurn[]) into the user's words. */
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

/**
 * Compute the weighted overall score from per-section scaled scores.
 * Equal weighting across all available sections (sections with null scores
 * are excluded from both numerator and denominator). Returns 0 if no
 * sections graded.
 */
function computeOverallScore(scores: PerSectionScores): number {
  const values = Object.values(scores).filter(
    (v): v is number => typeof v === "number",
  );
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round(sum / values.length);
}
