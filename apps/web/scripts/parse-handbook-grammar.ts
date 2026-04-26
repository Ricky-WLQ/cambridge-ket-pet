/**
 * Parse data/raw/grammar-topics.json into GrammarTopic rows.
 *
 * Idempotent — uses upsert keyed on (examType, topicId). Re-runs are safe.
 * labelZh and examples are intentionally left empty here — Task 10 fills
 * them via DeepSeek (cheaper to author them in a single AI batch than
 * by hand).
 *
 * Cross-validates murphyUnits[] against data/raw/murphy-toc.json — bad
 * unit numbers fail the script before any DB writes.
 *
 * Usage:  pnpm tsx scripts/parse-handbook-grammar.ts
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { ExamType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TOPICS_PATH = path.resolve("data/raw/grammar-topics.json");
const MURPHY_PATH = path.resolve("data/raw/murphy-toc.json");

interface RawTopic {
  examType: "KET" | "PET";
  category: string;
  topicId: string;
  labelEn: string;
  spec: string;
  murphyUnits: number[];
  source: string;
}

interface RawTopicsFile { topics: RawTopic[] }
interface MurphyToc { units: Record<string, string> }

function loadTopics(): RawTopic[] {
  if (!fs.existsSync(TOPICS_PATH)) {
    throw new Error(`${TOPICS_PATH} not found — run Task 8 first`);
  }
  const raw = fs.readFileSync(TOPICS_PATH, "utf8");
  return (JSON.parse(raw) as RawTopicsFile).topics;
}

function loadMurphyUnits(): Set<number> {
  if (!fs.existsSync(MURPHY_PATH)) {
    console.warn(`[grammar/parse] ${MURPHY_PATH} not found — skipping murphyUnits validation`);
    return new Set();
  }
  const raw = fs.readFileSync(MURPHY_PATH, "utf8");
  const toc = JSON.parse(raw) as MurphyToc;
  return new Set(Object.keys(toc.units).map((k) => parseInt(k, 10)));
}

function validateTopic(t: RawTopic, validUnits: Set<number>): string[] {
  const errors: string[] = [];
  if (!["KET", "PET"].includes(t.examType)) errors.push(`bad examType: ${t.examType}`);
  if (!t.topicId || t.topicId.length === 0) errors.push("empty topicId");
  if (!t.category || t.category.length === 0) errors.push("empty category");
  if (!t.labelEn || t.labelEn.length === 0) errors.push("empty labelEn");
  if (!t.spec || t.spec.length === 0) errors.push("empty spec");
  if (!t.source || t.source.length === 0) errors.push("empty source");
  if (validUnits.size > 0) {
    for (const u of t.murphyUnits) {
      if (!validUnits.has(u)) errors.push(`murphyUnit ${u} not in murphy-toc.json`);
    }
  }
  return errors;
}

async function main() {
  const topics = loadTopics();
  const validUnits = loadMurphyUnits();
  console.log(`[grammar/parse] loaded ${topics.length} topics; murphy units valid: ${validUnits.size}`);

  // Validate ALL topics first — fail fast before any writes.
  const allErrors: { topic: RawTopic; errors: string[] }[] = [];
  for (const t of topics) {
    const errs = validateTopic(t, validUnits);
    if (errs.length > 0) allErrors.push({ topic: t, errors: errs });
  }
  if (allErrors.length > 0) {
    console.error(`[grammar/parse] ${allErrors.length} topics have validation errors:`);
    for (const { topic, errors } of allErrors) {
      console.error(`  ${topic.examType}/${topic.topicId}: ${errors.join("; ")}`);
    }
    process.exit(1);
  }

  let inserted = 0;
  let updated = 0;
  for (const t of topics) {
    const result = await prisma.grammarTopic.upsert({
      where: { examType_topicId: { examType: t.examType as ExamType, topicId: t.topicId } },
      create: {
        examType: t.examType as ExamType,
        category: t.category,
        topicId: t.topicId,
        labelEn: t.labelEn,
        labelZh: "",          // filled by Task 10
        spec: t.spec,
        examples: [],         // filled by Task 10
        murphyUnits: t.murphyUnits,
        source: t.source,
      },
      update: {
        // re-run safe: update non-AI-authored fields if the JSON was edited
        category: t.category,
        labelEn: t.labelEn,
        spec: t.spec,
        murphyUnits: t.murphyUnits,
        source: t.source,
      },
    });
    // distinguish create vs update — `result` doesn't tell us, so we use a count diff
    if (result.labelZh === "" && result.examples.length === 0) inserted++;
    else updated++;
  }
  console.log(`[grammar/parse] processed ${topics.length} topics — new: ${inserted}, updated: ${updated}`);
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
