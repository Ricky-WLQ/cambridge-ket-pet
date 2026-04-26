import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkAndRecordGeneration } from "@/lib/rateLimit";
import { generateDiagnose } from "@/lib/aiClient";
import { currentWeekStart, currentWeekEnd } from "@/lib/diagnose/week";
import { SECTION_TIME_LIMIT_SEC } from "@/lib/diagnose/sectionLimits";

export const maxDuration = 180; // long-running due to AI orchestration (4 parallel generators)

const DIAGNOSE_RATE_LIMIT_PER_HOUR = 3;

/**
 * POST /api/diagnose/me/generate
 *
 * Main orchestration entrypoint for the weekly diagnose. Idempotent — if a
 * WeeklyDiagnose row already exists for the current ISO-week (CST), returns
 * the existing pair `{ weeklyDiagnoseId, testId, generated: false }`.
 *
 * Pipeline (see plan T18):
 *   1. Auth + idempotency check
 *   2. Rate limit (3/hour per user)
 *   3. Resolve examType (from class.examFocus, default KET)
 *   4. Compute focus areas from last week's WeeklyDiagnose.knowledgePoints
 *   5. Call services/ai for the 4 AI-generated sections (R/L/W/S)
 *   6. Bank-sample 3 vocab Words + 3 GrammarQuestions
 *   7. Compose full 6-section payload
 *   8. Create Test + WeeklyDiagnose rows
 *   9. Mark audioStatus=GENERATING (background TTS deferred — see TODO below)
 *  10. Return { weeklyDiagnoseId, testId, generated: true }
 *
 * Architectural decisions:
 *  - Vocab + Grammar are bank-sampled here (NOT in services/ai) because the
 *    Word + GrammarQuestion tables live in apps/web's database. Keeping
 *    services/ai stateless is a deliberate simplification (see
 *    services/ai/app/agents/diagnose_generator.py docstring).
 *  - Listening audio rendering is deferred. The existing listening pattern
 *    in `apps/web/src/app/api/tests/generate/route.ts` (semaphore + fire-
 *    and-forget setImmediate + Edge-TTS pipeline) is tightly coupled to
 *    `ListeningTestPayloadV2` (camelCase). The diagnose's listening payload
 *    arrives in the raw snake_case Pydantic shape and the conversion helper
 *    `snakeToCamelListening` in lib/audio/generate.ts is private. Rather
 *    than expand scope here, we set audioStatus=GENERATING and leave a TODO
 *    for a follow-up task to wire up actual TTS rendering. The diagnose
 *    listening section runner can already render a "preparing audio"
 *    placeholder while audioStatus=GENERATING.
 *  - Focus-area extraction from last week's knowledgePoints is approximate —
 *    we count category frequencies, not real ExamPoint FKs. The Python
 *    orchestrator currently treats focus_areas as seed_exam_points hints
 *    only (see services/ai/app/agents/diagnose_generator.py:_focus_exam_points),
 *    so coarse-grained signals are acceptable v1.
 */
export async function POST() {
  // ──── Step 1: Auth ────────────────────────────────────────────────
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // ──── Step 2: Idempotency ────────────────────────────────────────
  const weekStart = currentWeekStart();
  const weekEnd = currentWeekEnd();

  const existing = await prisma.weeklyDiagnose.findUnique({
    where: { userId_weekStart: { userId, weekStart } },
  });
  if (existing) {
    return NextResponse.json({
      weeklyDiagnoseId: existing.id,
      testId: existing.testId,
      generated: false,
    });
  }

  // ──── Step 3: Rate limit ─────────────────────────────────────────
  const rl = await checkAndRecordGeneration(
    userId,
    "diagnose_generate",
    DIAGNOSE_RATE_LIMIT_PER_HOUR,
  );
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "本周诊断生成调用次数已达上限，请稍后再试",
        resetAt: rl.resetAt.toISOString(),
      },
      { status: 429 },
    );
  }

  // ──── Step 4: Resolve examType ───────────────────────────────────
  // Pick the user's primary class examFocus. Default to KET when the
  // user is in no class or their class has no examFocus configured.
  const member = await prisma.classMember.findFirst({
    where: { userId },
    include: { class: { select: { examFocus: true } } },
  });
  const examType = member?.class.examFocus ?? "KET";

  // ──── Step 5: Compute focus areas from last week ─────────────────
  const lastWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const prev = await prisma.weeklyDiagnose.findUnique({
    where: { userId_weekStart: { userId, weekStart: lastWeekStart } },
  });

  type FocusArea = { exam_point_id: string; wrong_count: number };
  let focusAreas: FocusArea[] = [];
  if (prev?.knowledgePoints) {
    // Walk knowledgePoints[].category counting question occurrences.
    // This is a coarse signal — real ExamPoint FKs are not currently
    // surfaced by the AI analysis output. See module-docstring TODO.
    type RawKP = { category?: string; questions?: unknown[] };
    const kps = prev.knowledgePoints as RawKP[];
    const counts = new Map<string, number>();
    for (const kp of kps) {
      if (typeof kp?.category !== "string") continue;
      const n = Array.isArray(kp.questions) ? kp.questions.length : 0;
      if (n <= 0) continue;
      counts.set(kp.category, (counts.get(kp.category) ?? 0) + n);
    }
    focusAreas = [...counts.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([category, count]) => ({
        exam_point_id: category,
        wrong_count: count,
      }));
  }

  // ──── Step 6: Call services/ai for the 4 AI-generated sections ──
  let aiResponse;
  try {
    aiResponse = await generateDiagnose({
      exam_type: examType,
      week_start: weekStart.toISOString().slice(0, 10),
      focus_areas: focusAreas,
    });
  } catch (err) {
    console.error("Diagnose AI generation failed:", err);
    return NextResponse.json(
      {
        error: "诊断生成失败，请稍后重试",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  // ──── Step 7: Extract per-section content from raw AI response ──
  // The aiResponse fields (reading/listening/writing/speaking) are typed
  // as `unknown` at the aiClient boundary. We cast to dynamic shapes
  // matching the Python schemas — see services/ai/app/schemas/*.py.
  // No zod validation here: the Python side has already validated.
  type RawReadingResponse = {
    passage: string | null;
    questions: Array<{
      id: string;
      type: string;
      prompt: string;
      options: string[] | null;
      answer: string;
      explanation_zh: string;
      exam_point_id: string;
    }>;
    time_limit_sec: number;
  };
  type RawListeningResponse = {
    version: 2;
    exam_type: "KET" | "PET";
    scope: "FULL" | "PART";
    parts: Array<{
      part_number: number;
      kind: string;
      questions: Array<{
        id: string;
        prompt: string;
        type: string;
        options: Array<{ id: string; text?: string }> | null;
        answer: string;
      }>;
    }>;
  };
  type RawWritingResponse = {
    task_type: string;
    prompt: string;
    content_points: string[];
    min_words: number;
  };
  type RawSpeakingResponse = {
    level: "KET" | "PET";
    initialGreeting: string;
    parts: Array<{
      partNumber: number;
      title: string;
      targetMinutes: number;
      examinerScript: string[];
      coachingHints: string;
      photoKey: string | null;
    }>;
  };

  const rawReading = aiResponse.reading as RawReadingResponse;
  const rawListening = aiResponse.listening as RawListeningResponse;
  const rawWriting = aiResponse.writing as RawWritingResponse;
  const rawSpeaking = aiResponse.speaking as RawSpeakingResponse;

  // Reading: take up to 3 questions for diagnose's smaller scope.
  const readingQuestions = rawReading.questions.slice(0, 3).map((q, idx) => {
    // For MCQ-style questions, derive correctIndex from `answer` letter
    // ('A'/'B'/'C'/'D'). For non-MCQ, we fall back to 0 (the diagnose
    // reading section assumes MCQ — this is a known caveat documented in
    // the v2 plan; non-MCQ reading parts are disabled for diagnose v1).
    const opts = q.options ?? [];
    let correctIndex = 0;
    if (q.answer.length === 1) {
      const letter = q.answer.toUpperCase().charCodeAt(0) - 65;
      if (letter >= 0 && letter < opts.length) correctIndex = letter;
    }
    return {
      id: q.id ?? `r${idx + 1}`,
      text: q.prompt,
      options: opts,
      correctIndex,
      examPointId: q.exam_point_id,
    };
  });

  // Listening: extract camelCase parts shape for Test.payload. The full
  // raw audio_script stays inside Test.payload via the listening branch
  // of a future TTS task — for now we only carry the question-grading
  // metadata the runner needs.
  const listeningParts = rawListening.parts.map((p) => ({
    partNumber: p.part_number,
    partType: p.kind,
    audioStartSec: 0, // populated by future TTS task
    audioEndSec: 0,
    questions: p.questions.map((q, idx) => {
      const opts = (q.options ?? []).map((o) => o.text ?? "");
      let correctIndex = 0;
      if (q.answer.length === 1) {
        const letter = q.answer.toUpperCase().charCodeAt(0) - 65;
        if (letter >= 0 && letter < opts.length) correctIndex = letter;
      }
      return {
        id: q.id ?? `l${idx + 1}`,
        text: q.prompt,
        options: opts,
        correctIndex,
      };
    }),
  }));

  // Writing: 1 prompt per diagnose v1.
  // Note: services/ai writing schema task_type is EMAIL/PICTURE_STORY/
  // LETTER_OR_STORY but DiagnoseWritingContent.taskType (types.ts) is
  // EMAIL/STORY/ARTICLE/MESSAGE. Map them: EMAIL→EMAIL, PICTURE_STORY
  // and LETTER_OR_STORY → STORY (the diagnose UI doesn't differentiate).
  let writingTaskType: "EMAIL" | "STORY" | "ARTICLE" | "MESSAGE" = "EMAIL";
  if (rawWriting.task_type === "PICTURE_STORY") writingTaskType = "STORY";
  else if (rawWriting.task_type === "LETTER_OR_STORY") writingTaskType = "STORY";
  // EMAIL falls through.

  // ──── Step 8: Bank-sample VOCAB ──────────────────────────────────
  // Pick 3 random Words from CORE/RECOMMENDED tiers for examType.
  // Random ordering is achieved by fetching ~60 candidates then
  // shuffling — a simple approach that doesn't need raw SQL.
  const vocabCandidates = await prisma.word.findMany({
    where: {
      examType,
      tier: { in: ["CORE", "RECOMMENDED"] },
    },
    take: 60,
  });
  const vocabPicks = vocabCandidates
    .slice() // copy before sort
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((w) => {
      // Build a fill-in-the-blank pattern from the example sentence,
      // replacing the headword (case-insensitive whole-word) with "____".
      // Many Words have null `example` — fall back to a generic template.
      const base = w.example ?? `Example: ___ is a useful word.`;
      const headword = w.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // regex-escape
      const fillPattern = base.replace(
        new RegExp(`\\b${headword}\\b`, "i"),
        "____",
      );
      return {
        wordId: w.id,
        word: w.word,
        fillPattern,
        glossZh: w.glossZh, // never null in schema
      };
    });

  // ──── Step 9: Bank-sample GRAMMAR ────────────────────────────────
  // Find questionIds the user has seen in the last 4 weeks (avoid
  // immediate repeats), then pick 3 unseen for examType.
  const fourWeeksAgo = new Date(weekStart.getTime() - 28 * 24 * 60 * 60 * 1000);
  const seenIds = await prisma.grammarProgress.findMany({
    where: { userId, createdAt: { gte: fourWeeksAgo } },
    select: { questionId: true },
  });
  const seenSet = new Set(seenIds.map((r) => r.questionId));
  const grammarCandidates = await prisma.grammarQuestion.findMany({
    where: {
      examType,
      ...(seenSet.size > 0 ? { id: { notIn: [...seenSet] } } : {}),
    },
    take: 60,
  });
  // Fall back to including seen questions if the unseen pool is too small.
  // (Fresh accounts often have very few grammar questions in the bank.)
  const grammarPool =
    grammarCandidates.length >= 3
      ? grammarCandidates
      : await prisma.grammarQuestion.findMany({
          where: { examType },
          take: 60,
        });
  const grammarItems = grammarPool
    .slice()
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((q) => ({
      questionId: q.id,
      topicId: q.topicId,
      questionText: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
    }));

  // ──── Step 10: Compose full DiagnosePayload ──────────────────────
  const payload = {
    weekStart: weekStart.toISOString().slice(0, 10),
    weekEnd: weekEnd.toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    examType,
    focusAreas: focusAreas.map((f) => f.exam_point_id),
    sections: {
      READING: {
        passage: rawReading.passage ?? null,
        questions: readingQuestions,
        timeLimitSec: SECTION_TIME_LIMIT_SEC.READING,
      },
      LISTENING: {
        parts: listeningParts,
        timeLimitSec: SECTION_TIME_LIMIT_SEC.LISTENING,
      },
      WRITING: {
        taskType: writingTaskType,
        prompt: rawWriting.prompt,
        contentPoints: rawWriting.content_points ?? [],
        minWords: rawWriting.min_words,
        timeLimitSec: SECTION_TIME_LIMIT_SEC.WRITING,
      },
      SPEAKING: {
        // Speaking prompts/photoKeys/persona live on Test row columns.
        timeLimitSec: SECTION_TIME_LIMIT_SEC.SPEAKING,
      },
      VOCAB: {
        items: vocabPicks,
        timeLimitSec: SECTION_TIME_LIMIT_SEC.VOCAB,
      },
      GRAMMAR: {
        questions: grammarItems,
        timeLimitSec: SECTION_TIME_LIMIT_SEC.GRAMMAR,
      },
    },
  };

  // Speaking row-column data (denormalized from rawSpeaking).
  const speakingPhotoKeys = rawSpeaking.parts
    .map((p) => p.photoKey)
    .filter((k): k is string => typeof k === "string" && k.length > 0);

  // ──── Step 11: Create Test + WeeklyDiagnose rows ─────────────────
  // Sequential create is acceptable here: WeeklyDiagnose.testId has a
  // FK to Test.id with @unique. The two rows ALWAYS create together —
  // there is no "Test without WeeklyDiagnose" path for kind=DIAGNOSE.
  // Wrapping in a transaction adds atomicity at the cost of one extra
  // round-trip; for v1 the rare orphan-Test risk on a partial failure
  // is acceptable (an admin can clean up by listing Tests with kind=
  // DIAGNOSE missing the back-relation).
  const { test, wd } = await prisma.$transaction(async (tx) => {
    const createdTest = await tx.test.create({
      data: {
        userId,
        examType,
        kind: "DIAGNOSE",
        mode: "MOCK",
        difficulty: examType === "KET" ? "A2" : "B1",
        payload: payload as unknown as Prisma.JsonObject,
        generatedBy: "deepseek-chat",
        // Listening audio: marked GENERATING for background pickup.
        // TODO(diagnose-listening-audio): wire up Edge-TTS rendering of
        // the diagnose listening payload. Mirror the pattern in
        // apps/web/src/app/api/tests/generate/route.ts (semaphore +
        // setImmediate + generateListeningAudio). Will need to either
        // (a) export `snakeToCamelListening` from lib/audio/generate.ts
        // and pass rawListening in, or (b) re-fetch listening separately
        // via fetchListeningPayload (wastes one AI call but is clean).
        audioStatus: "GENERATING",
        audioGenStartedAt: new Date(),
        // Speaking row-columns
        speakingPrompts: rawSpeaking as unknown as Prisma.JsonObject,
        speakingPhotoKeys,
        speakingPersona: examType,
      },
      select: { id: true },
    });

    const createdWd = await tx.weeklyDiagnose.create({
      data: {
        userId,
        weekStart,
        weekEnd,
        testId: createdTest.id,
        examType,
        status: "PENDING",
      },
      select: { id: true },
    });

    return { test: createdTest, wd: createdWd };
  });

  // ──── Step 12: Trigger listening audio generation (background) ──
  // Deferred — see TODO above. A future task will wire this up.

  // ──── Step 13: Return ─────────────────────────────────────────────
  return NextResponse.json(
    {
      weeklyDiagnoseId: wd.id,
      testId: test.id,
      generated: true,
    },
    { status: 201 },
  );
}
