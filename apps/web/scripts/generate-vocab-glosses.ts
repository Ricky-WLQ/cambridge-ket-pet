/**
 * Call the AI service /vocab-gloss endpoint to fill Word.glossZh, Word.example,
 * and derive Word.tier from the returned cefrLevel.
 *
 * Idempotent — only requests rows where glossZh is empty.
 *
 * Tier mapping (only applied to rows currently at default RECOMMENDED;
 * preserves Task 13's manual CORE/EXTRA overrides):
 *   KET: A1 → CORE, A2 → RECOMMENDED, B1+ → EXTRA
 *   PET: A1+A2 → CORE, B1 → RECOMMENDED, B2+ → EXTRA
 *
 * Reads env from apps/web/.env via dotenv:
 *   INTERNAL_AI_URL              base URL of the FastAPI service (e.g. http://localhost:8001)
 *   INTERNAL_AI_SHARED_SECRET    Bearer secret matching services/ai/.env INTERNAL_SHARED_SECRET
 *
 * Usage:
 *   pnpm tsx scripts/generate-vocab-glosses.ts
 *   pnpm tsx scripts/generate-vocab-glosses.ts --examType KET --batch 50
 *   pnpm tsx scripts/generate-vocab-glosses.ts --examType KET --batch 5 --take 5    (smoke test)
 */
import "dotenv/config";
import { ExamType, PrismaClient, WordTier } from "@prisma/client";

const prisma = new PrismaClient();

const AI_URL = process.env.INTERNAL_AI_URL || "http://localhost:8001";
const SECRET = process.env.INTERNAL_AI_SHARED_SECRET || "";
const DEFAULT_BATCH = 50;

type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

interface AiItem {
  cambridgeId: string;
  glossZh: string;
  example: string;
  cefrLevel: CefrLevel;
}

function deriveTier(examType: ExamType, cefr: CefrLevel): WordTier {
  if (examType === "KET") {
    if (cefr === "A1") return "CORE";
    if (cefr === "A2") return "RECOMMENDED";
    return "EXTRA";
  }
  // PET
  if (cefr === "A1" || cefr === "A2") return "CORE";
  if (cefr === "B1") return "RECOMMENDED";
  return "EXTRA";
}

async function callBatch(
  examType: ExamType,
  batch: { cambridgeId: string; word: string; pos: string; glossEn: string | null }[],
): Promise<AiItem[]> {
  const res = await fetch(`${AI_URL}/vocab-gloss`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${SECRET}`,
    },
    body: JSON.stringify({ examType, words: batch }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI service ${res.status}: ${body.slice(0, 500)}`);
  }
  const json = (await res.json()) as { items: AiItem[] };
  return json.items;
}

async function processExam(examType: ExamType, batchSize: number, take: number | null) {
  const findArgs: Parameters<typeof prisma.word.findMany>[0] = {
    where: { examType, glossZh: "" },
    select: { id: true, cambridgeId: true, word: true, pos: true, glossEn: true, tier: true },
    orderBy: { cambridgeId: "asc" },
  };
  if (take !== null) findArgs.take = take;
  const allTodo = await prisma.word.findMany(findArgs);
  const todo = allTodo;
  console.log(
    `[${examType}] ${allTodo.length} words missing glossZh${take !== null ? ` (capped at ${take})` : ""} — sending all to AI`,
  );
  if (todo.length === 0) {
    return { totalUpdated: 0, tierChanges: 0, tierSkipped: 0, batchesRun: 0, batchesFailed: 0 };
  }

  let totalUpdated = 0;
  let tierChanges = 0;
  let tierSkipped = 0; // rows where current tier was not RECOMMENDED — manual override preserved
  let batchesRun = 0;
  let batchesFailed = 0;

  for (let i = 0; i < todo.length; i += batchSize) {
    const batch = todo.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(todo.length / batchSize);
    const t0 = Date.now();
    console.log(`[${examType}] batch ${batchNum} / ${totalBatches} (${batch.length} words)`);

    let items: AiItem[];
    try {
      items = await callBatch(
        examType,
        batch.map((w) => ({
          cambridgeId: w.cambridgeId,
          word: w.word,
          pos: w.pos,
          glossEn: w.glossEn,
        })),
      );
    } catch (err) {
      batchesFailed++;
      console.error(`[${examType}] batch ${batchNum} failed:`, err);
      console.error(`[${examType}] continuing — re-run script later to retry these words`);
      continue;
    }
    batchesRun++;

    const byId = new Map(items.map((it) => [it.cambridgeId, it]));
    for (const w of batch) {
      const it = byId.get(w.cambridgeId);
      if (!it) {
        console.warn(`[${examType}] AI did not return ${w.cambridgeId} (${w.word})`);
        continue;
      }
      const newTier = deriveTier(examType, it.cefrLevel);
      const data: { glossZh: string; example: string; tier?: WordTier } = {
        glossZh: it.glossZh,
        example: it.example,
      };
      // Only auto-tier rows that are still at default RECOMMENDED — preserve manual overrides.
      if (w.tier === "RECOMMENDED") {
        data.tier = newTier;
        if (newTier !== "RECOMMENDED") tierChanges++;
      } else {
        tierSkipped++;
      }
      await prisma.word.update({ where: { id: w.id }, data });
      totalUpdated++;
    }
    const ms = Date.now() - t0;
    console.log(`[${examType}] batch ${batchNum} done in ${ms}ms`);
  }
  console.log(
    `[${examType}] DONE: updated ${totalUpdated} rows; tier-changed ${tierChanges}; manual-override-preserved ${tierSkipped}; batches ok ${batchesRun} failed ${batchesFailed}`,
  );
  return { totalUpdated, tierChanges, tierSkipped, batchesRun, batchesFailed };
}

function arg(name: string): string | null {
  const args = process.argv.slice(2);
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

async function main() {
  if (!SECRET) {
    console.error(
      "INTERNAL_AI_SHARED_SECRET is empty. Verify apps/web/.env is loaded and matches services/ai/.env INTERNAL_SHARED_SECRET.",
    );
    process.exit(1);
  }
  const examArg = arg("--examType");
  const batchArg = arg("--batch");
  const takeArg = arg("--take");
  const batch = batchArg ? parseInt(batchArg, 10) : DEFAULT_BATCH;
  const take = takeArg ? parseInt(takeArg, 10) : null;

  const exams: ExamType[] =
    examArg === "KET" || examArg === "PET" ? [examArg] : ["KET", "PET"];

  console.log(
    `[config] AI=${AI_URL}  batch=${batch}  exams=${exams.join(",")}` +
      (take !== null ? `  take=${take} (smoke test)` : ""),
  );

  const summary: Record<string, unknown> = {};
  for (const e of exams) {
    summary[e] = await processExam(e, batch, take);
  }
  console.log("[summary]", JSON.stringify(summary, null, 2));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
