/**
 * R2-driven Word table recovery — Phase 2 of 2026-04-27 DB recovery plan.
 *
 * Treats the R2 vocab audio key set (vocab/S1_male/<cambridgeId>.mp3) as the
 * authoritative wordlist. Cross-references each cambridgeId against the
 * Cambridge PDF parse to recover human-readable word + pos. For R2 entries
 * not in the PDF (drift), reverse-engineers word + pos from the slug via
 * KNOWN_POS suffix matching.
 *
 * Idempotent: uses upsert keyed on (examType, cambridgeId).
 */
import "dotenv/config";
import { spawn } from "node:child_process";
import path from "node:path";
import { ExamType, PrismaClient } from "@prisma/client";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

export const KNOWN_POS = new Set([
  "n", "v", "adj", "adv", "prep", "det", "conj", "modal", "pron", "exclam",
  "abbrev", "phr-v", "phr", "art", "num", "aux", "interj",
  "n-and-v", "n-and-adj", "v-and-adj", "n-and-v-and-adj",
  "a/an" /* defensive */,
]);

const POS_BY_LENGTH = [...KNOWN_POS].sort(
  (a, b) => b.split("-").length - a.split("-").length,
);

interface ReverseResult {
  exam: ExamType;
  word: string;
  pos: string;
}

export function reverseSlug(slug: string): ReverseResult | null {
  if (!slug.startsWith("ket-") && !slug.startsWith("pet-")) return null;
  const exam: ExamType = slug.startsWith("ket-") ? "KET" : "PET";
  const body = slug.slice(4);
  const tokens = body.split("-");
  for (const pos of POS_BY_LENGTH) {
    const posTokens = pos.split("-");
    if (tokens.length <= posTokens.length) continue;
    const tail = tokens.slice(-posTokens.length).join("-");
    if (tail === pos) {
      const wordTokens = tokens.slice(0, -posTokens.length);
      let word = wordTokens.join(" ");
      if (word === "a an") word = "a/an";
      return { exam, word, pos };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Seeder flow
// ---------------------------------------------------------------------------

interface PdfEntry {
  cambridgeId: string;
  word: string;
  pos: string;
  glossEn: string | null;
  topics: string[];
  source: string;
}

function parsePdf(
  pdf: string,
  exam: ExamType,
  sourceUrl: string,
): Promise<PdfEntry[]> {
  return new Promise((resolve, reject) => {
    const py = spawn("python", [
      "scripts/parse-cambridge-pdfs.py",
      "--pdf", path.resolve(pdf),
      "--examType", exam,
      "--source-url", sourceUrl,
    ]);
    let out = "";
    let err = "";
    py.stdout.on("data", (b) => (out += b.toString()));
    py.stderr.on("data", (b) => (err += b.toString()));
    py.on("close", (code) => {
      if (code !== 0) return reject(new Error(`python exit ${code}: ${err}`));
      const entries: PdfEntry[] = [];
      for (const line of out.split("\n")) {
        const t = line.trim();
        if (!t) continue;
        try {
          entries.push(JSON.parse(t));
        } catch (e) {
          reject(e);
          return;
        }
      }
      resolve(entries);
    });
  });
}

async function getR2KeyByCambridgeId(): Promise<Map<string, string>> {
  const c = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  const map = new Map<string, string>();
  let token: string | undefined;
  do {
    const r: any = await c.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET!,
        Prefix: "vocab/S1_male/",
        ContinuationToken: token,
        MaxKeys: 1000,
      }),
    );
    for (const o of r.Contents ?? []) {
      const m = o.Key.match(/^vocab\/S1_male\/(.+)\.mp3$/);
      if (m) map.set(m[1], o.Key);
    }
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return map;
}

async function main() {
  const prisma = new PrismaClient();

  const r2Map = await getR2KeyByCambridgeId();
  console.log(`R2: ${r2Map.size} unique cambridgeIds (S1_male voice)`);
  const ketR2 = [...r2Map.keys()].filter((k) => k.startsWith("ket-"));
  const petR2 = [...r2Map.keys()].filter((k) => k.startsWith("pet-"));
  console.log(`  KET=${ketR2.length}  PET=${petR2.length}`);

  const ketPdf = await parsePdf(
    "data/raw/506886-a2-key-2020-vocabulary-list.pdf",
    "KET",
    "https://www.cambridgeenglish.org/images/506886-a2-key-2020-vocabulary-list.pdf",
  );
  const petPdf = await parsePdf(
    "data/raw/506887-b1-preliminary-vocabulary-list.pdf",
    "PET",
    "https://www.cambridgeenglish.org/Images/506887-b1-preliminary-vocabulary-list.pdf",
  );
  const pdfMap = new Map<string, PdfEntry>();
  for (const e of [...ketPdf, ...petPdf]) pdfMap.set(e.cambridgeId, e);
  console.log(
    `PDF: KET=${ketPdf.length}  PET=${petPdf.length}  total=${pdfMap.size}`,
  );

  let pdfMatches = 0;
  let reversed = 0;
  const unrecoverable: string[] = [];
  const toInsert: Array<{
    cambridgeId: string;
    examType: ExamType;
    word: string;
    pos: string;
    glossEn: string | null;
    topics: string[];
    source: string;
    audioKey: string;
  }> = [];

  for (const [cid, audioKey] of r2Map) {
    const exam: ExamType = cid.startsWith("ket-") ? "KET" : "PET";
    const pdfEntry = pdfMap.get(cid);
    if (pdfEntry) {
      pdfMatches++;
      toInsert.push({
        cambridgeId: cid,
        examType: exam,
        word: pdfEntry.word,
        pos: pdfEntry.pos,
        glossEn: pdfEntry.glossEn,
        topics: pdfEntry.topics ?? [],
        source: pdfEntry.source,
        audioKey,
      });
    } else {
      const rev = reverseSlug(cid);
      if (rev) {
        reversed++;
        toInsert.push({
          cambridgeId: cid,
          examType: exam,
          word: rev.word,
          pos: rev.pos,
          glossEn: null,
          topics: [],
          source: "r2-reverse-engineered",
          audioKey,
        });
      } else {
        unrecoverable.push(cid);
      }
    }
  }
  console.log(
    `Plan: pdf-matched=${pdfMatches}  reverse-engineered=${reversed}  unrecoverable=${unrecoverable.length}`,
  );
  if (unrecoverable.length > 0) {
    console.log(
      `Unrecoverable cambridgeIds (first 20): ${unrecoverable.slice(0, 20).join(", ")}`,
    );
    console.log(
      `STOPPING — review unrecoverable list before insertion. Re-run with --force-skip-unrecoverable to proceed without them.`,
    );
    if (!process.argv.includes("--force-skip-unrecoverable")) process.exit(1);
  }

  let inserted = 0;
  for (const row of toInsert) {
    await prisma.word.upsert({
      where: {
        examType_cambridgeId: {
          examType: row.examType,
          cambridgeId: row.cambridgeId,
        },
      },
      create: {
        examType: row.examType,
        cambridgeId: row.cambridgeId,
        word: row.word,
        pos: row.pos,
        glossEn: row.glossEn,
        glossZh: "",
        example: "",
        topics: row.topics,
        source: row.source,
        audioKey: row.audioKey,
      },
      update: { audioKey: row.audioKey },
    });
    inserted++;
    if (inserted % 500 === 0)
      console.log(`  ... ${inserted}/${toInsert.length}`);
  }
  console.log(`Inserted/upserted ${inserted} Word rows. Done.`);

  const ketCount = await prisma.word.count({ where: { examType: "KET" } });
  const petCount = await prisma.word.count({ where: { examType: "PET" } });
  const audioOk = await prisma.word.count({ where: { audioKey: { not: null } } });
  console.log(
    `DB: KET=${ketCount}  PET=${petCount}  total=${ketCount + petCount}  with-audio=${audioOk}`,
  );

  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
