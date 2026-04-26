import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { runFinalizePipeline } from "@/lib/diagnose/finalize";

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
 * The pipeline body lives in `@/lib/diagnose/finalize.runFinalizePipeline`
 * so it can also be invoked server-side from the hub page (after the
 * COMPLETE → REPORT_READY transition is detected). This route is the
 * client-facing entrypoint that adds auth + HTTP serialization.
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
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const result = await runFinalizePipeline(userId);

  switch (result.kind) {
    case "MISSING":
      return NextResponse.json(
        { error: result.reason },
        { status: result.reason === "本周诊断尚未生成" ? 404 : 500 },
      );
    case "NOT_READY":
      return NextResponse.json(
        {
          error: "部分诊断尚未提交",
          inProgressSections: result.inProgressSections,
        },
        { status: 409 },
      );
    case "ALREADY_FINALIZED":
      return NextResponse.json({
        status: "REPORT_READY",
        overallScore: result.overallScore,
        weakCount: result.weakCount,
        cached: true,
      });
    case "FAILED":
      return NextResponse.json(
        {
          status: "REPORT_FAILED",
          error:
            result.stage === "analysis"
              ? "Analysis step failed"
              : "Summary step failed",
          detail: result.detail,
        },
        { status: 502 },
      );
    case "READY":
      return NextResponse.json({
        status: "REPORT_READY",
        overallScore: result.overallScore,
        weakCount: result.weakCount,
      });
  }
}
