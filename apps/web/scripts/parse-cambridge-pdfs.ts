/**
 * Run the Python pdfplumber helper for both KET and PET vocab PDFs,
 * upsert Word rows. Idempotent — skips (examType, cambridgeId) already present.
 *
 * Usage:  pnpm tsx scripts/parse-cambridge-pdfs.ts
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SOURCES = [
  {
    examType: "KET" as const,
    pdf: path.resolve("data/raw/506886-a2-key-2020-vocabulary-list.pdf"),
    sourceUrl:
      "https://www.cambridgeenglish.org/images/506886-a2-key-2020-vocabulary-list.pdf",
  },
  {
    examType: "PET" as const,
    pdf: path.resolve("data/raw/506887-b1-preliminary-vocabulary-list.pdf"),
    sourceUrl:
      "https://www.cambridgeenglish.org/Images/506887-b1-preliminary-vocabulary-list.pdf",
  },
];

interface Entry {
  cambridgeId: string;
  word: string;
  pos: string;
  glossEn: string | null;
  topics: string[];
  source: string;
}

function runPython(pdf: string, examType: string, sourceUrl: string): Promise<Entry[]> {
  return new Promise((resolve, reject) => {
    const py = spawn("python", [
      "scripts/parse-cambridge-pdfs.py",
      "--pdf", pdf,
      "--examType", examType,
      "--source-url", sourceUrl,
    ], { stdio: ["ignore", "pipe", "inherit"] });

    let stdout = "";
    py.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    py.on("close", (code) => {
      if (code !== 0) return reject(new Error(`pdfplumber helper exit code ${code}`));
      const entries: Entry[] = [];
      for (const line of stdout.split("\n")) {
        if (!line.trim()) continue;
        try { entries.push(JSON.parse(line)); }
        catch (e) { console.error("skip malformed line:", line); }
      }
      resolve(entries);
    });
  });
}

async function main() {
  for (const src of SOURCES) {
    console.log(`[${src.examType}] parsing ${src.pdf} ...`);
    const entries = await runPython(src.pdf, src.examType, src.sourceUrl);
    console.log(`[${src.examType}] extracted ${entries.length} entries`);

    let inserted = 0;
    let skipped = 0;
    for (const e of entries) {
      const existing = await prisma.word.findUnique({
        where: { examType_cambridgeId: { examType: src.examType, cambridgeId: e.cambridgeId } },
      });
      if (existing) { skipped++; continue; }
      await prisma.word.create({
        data: {
          examType: src.examType,
          cambridgeId: e.cambridgeId,
          word: e.word,
          pos: e.pos,
          glossEn: e.glossEn,
          glossZh: "",            // filled by generate-vocab-glosses.ts
          example: e.glossEn,     // start with Cambridge example if available
          topics: e.topics,
          source: e.source,
          // tier defaults to RECOMMENDED until fetch-evp-cefr-tags.ts runs
          // audioKey null until generate-vocab-audio.ts runs
        },
      });
      inserted++;
    }
    console.log(`[${src.examType}] inserted ${inserted}, skipped ${skipped}`);
  }
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
