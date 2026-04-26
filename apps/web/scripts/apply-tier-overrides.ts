/**
 * Apply manual tier overrides from data/raw/word-tier-overrides.csv.
 * Idempotent — re-run is safe (just re-asserts the same tier).
 *
 * Usage:  pnpm tsx scripts/apply-tier-overrides.ts
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { ExamType, PrismaClient, WordTier } from "@prisma/client";

const prisma = new PrismaClient();
const PATH_CSV = path.resolve("data/raw/word-tier-overrides.csv");

interface Row { examType: ExamType; word: string; pos: string; tier: WordTier; reason: string }

function load(): Row[] {
  if (!fs.existsSync(PATH_CSV)) return [];
  const raw = fs.readFileSync(PATH_CSV, "utf8");
  return parse(raw, { columns: true, skip_empty_lines: true }) as Row[];
}

async function main() {
  const rows = load();
  if (rows.length === 0) {
    console.warn(`[overrides] ${PATH_CSV} not found or empty — nothing to apply.`);
    process.exit(0);
  }
  console.log(`[overrides] loaded ${rows.length} override rows`);

  let updated = 0;
  const notFound: string[] = [];
  for (const r of rows) {
    const result = await prisma.word.updateMany({
      where: {
        examType: r.examType,
        word: { equals: r.word, mode: "insensitive" },
        pos: r.pos,
      },
      data: { tier: r.tier },
    });
    if (result.count === 0) {
      notFound.push(`${r.examType}:${r.word}:${r.pos}`);
    } else {
      updated += result.count;
    }
  }
  console.log(`[overrides] updated ${updated} rows`);
  if (notFound.length) {
    console.warn(`[overrides] ${notFound.length} CSV rows did not match any Word: ${notFound.slice(0, 10).join(", ")}${notFound.length > 10 ? "..." : ""}`);
  }
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
