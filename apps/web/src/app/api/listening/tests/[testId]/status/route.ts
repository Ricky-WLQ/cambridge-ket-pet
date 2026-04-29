import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { t } from "@/i18n/zh-CN";
import { pickTone } from "@/i18n/voice";
import { derivePortalFromRequest } from "@/i18n/derivePortalFromRequest";

/**
 * GET /api/listening/tests/[testId]/status
 *
 * Used by the listening UI to poll for audio generation progress.
 * Returns audio-state fields plus (once READY) the payload + per-segment
 * timestamps so the client can render the player + transcript.
 *
 * Ownership: `Test.userId` is set at creation time, so we compare it
 * directly to the session user. Non-owner requests get 404 (not 403)
 * to prevent test-ID enumeration.
 *
 * Diagnose payload shape adapter (C5)
 * -----------------------------------
 * For Test.kind === "DIAGNOSE", the payload is shaped as the parent
 * `DiagnosePayload` type (with all 6 sections), but the listening runner
 * expects the `ListeningTestPayloadV2` shape it gets from regular listening
 * tests. We extract `payload.sections.LISTENING` and adapt it to the V2
 * shape — filling in the few fields the V2 carries that the diagnose
 * generator doesn't emit (`instructionZh` defaults, an `examType` echo,
 * a `version: 2` discriminator, etc.). Without this, the runner crashes
 * trying to read `parts[].instructionZh` on a payload that doesn't have it.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ testId: string }> },
) {
  const { testId } = await params;

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    const portal = derivePortalFromRequest(req);
    return NextResponse.json(
      { error: pickTone(t.api.unauthorized, portal) },
      { status: 401 },
    );
  }

  const test = await prisma.test.findUnique({
    where: { id: testId },
    select: {
      id: true,
      userId: true,
      kind: true,
      payload: true,
      audioStatus: true,
      audioR2Key: true,
      audioSegments: true,
      audioErrorMessage: true,
      audioGenStartedAt: true,
    },
  });

  if (!test || test.userId !== userId) {
    // Return 404 (not 403) to prevent test-ID enumeration.
    return NextResponse.json({ error: "test_not_found" }, { status: 404 });
  }

  const base = {
    testId: test.id,
    kind: test.kind,
    audioStatus: test.audioStatus,
    audioReady: test.audioStatus === "READY" && !!test.audioR2Key,
    audioError: test.audioErrorMessage,
    audioElapsedMs: test.audioGenStartedAt
      ? Date.now() - test.audioGenStartedAt.getTime()
      : null,
  };

  if (test.audioStatus === "READY") {
    const payload =
      test.kind === "DIAGNOSE"
        ? transformDiagnosePayloadToListeningV2(test.payload)
        : test.payload;
    return NextResponse.json({
      ...base,
      payload,
      audioSegments: test.audioSegments,
    });
  }

  return NextResponse.json(base);
}

/**
 * Adapt a DIAGNOSE Test.payload into the ListeningTestPayloadV2 shape the
 * listening runner consumes. Only the `LISTENING` section of the diagnose
 * payload contributes; the other sections are dropped (the listening runner
 * never reads them).
 *
 * Field defaults:
 *  - `version`: 2 (the V2 discriminator the runner expects)
 *  - `instructionZh`: a generic Chinese prompt if the diagnose generator
 *    didn't emit one. The runner renders this in the part header.
 *  - `partType` / `kind`: passes through whatever the diagnose generator
 *    emitted; falls back to MCQ_3_TEXT (the most common KET/PET listening
 *    question type) so the QuestionRenderer doesn't crash on undefined.
 *  - audio offsets default to 0 if missing — they're only used by the
 *    AudioPlayer's per-segment replay, which is disabled in MOCK mode anyway.
 *
 * Returns the input untouched if it doesn't match the diagnose-payload
 * shape (defensive — we'd rather pass through than crash).
 */
function transformDiagnosePayloadToListeningV2(diagnosePayload: unknown): unknown {
  if (
    typeof diagnosePayload !== "object" ||
    diagnosePayload === null ||
    !("sections" in diagnosePayload)
  ) {
    return diagnosePayload;
  }
  const dp = diagnosePayload as {
    examType?: "KET" | "PET";
    sections?: { LISTENING?: unknown };
  };
  const listening = dp.sections?.LISTENING;
  if (
    typeof listening !== "object" ||
    listening === null ||
    !("parts" in listening)
  ) {
    return diagnosePayload;
  }
  const lp = listening as {
    parts?: Array<{
      partNumber?: number;
      partType?: string;
      instructionZh?: string;
      audioStartSec?: number;
      audioEndSec?: number;
      questions?: unknown[];
    }>;
  };
  const parts = (lp.parts ?? []).map((p, i) => ({
    partNumber: p.partNumber ?? i + 1,
    kind: p.partType ?? "MCQ_3_TEXT",
    partType: p.partType ?? "MCQ_3_TEXT",
    instructionZh: p.instructionZh ?? "请听音频，回答下面的问题。",
    previewSec: 0,
    playRule: "PER_PART" as const,
    audioScript: [] as unknown[],
    audioStartSec: p.audioStartSec ?? 0,
    audioEndSec: p.audioEndSec ?? 0,
    questions: transformDiagnoseListeningQuestions(p.questions ?? []),
  }));
  return {
    version: 2 as const,
    examType: dp.examType ?? "KET",
    scope: "FULL" as const,
    parts,
    cefrLevel: dp.examType === "PET" ? "B1" : "A2",
    generatedBy: "diagnose-v2",
  };
}

/**
 * Adapt the diagnose listening question shape (`{ id, text, options: string[],
 * correctIndex }`) into the V2 listening question shape the runner consumes
 * (`{ id, prompt, type, options: { id, text }[], answer, ... }`). The
 * letter-keyed `id` ("A", "B", "C", ...) matches the rest of the V2 path
 * (Mcq3Text reads `opt.id` for radio value + `correctAnswer` matching).
 */
function transformDiagnoseListeningQuestions(
  questions: unknown[],
): unknown[] {
  return questions.map((q) => {
    if (typeof q !== "object" || q === null) return q;
    const dq = q as {
      id?: string;
      text?: string;
      prompt?: string;
      options?: unknown;
      correctIndex?: number;
      examPointId?: string;
    };
    // Already in V2 shape (regular listening test) — pass through.
    if (
      typeof dq.prompt === "string" &&
      Array.isArray(dq.options) &&
      dq.options.length > 0 &&
      typeof (dq.options[0] as { id?: unknown }).id === "string"
    ) {
      return q;
    }
    // Diagnose-native shape: text + options as string[] + correctIndex.
    const optionStrings = Array.isArray(dq.options)
      ? (dq.options as unknown[])
      : [];
    const adaptedOptions = optionStrings.map((opt, i) => ({
      id: String.fromCharCode(65 + i), // "A", "B", "C"
      text: typeof opt === "string" ? opt : "",
    }));
    const correctIdx =
      typeof dq.correctIndex === "number" ? dq.correctIndex : -1;
    const answer =
      correctIdx >= 0 && correctIdx < adaptedOptions.length
        ? adaptedOptions[correctIdx].id
        : "";
    return {
      id: dq.id ?? "",
      prompt: dq.text ?? dq.prompt ?? "",
      type: "MCQ_3_TEXT" as const,
      options: adaptedOptions,
      answer,
      explanationZh: "",
      examPointId: dq.examPointId ?? "",
    };
  });
}
