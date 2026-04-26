/**
 * Call the AI service /grammar-generate endpoint to seed ~15 MCQ questions
 * per (examType, topicId). Persists to the GrammarQuestion table.
 *
 * Idempotent — for each (examType, topicId), checks current question count
 * and only requests `quota - count` more. So re-runs top up topics that fell
 * short (e.g. AI failures) and skip topics already at quota.
 *
 * Loads env from BOTH apps/web/.env and services/ai/.env (mirrors the
 * Task 10 dual-load pattern in seed-grammar-glosses.ts) so the secret is
 * non-empty regardless of which file it lives in.
 *
 * Usage:
 *   pnpm tsx scripts/seed-grammar-questions.ts
 *   pnpm tsx scripts/seed-grammar-questions.ts --quota 20    (override default 15)
 *   pnpm tsx scripts/seed-grammar-questions.ts --examType KET
 */
import "dotenv/config";
import path from "node:path";
import dotenv from "dotenv";
import { ExamType, PrismaClient } from "@prisma/client";

// Pull INTERNAL_AI_SHARED_SECRET / INTERNAL_AI_URL from services/ai/.env
// if they aren't already in process.env (matches Task 10's dual-env pattern).
dotenv.config({ path: path.resolve(__dirname, "../../../services/ai/.env") });

const prisma = new PrismaClient();

const AI_URL = process.env.INTERNAL_AI_URL || "http://localhost:8001";
const SECRET = process.env.INTERNAL_AI_SHARED_SECRET || process.env.INTERNAL_SHARED_SECRET || "";
const DEFAULT_QUOTA = 15;
const BATCH_PER_CALL = 10;

if (!SECRET) {
  throw new Error(
    "INTERNAL_AI_SHARED_SECRET (or INTERNAL_SHARED_SECRET) env var is required",
  );
}

interface AiMCQ {
  question: string;
  options: string[];
  correct_index: number;
  explanation_en?: string | null;
  explanation_zh: string;
  difficulty: number;
}

async function callGenerate(
  examType: ExamType,
  topicId: string,
  spec: string,
  examples: string[],
  existingQuestions: string[],
  count: number,
): Promise<AiMCQ[]> {
  const res = await fetch(`${AI_URL}/grammar-generate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${SECRET}`,
    },
    body: JSON.stringify({ examType, topicId, spec, examples, existingQuestions, count }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI service ${res.status}: ${body.slice(0, 500)}`);
  }
  const json = (await res.json()) as { questions: AiMCQ[] };
  return json.questions;
}

async function processTopic(
  topic: {
    id: string;
    examType: ExamType;
    topicId: string;
    spec: string;
    examples: string[];
  },
  quota: number,
): Promise<{ added: number; failed: boolean }> {
  const have = await prisma.grammarQuestion.findMany({
    where: { examType: topic.examType, topicId: topic.id },
    select: { question: true },
  });
  const need = quota - have.length;
  if (need <= 0) {
    console.log(`[${topic.examType}/${topic.topicId}] already has ${have.length}, skipping`);
    return { added: 0, failed: false };
  }
  console.log(`[${topic.examType}/${topic.topicId}] need ${need} more (have ${have.length})`);
  const existingFromStart = have.map((q) => q.question);

  let added = 0;
  while (added < need) {
    const batchSize = Math.min(BATCH_PER_CALL, need - added);
    // Re-read existing each batch so the second batch sees the first batch's
    // newly-inserted rows (helps the agent's dedupe pass).
    const fresh = await prisma.grammarQuestion.findMany({
      where: { examType: topic.examType, topicId: topic.id },
      select: { question: true },
    });
    const existingNow = Array.from(
      new Set([...existingFromStart, ...fresh.map((q) => q.question)]),
    );
    let items: AiMCQ[];
    try {
      items = await callGenerate(
        topic.examType,
        topic.topicId,
        topic.spec,
        topic.examples,
        existingNow,
        batchSize,
      );
    } catch (err) {
      console.error(`[${topic.examType}/${topic.topicId}] batch failed:`, err);
      return { added, failed: true };
    }
    for (const it of items) {
      await prisma.grammarQuestion.create({
        data: {
          examType: topic.examType,
          topicId: topic.id,
          question: it.question,
          options: it.options,
          correctIndex: it.correct_index,
          explanationEn: it.explanation_en ?? null,
          explanationZh: it.explanation_zh,
          difficulty: it.difficulty,
          source: `ai:deepseek:${new Date().toISOString().slice(0, 10)}`,
        },
      });
      added++;
    }
    console.log(
      `[${topic.examType}/${topic.topicId}] +${items.length}, total ${have.length + added}`,
    );
  }
  return { added, failed: false };
}

async function main() {
  const args = process.argv.slice(2);
  const quota = args.includes("--quota")
    ? parseInt(args[args.indexOf("--quota") + 1], 10)
    : DEFAULT_QUOTA;
  const examArg = args.includes("--examType") ? args[args.indexOf("--examType") + 1] : null;

  const where = examArg === "KET" || examArg === "PET" ? { examType: examArg as ExamType } : {};
  const topics = await prisma.grammarTopic.findMany({
    where,
    select: { id: true, examType: true, topicId: true, spec: true, examples: true },
    orderBy: [{ examType: "asc" }, { topicId: "asc" }],
  });
  console.log(`[grammar/questions] processing ${topics.length} topics, quota=${quota}`);

  let totalAdded = 0;
  let topicsFailed = 0;
  for (const t of topics) {
    const { added, failed } = await processTopic(t, quota);
    totalAdded += added;
    if (failed) topicsFailed++;
  }
  console.log(
    `[grammar/questions] DONE — added ${totalAdded} questions; ${topicsFailed} topics had failures (re-run to retry)`,
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
