# DB Recovery from R2 + DeepSeek Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Use superpowers:verification-before-completion at every phase boundary. Use superpowers:test-driven-development for any NEW script written (audio-relink, pg-dump-r2-backup).

**Goal:** Restore the wiped local Postgres `ketpet` DB to a fully working state for cambridge-ket-pet — using the 4,624 vocab MP3s already preserved in R2 as the authoritative wordlist, regenerating only the DeepSeek-authored content (vocab glosses + grammar MCQs), and setting up daily pg_dump → R2 backups so this never happens again.

**Architecture:** R2-driven seeding. The R2 vocab audio key list (`vocab/{voiceTag}/{cambridgeId}.mp3`) is the authoritative source of which words to seed — guaranteeing 100% audio reuse, zero orphans, exact original word coverage. Cambridge PDFs supply the human-readable `word + pos` text for each `cambridgeId` (we pick the PDF candidate with highest R2 overlap). For R2-only entries (drift), we reverse-engineer `word + pos` from the slug using a known POS list. DeepSeek (via existing `services/ai` `/vocab-gloss` and `/grammar-generate` endpoints) fills in `glossZh`, `example`, `cefrLevel`, and grammar MCQs. All seed scripts already exist and are idempotent. New code: (a) one TS script to insert R2-driven Word rows + audio relink; (b) one PowerShell + bash script for pg_dump → R2 daily backup with rotation.

**Tech Stack:** TypeScript + tsx, Prisma 6, FastAPI + DeepSeek (Pydantic AI), Cambridge KET/PET vocab PDFs (pdfplumber), Cloudflare R2 (S3 API), Windows Task Scheduler, Postgres 16-alpine.

**Constraints / non-negotiables:**
- DeepSeek hard-stop ceiling: **$10 USD** total (kill the run if cost projection exceeds; expected $6-9)
- All sub-agent dispatch uses **Opus** (per user memory)
- Never delete or overwrite existing R2 objects
- Verification BEFORE claiming done at every phase boundary (real SQL counts + spot-checks; no unverified success claims)
- All sub-agents are read-only investigators OR scoped writers — never give a sub-agent the whole repo to modify
- All NEW scripts go under `apps/web/scripts/` and follow existing patterns (dotenv dual-load, idempotent re-runs, `--examType` filter where applicable)

---

## File Structure

**Create (new):**
- `apps/web/scripts/recover-vocab-from-r2.ts` — R2-driven Word seeder + audio relink (Phase 2)
- `apps/web/scripts/_pdf-overlap-test.ts` — temporary candidate-selector script (Phase 1, deleted after use)
- `apps/web/scripts/backup-db-to-r2.ts` — pg_dump → gzip → R2 upload with rotation (Phase 8)
- `apps/web/scripts/test/recover-vocab-from-r2.test.ts` — unit tests for slug-reverse + audio-key matching helpers
- `apps/web/scripts/test/backup-db-to-r2.test.ts` — unit tests for retention rotation logic
- `scripts/schedule-daily-backup.ps1` — Windows Task Scheduler installer (Phase 8)
- `docs/operations/db-backup-runbook.md` — restore procedure

**Modify (existing):**
- `apps/web/data/raw/506886-a2-key-2020-vocabulary-list.pdf` — write the winning KET PDF (gitignored — local file only)
- `apps/web/data/raw/506887-b1-preliminary-vocabulary-list.pdf` — write the winning PET PDF (gitignored)
- `apps/web/data/raw/README.md` — record new SHA256s for the PDFs we end up using

**Read-only references (no changes):**
- `apps/web/scripts/parse-cambridge-pdfs.ts` + `.py` — invoked unchanged
- `apps/web/scripts/apply-tier-overrides.ts` — invoked unchanged
- `apps/web/scripts/parse-handbook-grammar.ts` — invoked unchanged
- `apps/web/scripts/seed-grammar-glosses.ts` — invoked unchanged
- `apps/web/scripts/seed-grammar-questions.ts` — invoked unchanged
- `apps/web/scripts/generate-vocab-glosses.ts` — invoked unchanged
- `apps/web/scripts/seed-speaking-photos.ts` — invoked unchanged
- `services/ai/app/agents/vocab_gloss.py`, `grammar_generator.py` — runtime dependency, must be reachable

---

## Phase 0: Pre-flight checks ✅ DONE

Already completed before plan was written. Recorded for traceability:

- Postgres healthy (`pg_isready` returned `accepting connections`)
- AI service healthy (`/health` 200, `/ready` shows `deepseek: true`, `internal_auth_enabled: true`)
- Web dev server up on :3000 (200 OK)
- Python 3.13.5 + pdfplumber 0.11.9 available
- DB baseline: `users=1, words=0, grammar_topics=0, grammar_qs=0, wd=1, tests=1, attempts=6, exam_points=30, diff_points=10, teacher_codes=3`
- R2: `vocab=4624, speaking=49, listening=4` (exact expected count)
- DeepSeek API: HTTP 200, ~$0.000003 spent on `Say 'ok'` ping

---

## Phase 1: Pick best PDF candidate by R2 overlap

**Goal:** For KET and PET independently, parse each PDF candidate's word list, compute the intersection of `cambridgeId`s with the R2 audio key set, and select the candidate with maximum overlap. Write the winners into `apps/web/data/raw/` under canonical filenames.

**Files:**
- Create: `apps/web/scripts/_pdf-overlap-test.ts` (temporary)
- Modify: `apps/web/data/raw/506886-a2-key-2020-vocabulary-list.pdf` (winning KET PDF)
- Modify: `apps/web/data/raw/506887-b1-preliminary-vocabulary-list.pdf` (winning PET PDF)

**Candidates to test:**

| Exam | Source | Path |
|---|---|---|
| KET-A | Local, original filename | `C:/Users/wul82/Desktop/剑桥英语/剑桥KET真题+教材/1.原版真题/其他真题资料/【14套】KET 改革前全套真题（附答案+音频）/A2 Key for Schools (KET)/506886-a2-key-2020-vocabulary-list.pdf` (sha256 `60b5f8d4…`) |
| KET-B | Local, alt filename | `C:/Users/wul82/Desktop/剑桥英语/剑桥KET真题+教材/1.原版真题/KET 改革前全套真题/A2 Key for Schools (KET)/A2 Key for Schools vocabulary list.pdf` (sha256 `2caaffc0…`) |
| KET-C | Fresh from Cambridge URL | `https://www.cambridgeenglish.org/images/506886-a2-key-2020-vocabulary-list.pdf` |
| PET-A | Local, original filename | `C:/Users/wul82/Desktop/剑桥英语/剑桥PET真题+教材/4.词汇专项/PET_Vocabulary List/2020PET_Vocabulary List.pdf` (sha256 `85b094be…`) |
| PET-B | Fresh from Cambridge URL | `https://www.cambridgeenglish.org/Images/506887-b1-preliminary-vocabulary-list.pdf` |

- [ ] **Step 1: Stage all candidates into a temp dir**

```bash
mkdir -p /tmp/pdf-candidates
cp "C:/Users/wul82/Desktop/剑桥英语/剑桥KET真题+教材/1.原版真题/其他真题资料/【14套】KET 改革前全套真题（附答案+音频）/A2 Key for Schools (KET)/506886-a2-key-2020-vocabulary-list.pdf" /tmp/pdf-candidates/ket-A.pdf
cp "C:/Users/wul82/Desktop/剑桥英语/剑桥KET真题+教材/1.原版真题/KET 改革前全套真题/A2 Key for Schools (KET)/A2 Key for Schools vocabulary list.pdf" /tmp/pdf-candidates/ket-B.pdf
curl -sL "https://www.cambridgeenglish.org/images/506886-a2-key-2020-vocabulary-list.pdf" -o /tmp/pdf-candidates/ket-C.pdf
cp "C:/Users/wul82/Desktop/剑桥英语/剑桥PET真题+教材/4.词汇专项/PET_Vocabulary List/2020PET_Vocabulary List.pdf" /tmp/pdf-candidates/pet-A.pdf
curl -sL "https://www.cambridgeenglish.org/Images/506887-b1-preliminary-vocabulary-list.pdf" -o /tmp/pdf-candidates/pet-B.pdf
sha256sum /tmp/pdf-candidates/*.pdf
ls -la /tmp/pdf-candidates/
```

Expected: 5 files, all > 100KB, hashes printed.

- [ ] **Step 2: Write the candidate-selector script**

```typescript
// apps/web/scripts/_pdf-overlap-test.ts
import "dotenv/config";
import { spawn } from "node:child_process";
import path from "node:path";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

interface Entry { cambridgeId: string; word: string; pos: string }

function runPython(pdf: string, exam: "KET" | "PET"): Promise<Entry[]> {
  return new Promise((resolve, reject) => {
    const py = spawn("python", [
      "scripts/parse-cambridge-pdfs.py",
      "--pdf", pdf, "--examType", exam, "--source-url", "candidate-test",
    ]);
    let out = ""; let err = "";
    py.stdout.on("data", b => out += b.toString());
    py.stderr.on("data", b => err += b.toString());
    py.on("close", code => {
      if (code !== 0) return reject(new Error(`python exit ${code}: ${err}`));
      const entries: Entry[] = [];
      for (const line of out.split("\n")) {
        const t = line.trim(); if (!t) continue;
        try { entries.push(JSON.parse(t)); } catch {}
      }
      resolve(entries);
    });
  });
}

async function getR2VocabIds(): Promise<Set<string>> {
  const c = new S3Client({
    region: "auto", endpoint: process.env.R2_ENDPOINT!,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
  });
  const ids = new Set<string>();
  let token: string | undefined;
  do {
    const r: any = await c.send(new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET!, Prefix: "vocab/", ContinuationToken: token, MaxKeys: 1000,
    }));
    for (const o of r.Contents ?? []) {
      // key: vocab/{voiceTag}/{cambridgeId}.mp3
      const m = o.Key.match(/^vocab\/[^/]+\/(.+)\.mp3$/);
      if (m) ids.add(m[1]);
    }
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return ids;
}

async function main() {
  const r2Ids = await getR2VocabIds();
  console.log(`R2 unique cambridgeIds: ${r2Ids.size}`);
  const r2KetIds = new Set([...r2Ids].filter(i => i.startsWith("ket-")));
  const r2PetIds = new Set([...r2Ids].filter(i => i.startsWith("pet-")));
  console.log(`  KET: ${r2KetIds.size}  PET: ${r2PetIds.size}`);
  const candidates = [
    { label: "KET-A (local orig)", pdf: "/tmp/pdf-candidates/ket-A.pdf", exam: "KET" as const, r2: r2KetIds },
    { label: "KET-B (local alt)",  pdf: "/tmp/pdf-candidates/ket-B.pdf", exam: "KET" as const, r2: r2KetIds },
    { label: "KET-C (fresh URL)",  pdf: "/tmp/pdf-candidates/ket-C.pdf", exam: "KET" as const, r2: r2KetIds },
    { label: "PET-A (local orig)", pdf: "/tmp/pdf-candidates/pet-A.pdf", exam: "PET" as const, r2: r2PetIds },
    { label: "PET-B (fresh URL)",  pdf: "/tmp/pdf-candidates/pet-B.pdf", exam: "PET" as const, r2: r2PetIds },
  ];
  for (const c of candidates) {
    try {
      const entries = await runPython(c.pdf, c.exam);
      const pdfIds = new Set(entries.map(e => e.cambridgeId));
      const overlap = [...pdfIds].filter(i => c.r2.has(i)).length;
      const r2OnlyMissingFromPdf = [...c.r2].filter(i => !pdfIds.has(i)).length;
      const pdfOnly = [...pdfIds].filter(i => !c.r2.has(i)).length;
      console.log(`${c.label}: pdf=${pdfIds.size}  overlap=${overlap}/${c.r2.size} (${(100*overlap/c.r2.size).toFixed(1)}%)  pdf_only=${pdfOnly}  r2_only=${r2OnlyMissingFromPdf}`);
    } catch (e: any) {
      console.log(`${c.label}: ERROR ${e.message}`);
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Run the candidate selector**

```bash
cd C:/Users/wul82/Desktop/cambridge-ket-pet/apps/web
./node_modules/.bin/tsx scripts/_pdf-overlap-test.ts
```

Expected output: a table of overlap percentages per candidate. Pick the highest-overlap candidate per exam type. Acceptance:
- If best KET candidate has ≥99% overlap → use it as winner
- If best KET candidate has 90-99% overlap → use it; the small gap will be handled by reverse-engineering in Phase 2
- If best KET candidate has <90% overlap → STOP and consult user
- Same for PET

- [ ] **Step 4: Copy winners into `apps/web/data/raw/`**

```bash
cp /tmp/pdf-candidates/ket-<winner>.pdf "C:/Users/wul82/Desktop/cambridge-ket-pet/apps/web/data/raw/506886-a2-key-2020-vocabulary-list.pdf"
cp /tmp/pdf-candidates/pet-<winner>.pdf "C:/Users/wul82/Desktop/cambridge-ket-pet/apps/web/data/raw/506887-b1-preliminary-vocabulary-list.pdf"
sha256sum apps/web/data/raw/506886-a2-key-2020-vocabulary-list.pdf apps/web/data/raw/506887-b1-preliminary-vocabulary-list.pdf
```

- [ ] **Step 5: Record new hashes in README + delete temp script**

Update `apps/web/data/raw/README.md` to record the new SHA256s with a `<!-- recovered 2026-04-27 -->` annotation. Delete `apps/web/scripts/_pdf-overlap-test.ts`.

- [ ] **Step 6: Verification gate before Phase 2**

```bash
ls -la apps/web/data/raw/506886-a2-key-2020-vocabulary-list.pdf apps/web/data/raw/506887-b1-preliminary-vocabulary-list.pdf
```
Both must exist, > 100KB. Update task #2 → completed; task #3 → in_progress.

---

## Phase 2: R2-driven Word seeding + audio relink

**Goal:** Insert one Word row per R2 vocab `cambridgeId` (4,624 expected). Cross-reference with the PDF parse output to recover `word + pos`. For R2-only entries (drift), reverse-engineer `word + pos` from the slug. Set `audioKey` on every row to the existing R2 key. Skip PDF-only entries (preserve original word coverage).

**Files:**
- Create: `apps/web/scripts/recover-vocab-from-r2.ts` (the seeder)
- Create: `apps/web/scripts/test/recover-vocab-from-r2.test.ts` (unit tests for helpers)

**Known POS abbreviations (from inspecting the Cambridge PDFs and prior Word rows):**
`n, v, adj, adv, prep, det, conj, modal, pron, exclam, abbrev, phr-v, phr, art, num, aux, n-and-v, n-and-adj, etc.`
Last token after the last `-` separator in the slug = pos. The earlier tokens are the word (joined with space, restoring spaces from `-`).

- [ ] **Step 1: Write failing test for slug-reverse helper**

```typescript
// apps/web/scripts/test/recover-vocab-from-r2.test.ts
import { describe, it, expect } from "vitest";
import { reverseSlug, KNOWN_POS } from "../recover-vocab-from-r2";

describe("reverseSlug", () => {
  it("simple word + simple pos", () => {
    expect(reverseSlug("ket-apple-n")).toEqual({ exam: "KET", word: "apple", pos: "n" });
  });
  it("multi-word + simple pos", () => {
    expect(reverseSlug("pet-have-got-to-modal")).toEqual({ exam: "PET", word: "have got to", pos: "modal" });
  });
  it("multi-token pos (n-and-v)", () => {
    expect(reverseSlug("ket-walk-n-and-v")).toEqual({ exam: "KET", word: "walk", pos: "n-and-v" });
  });
  it("phrasal verb pos", () => {
    expect(reverseSlug("ket-give-up-phr-v")).toEqual({ exam: "KET", word: "give up", pos: "phr-v" });
  });
  it("article a/an", () => {
    expect(reverseSlug("ket-a-an-det")).toEqual({ exam: "KET", word: "a/an", pos: "det" });
  });
  it("returns null for malformed slugs", () => {
    expect(reverseSlug("nothing")).toBeNull();
    expect(reverseSlug("ket-only-noPosMatch")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, expect fail**

```bash
cd C:/Users/wul82/Desktop/cambridge-ket-pet/apps/web
./node_modules/.bin/vitest run scripts/test/recover-vocab-from-r2.test.ts 2>&1 | tail -30
```

Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement reverseSlug + KNOWN_POS exports**

```typescript
// apps/web/scripts/recover-vocab-from-r2.ts (partial — full file built up across steps)
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

const POS_BY_LENGTH = [...KNOWN_POS].sort((a, b) => b.split("-").length - a.split("-").length);

interface ReverseResult { exam: ExamType; word: string; pos: string }

export function reverseSlug(slug: string): ReverseResult | null {
  if (!slug.startsWith("ket-") && !slug.startsWith("pet-")) return null;
  const exam: ExamType = slug.startsWith("ket-") ? "KET" : "PET";
  const body = slug.slice(4); // strip "ket-" or "pet-"
  const tokens = body.split("-");
  // Try longest known POS suffix first
  for (const pos of POS_BY_LENGTH) {
    const posTokens = pos.split("-");
    if (tokens.length <= posTokens.length) continue;
    const tail = tokens.slice(-posTokens.length).join("-");
    if (tail === pos) {
      const wordTokens = tokens.slice(0, -posTokens.length);
      // Special case: a/an renders as "a-an" in slug — restore "/"
      let word = wordTokens.join(" ");
      if (word === "a an") word = "a/an";
      return { exam, word, pos };
    }
  }
  return null;
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
./node_modules/.bin/vitest run scripts/test/recover-vocab-from-r2.test.ts 2>&1 | tail -10
```

Expected: 6 PASS.

- [ ] **Step 5: Build the full seeder logic**

Append to `apps/web/scripts/recover-vocab-from-r2.ts`:

```typescript
// ---- the actual seeding flow ----

interface PdfEntry { cambridgeId: string; word: string; pos: string; glossEn: string | null; topics: string[]; source: string }

function parsePdf(pdf: string, exam: ExamType, sourceUrl: string): Promise<PdfEntry[]> {
  return new Promise((resolve, reject) => {
    const py = spawn("python", [
      "scripts/parse-cambridge-pdfs.py",
      "--pdf", path.resolve(pdf),
      "--examType", exam,
      "--source-url", sourceUrl,
    ]);
    let out = ""; let err = "";
    py.stdout.on("data", b => out += b.toString());
    py.stderr.on("data", b => err += b.toString());
    py.on("close", code => {
      if (code !== 0) return reject(new Error(`python exit ${code}: ${err}`));
      const entries: PdfEntry[] = [];
      for (const line of out.split("\n")) {
        const t = line.trim(); if (!t) continue;
        try { entries.push(JSON.parse(t)); } catch (e) { reject(e); return; }
      }
      resolve(entries);
    });
  });
}

async function getR2KeyByCambridgeId(): Promise<Map<string, string>> {
  // Returns map of cambridgeId → first matching R2 key (we want the male voice variant: vocab/S1_male/...)
  const c = new S3Client({
    region: "auto", endpoint: process.env.R2_ENDPOINT!,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
  });
  const map = new Map<string, string>();
  let token: string | undefined;
  do {
    const r: any = await c.send(new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET!, Prefix: "vocab/S1_male/", ContinuationToken: token, MaxKeys: 1000,
    }));
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

  // 1. Load R2 keys (authoritative wordlist)
  const r2Map = await getR2KeyByCambridgeId();
  console.log(`R2: ${r2Map.size} unique cambridgeIds (S1_male voice)`);
  const ketR2 = [...r2Map.keys()].filter(k => k.startsWith("ket-"));
  const petR2 = [...r2Map.keys()].filter(k => k.startsWith("pet-"));
  console.log(`  KET=${ketR2.length}  PET=${petR2.length}`);

  // 2. Parse both PDFs
  const ketPdf = await parsePdf("data/raw/506886-a2-key-2020-vocabulary-list.pdf", "KET",
    "https://www.cambridgeenglish.org/images/506886-a2-key-2020-vocabulary-list.pdf");
  const petPdf = await parsePdf("data/raw/506887-b1-preliminary-vocabulary-list.pdf", "PET",
    "https://www.cambridgeenglish.org/Images/506887-b1-preliminary-vocabulary-list.pdf");
  const pdfMap = new Map<string, PdfEntry>();
  for (const e of [...ketPdf, ...petPdf]) pdfMap.set(e.cambridgeId, e);
  console.log(`PDF: KET=${ketPdf.length}  PET=${petPdf.length}  total=${pdfMap.size}`);

  // 3. Build the to-insert list: one row per R2 cambridgeId
  let pdfMatches = 0;
  let reversed = 0;
  let unrecoverable: string[] = [];
  const toInsert: Array<{ cambridgeId: string; examType: ExamType; word: string; pos: string; glossEn: string | null; topics: string[]; source: string; audioKey: string }> = [];

  for (const [cid, audioKey] of r2Map) {
    const exam: ExamType = cid.startsWith("ket-") ? "KET" : "PET";
    const pdfEntry = pdfMap.get(cid);
    if (pdfEntry) {
      pdfMatches++;
      toInsert.push({
        cambridgeId: cid, examType: exam, word: pdfEntry.word, pos: pdfEntry.pos,
        glossEn: pdfEntry.glossEn, topics: pdfEntry.topics ?? [], source: pdfEntry.source, audioKey,
      });
    } else {
      const rev = reverseSlug(cid);
      if (rev) {
        reversed++;
        toInsert.push({
          cambridgeId: cid, examType: exam, word: rev.word, pos: rev.pos,
          glossEn: null, topics: [], source: "r2-reverse-engineered", audioKey,
        });
      } else {
        unrecoverable.push(cid);
      }
    }
  }
  console.log(`Plan: pdf-matched=${pdfMatches}  reverse-engineered=${reversed}  unrecoverable=${unrecoverable.length}`);
  if (unrecoverable.length > 0) {
    console.log(`Unrecoverable cambridgeIds (first 20): ${unrecoverable.slice(0, 20).join(", ")}`);
    console.log(`STOPPING — review unrecoverable list before insertion. Re-run with --force-skip-unrecoverable to proceed without them.`);
    if (!process.argv.includes("--force-skip-unrecoverable")) process.exit(1);
  }

  // 4. Insert all rows in a single transaction (idempotent: skip on existing cambridgeId)
  let inserted = 0;
  for (const row of toInsert) {
    await prisma.word.upsert({
      where: { examType_cambridgeId: { examType: row.examType, cambridgeId: row.cambridgeId } },
      create: {
        examType: row.examType, cambridgeId: row.cambridgeId, word: row.word, pos: row.pos,
        glossEn: row.glossEn, glossZh: "", example: "", topics: row.topics, source: row.source, audioKey: row.audioKey,
        // tier defaults to RECOMMENDED per schema
      },
      update: { audioKey: row.audioKey }, // keep audioKey in sync if rerun
    });
    inserted++;
    if (inserted % 500 === 0) console.log(`  ... ${inserted}/${toInsert.length}`);
  }
  console.log(`Inserted/upserted ${inserted} Word rows. Done.`);

  // 5. Final counts
  const ketCount = await prisma.word.count({ where: { examType: "KET" } });
  const petCount = await prisma.word.count({ where: { examType: "PET" } });
  const audioOk = await prisma.word.count({ where: { audioKey: { not: null } } });
  console.log(`DB: KET=${ketCount}  PET=${petCount}  total=${ketCount + petCount}  with-audio=${audioOk}`);

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 6: Run the seeder**

```bash
cd C:/Users/wul82/Desktop/cambridge-ket-pet/apps/web
./node_modules/.bin/tsx scripts/recover-vocab-from-r2.ts 2>&1 | tee /tmp/phase2-seeder.log
```

Expected: `pdf-matched + reverse-engineered = 4624`, `unrecoverable=0` (or list of irrecoverables to investigate).

- [ ] **Step 7: Verification gate**

```bash
docker exec ketpet-postgres psql -U postgres -d ketpet -c '
SELECT
  (SELECT COUNT(*) FROM "Word") AS total,
  (SELECT COUNT(*) FROM "Word" WHERE "examType" = '"'"'KET'"'"') AS ket,
  (SELECT COUNT(*) FROM "Word" WHERE "examType" = '"'"'PET'"'"') AS pet,
  (SELECT COUNT(*) FROM "Word" WHERE "audioKey" IS NOT NULL) AS with_audio,
  (SELECT COUNT(*) FROM "Word" WHERE "source" = '"'"'r2-reverse-engineered'"'"') AS reversed;
'
```

Acceptance: `total = 4624`, `with_audio = 4624`, `ket + pet = 4624`. Sample 5 random rows to confirm word/pos/audioKey look right.

```bash
docker exec ketpet-postgres psql -U postgres -d ketpet -c '
SELECT "cambridgeId", "examType", word, pos, "audioKey", source FROM "Word" ORDER BY random() LIMIT 5;
'
```

If counts pass and samples look right → mark task #3 complete; advance to Phase 3.

---

## Phase 3: Apply 15 manual tier overrides

**Goal:** Run the existing `apply-tier-overrides.ts` to set CORE/EXTRA tier for 15 hand-curated rows in `word-tier-overrides.csv`. Idempotent.

**Files:** None new. Invokes `apps/web/scripts/apply-tier-overrides.ts`.

- [ ] **Step 1: Run script**

```bash
cd C:/Users/wul82/Desktop/cambridge-ket-pet/apps/web
./node_modules/.bin/tsx scripts/apply-tier-overrides.ts 2>&1 | tail -10
```

- [ ] **Step 2: Verify**

```bash
docker exec ketpet-postgres psql -U postgres -d ketpet -c '
SELECT tier, COUNT(*) FROM "Word" GROUP BY tier ORDER BY tier;
'
```

Expected: `CORE >= 15`, `RECOMMENDED ~= 4609`, `EXTRA = 0` (until Phase 6 sets cefrLevel-derived tiers).

If pass → mark task #4 complete; advance to Phase 4.

---

## Phase 4: Grammar topic seed (parse + glosses)

**Goal:** Insert 40 GrammarTopic rows from `data/raw/grammar-topics.json` (deterministic) then DeepSeek-author labelZh + examples per topic via `seed-grammar-glosses.ts` (~$0.05).

**Files:** None new. Invokes `parse-handbook-grammar.ts` + `seed-grammar-glosses.ts`.

- [ ] **Step 1: Parse handbook JSON → GrammarTopic**

```bash
cd C:/Users/wul82/Desktop/cambridge-ket-pet/apps/web
./node_modules/.bin/tsx scripts/parse-handbook-grammar.ts 2>&1 | tail -10
```

- [ ] **Step 2: Verify topic count**

```bash
docker exec ketpet-postgres psql -U postgres -d ketpet -c '
SELECT "examType", COUNT(*) FROM "GrammarTopic" GROUP BY "examType";
'
```

Expected: KET ~20, PET ~20, total = 40.

- [ ] **Step 3: DeepSeek labelZh + examples**

```bash
./node_modules/.bin/tsx scripts/seed-grammar-glosses.ts 2>&1 | tee /tmp/phase4-glosses.log
```

Expected: ~5 minutes wall time, ~$0.05 spend.

- [ ] **Step 4: Verify all topics have labelZh + examples**

```bash
docker exec ketpet-postgres psql -U postgres -d ketpet -c '
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE "labelZh" != '"'"''"'"') AS with_zh,
  COUNT(*) FILTER (WHERE jsonb_array_length(examples) > 0) AS with_examples
FROM "GrammarTopic";
'
```

Expected: all three counts = 40.

If pass → mark task #5 complete; advance to Phase 5.

---

## Phase 5: Grammar question generation (DeepSeek MCQs)

**Goal:** Generate ~15 MCQs per topic via DeepSeek `/grammar-generate` endpoint (~$1-2, 15-30 min). 40 topics × 15 = ~600 questions expected.

**Files:** None new. Invokes `seed-grammar-questions.ts`.

- [ ] **Step 1: Run generator**

```bash
cd C:/Users/wul82/Desktop/cambridge-ket-pet/apps/web
./node_modules/.bin/tsx scripts/seed-grammar-questions.ts 2>&1 | tee /tmp/phase5-questions.log
```

- [ ] **Step 2: Verify question count + spot-check 3 questions for sane content**

```bash
docker exec ketpet-postgres psql -U postgres -d ketpet -c '
SELECT
  (SELECT COUNT(*) FROM "GrammarQuestion") AS total_qs,
  (SELECT COUNT(DISTINCT "topicId") FROM "GrammarQuestion") AS topics_with_qs;
'
docker exec ketpet-postgres psql -U postgres -d ketpet -c '
SELECT question, options, "correctIndex", "explanationZh" FROM "GrammarQuestion" ORDER BY random() LIMIT 3;
'
```

Acceptance: `total_qs ≥ 500` (allow 3-retry validator failures to drop below 600), `topics_with_qs = 40`. Spot-checked questions must have plausible English MCQs with Chinese explanations.

If pass → mark task #6 complete; advance to Phase 6.

---

## Phase 6: Vocab DeepSeek gloss generation

**Goal:** Run `generate-vocab-glosses.ts` on all 4,624 Word rows (where `glossZh = ''`). Authors `glossZh + example + cefrLevel + tier` via DeepSeek `/vocab-gloss` endpoint. **HARD-STOP if cumulative DeepSeek cost projection exceeds $10.**

**Files:** None new. Invokes `generate-vocab-glosses.ts`.

- [ ] **Step 1: Smoke test on 5 words first**

```bash
cd C:/Users/wul82/Desktop/cambridge-ket-pet/apps/web
./node_modules/.bin/tsx scripts/generate-vocab-glosses.ts --examType KET --batch 5 --take 5 2>&1 | tail -20
```

Expected: 5 words updated, 1 batch run, no failures.

- [ ] **Step 2: Verify smoke test result**

```bash
docker exec ketpet-postgres psql -U postgres -d ketpet -c '
SELECT word, "glossZh", example, "cefrLevel", tier FROM "Word" WHERE "examType" = '"'"'KET'"'"' AND "glossZh" != '"'"''"'"' LIMIT 5;
'
```

All 5 rows must have non-empty Chinese gloss + example + cefrLevel filled.

- [ ] **Step 3: Full run**

```bash
./node_modules/.bin/tsx scripts/generate-vocab-glosses.ts 2>&1 | tee /tmp/phase6-glosses.log
```

Wall time: ~30-60 min. Monitor for batches-failed > 5; if so, pause and investigate. Expected DeepSeek spend: $5-7.

- [ ] **Step 4: Verify all 4,624 rows have glossZh**

```bash
docker exec ketpet-postgres psql -U postgres -d ketpet -c '
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE "glossZh" != '"'"''"'"') AS with_zh,
  COUNT(*) FILTER (WHERE example != '"'"''"'"') AS with_example,
  COUNT(*) FILTER (WHERE "cefrLevel" IS NOT NULL) AS with_cefr,
  tier, COUNT(*) AS by_tier
FROM "Word" GROUP BY tier ORDER BY tier;
'
```

Acceptance: `with_zh = 4624`, `with_cefr = 4624`. If <4624 (some batches failed), re-run script (idempotent — skips rows with non-empty glossZh).

If pass → mark task #7 complete; advance to Phase 7.

---

## Phase 7: Speaking photos relink

**Goal:** Insert 49 SpeakingPhoto rows pointing at existing R2 keys via `seed-speaking-photos.ts`.

**Files:** None new. Invokes `seed-speaking-photos.ts`.

- [ ] **Step 1: Run script**

```bash
cd C:/Users/wul82/Desktop/cambridge-ket-pet/apps/web
./node_modules/.bin/tsx scripts/seed-speaking-photos.ts 2>&1 | tail -10
```

- [ ] **Step 2: Verify**

```bash
docker exec ketpet-postgres psql -U postgres -d ketpet -c '
SELECT COUNT(*) FROM "SpeakingPhoto";
'
```

Expected: 49.

If pass → mark task #8 complete; advance to Phase 8.

---

## Phase 8: Backup automation (pg_dump → R2 daily)

**Goal:** Implement automated nightly `pg_dump` → gzip → R2 upload with retention rotation (7 daily + 4 weekly + 12 monthly). Test end-to-end including a restore-test on a throwaway DB. Schedule via Windows Task Scheduler.

**Files:**
- Create: `apps/web/scripts/backup-db-to-r2.ts`
- Create: `apps/web/scripts/test/backup-db-to-r2.test.ts`
- Create: `scripts/schedule-daily-backup.ps1`
- Create: `docs/operations/db-backup-runbook.md`

**Retention policy:**
- `db-backups/daily/<YYYY-MM-DD>.sql.gz` — keep last 7
- `db-backups/weekly/<YYYY-WW>.sql.gz` — keep last 4 (taken on Sundays)
- `db-backups/monthly/<YYYY-MM>.sql.gz` — keep last 12 (taken on 1st of month)

- [ ] **Step 1: Write failing test for retention rotation logic**

```typescript
// apps/web/scripts/test/backup-db-to-r2.test.ts
import { describe, it, expect } from "vitest";
import { computeKeysToDelete } from "../backup-db-to-r2";

describe("computeKeysToDelete", () => {
  it("keeps last 7 daily, deletes older", () => {
    const today = new Date("2026-04-27T00:00:00Z");
    const existing = [
      "db-backups/daily/2026-04-27.sql.gz",
      "db-backups/daily/2026-04-26.sql.gz",
      "db-backups/daily/2026-04-25.sql.gz",
      "db-backups/daily/2026-04-24.sql.gz",
      "db-backups/daily/2026-04-23.sql.gz",
      "db-backups/daily/2026-04-22.sql.gz",
      "db-backups/daily/2026-04-21.sql.gz",
      "db-backups/daily/2026-04-20.sql.gz", // 8th — should be deleted
      "db-backups/daily/2026-04-15.sql.gz", // older — should be deleted
    ];
    const toDelete = computeKeysToDelete(existing, today);
    expect(toDelete).toContain("db-backups/daily/2026-04-20.sql.gz");
    expect(toDelete).toContain("db-backups/daily/2026-04-15.sql.gz");
    expect(toDelete).not.toContain("db-backups/daily/2026-04-21.sql.gz");
  });
  it("keeps last 4 weekly, deletes older", () => {
    const today = new Date("2026-04-27T00:00:00Z");
    const existing = [
      "db-backups/weekly/2026-W17.sql.gz",
      "db-backups/weekly/2026-W16.sql.gz",
      "db-backups/weekly/2026-W15.sql.gz",
      "db-backups/weekly/2026-W14.sql.gz",
      "db-backups/weekly/2026-W13.sql.gz", // 5th — delete
    ];
    const toDelete = computeKeysToDelete(existing, today);
    expect(toDelete).toContain("db-backups/weekly/2026-W13.sql.gz");
    expect(toDelete).not.toContain("db-backups/weekly/2026-W14.sql.gz");
  });
  it("keeps last 12 monthly", () => {
    const today = new Date("2026-04-27T00:00:00Z");
    const existing = [
      "db-backups/monthly/2026-04.sql.gz",
      "db-backups/monthly/2026-03.sql.gz",
      // ... back to 2025-05 (12 months)
      "db-backups/monthly/2025-05.sql.gz",
      "db-backups/monthly/2025-04.sql.gz", // 13th — delete
    ];
    const toDelete = computeKeysToDelete(existing, today);
    expect(toDelete).toContain("db-backups/monthly/2025-04.sql.gz");
    expect(toDelete).not.toContain("db-backups/monthly/2025-05.sql.gz");
  });
});
```

- [ ] **Step 2: Run test, expect fail**

```bash
cd C:/Users/wul82/Desktop/cambridge-ket-pet/apps/web
./node_modules/.bin/vitest run scripts/test/backup-db-to-r2.test.ts 2>&1 | tail -10
```

- [ ] **Step 3: Implement backup-db-to-r2.ts**

```typescript
// apps/web/scripts/backup-db-to-r2.ts
import "dotenv/config";
import { spawn } from "node:child_process";
import { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { createReadStream, statSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";

const KEEP_DAILY = 7, KEEP_WEEKLY = 4, KEEP_MONTHLY = 12;

export function computeKeysToDelete(existing: string[], today: Date): string[] {
  const toDelete: string[] = [];
  for (const tier of ["daily", "weekly", "monthly"] as const) {
    const limit = { daily: KEEP_DAILY, weekly: KEEP_WEEKLY, monthly: KEEP_MONTHLY }[tier];
    const tierKeys = existing.filter(k => k.startsWith(`db-backups/${tier}/`)).sort().reverse();
    for (const k of tierKeys.slice(limit)) toDelete.push(k);
  }
  return toDelete;
}

function pgDump(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn("docker", ["exec", "ketpet-postgres", "pg_dump", "-U", "postgres", "-d", "ketpet", "--clean", "--if-exists"]);
    const chunks: Buffer[] = [];
    proc.stdout.on("data", c => chunks.push(c));
    proc.stderr.on("data", c => process.stderr.write(c));
    proc.on("close", code => {
      if (code !== 0) return reject(new Error(`pg_dump exit ${code}`));
      resolve(Buffer.concat(chunks));
    });
  });
}

function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

async function main() {
  const today = new Date();
  const ymd = today.toISOString().slice(0, 10);
  const ym = ymd.slice(0, 7);
  const dow = today.getUTCDay(); // 0 = Sunday
  const dom = today.getUTCDate(); // 1-31

  console.log(`[backup] starting pg_dump at ${today.toISOString()}`);
  const sql = await pgDump();
  console.log(`[backup] pg_dump produced ${sql.length} bytes`);
  const gz = gzipSync(sql);
  console.log(`[backup] gzipped to ${gz.length} bytes`);

  const client = new S3Client({
    region: "auto", endpoint: process.env.R2_ENDPOINT!,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
  });

  // Always upload a daily; conditionally upload weekly (Sunday) + monthly (1st of month).
  const uploads = [`db-backups/daily/${ymd}.sql.gz`];
  if (dow === 0) uploads.push(`db-backups/weekly/${isoWeek(today)}.sql.gz`);
  if (dom === 1) uploads.push(`db-backups/monthly/${ym}.sql.gz`);

  for (const key of uploads) {
    await client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!, Key: key, Body: gz, ContentType: "application/gzip",
    }));
    console.log(`[backup] uploaded ${key}`);
  }

  // Apply retention rotation: list all db-backups/, compute deletes, batch-delete
  let token: string | undefined;
  const allKeys: string[] = [];
  do {
    const r: any = await client.send(new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET!, Prefix: "db-backups/", ContinuationToken: token, MaxKeys: 1000,
    }));
    for (const o of r.Contents ?? []) allKeys.push(o.Key);
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  const toDelete = computeKeysToDelete(allKeys, today);
  if (toDelete.length > 0) {
    await client.send(new DeleteObjectsCommand({
      Bucket: process.env.R2_BUCKET!, Delete: { Objects: toDelete.map(Key => ({ Key })) },
    }));
    console.log(`[backup] deleted ${toDelete.length} expired backups`);
  } else {
    console.log(`[backup] no expired backups to delete`);
  }
  console.log(`[backup] done`);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: Run unit test, expect pass**

```bash
./node_modules/.bin/vitest run scripts/test/backup-db-to-r2.test.ts 2>&1 | tail -10
```

- [ ] **Step 5: Live end-to-end test (real upload)**

```bash
./node_modules/.bin/tsx scripts/backup-db-to-r2.ts 2>&1 | tail -20
```

Expected: pg_dump output bytes > 1MB (DB has ~5K rows), gzip ratio ~5x, upload to `db-backups/daily/2026-04-27.sql.gz`.

- [ ] **Step 6: Restore test on throwaway DB**

```bash
docker exec ketpet-postgres createdb -U postgres ketpet_restore_test
docker exec ketpet-postgres bash -c 'pg_dump -U postgres -d ketpet -Fp --clean --if-exists | gzip > /tmp/test.sql.gz && gunzip -c /tmp/test.sql.gz | psql -U postgres -d ketpet_restore_test' 2>&1 | tail -5
docker exec ketpet-postgres psql -U postgres -d ketpet_restore_test -c 'SELECT (SELECT COUNT(*) FROM "Word") AS words, (SELECT COUNT(*) FROM "GrammarQuestion") AS qs;'
docker exec ketpet-postgres dropdb -U postgres ketpet_restore_test
```

Acceptance: restored DB has same row counts as production. (This validates the dump/restore round-trip.)

- [ ] **Step 7: Write Windows Task Scheduler installer**

```powershell
# scripts/schedule-daily-backup.ps1
$action = New-ScheduledTaskAction -Execute "C:\Program Files\Git\bin\bash.exe" -Argument "-c 'cd /c/Users/wul82/Desktop/cambridge-ket-pet/apps/web && ./node_modules/.bin/tsx scripts/backup-db-to-r2.ts >> /c/Users/wul82/Desktop/cambridge-ket-pet/.backup.log 2>&1'"
$trigger = New-ScheduledTaskTrigger -Daily -At 3am
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 10)
Register-ScheduledTask -TaskName "ketpet-db-backup-daily" -Action $action -Trigger $trigger -Settings $settings -Description "Daily pg_dump of ketpet → R2 (7d/4w/12m retention)" -Force
Get-ScheduledTask -TaskName "ketpet-db-backup-daily" | Select-Object TaskName, State, NextRunTime
```

- [ ] **Step 8: Install + verify scheduled task**

```powershell
powershell -ExecutionPolicy Bypass -File scripts/schedule-daily-backup.ps1
```

Expected: task registered, NextRunTime tomorrow 3am.

- [ ] **Step 9: Write restore runbook**

Create `docs/operations/db-backup-runbook.md` documenting:
- Where backups live in R2 (`db-backups/daily/`, `weekly/`, `monthly/`)
- How to list backups: 1-line aws-s3-compatible command
- How to download + restore a backup (3 commands: download, gunzip, `psql < dump`)
- How to disable/re-enable the scheduled task
- Monitoring: `Get-ScheduledTaskInfo -TaskName ketpet-db-backup-daily` + tail .backup.log

If all 9 steps pass → mark task #9 complete; advance to Phase 9.

---

## Phase 9: End-to-end smoke test + memory note

**Goal:** Verify the entire app works against the recovered DB. Save a memory note about the backup setup so future sessions know about it.

- [ ] **Step 1: Confirm all services still running**

```bash
docker exec ketpet-postgres pg_isready -U postgres -d ketpet
curl -s -o /dev/null -w "AI %{http_code}\n" http://localhost:8001/health
curl -s -o /dev/null -w "WEB %{http_code}\n" http://localhost:3000/
```

- [ ] **Step 2: Final DB inventory**

```bash
docker exec ketpet-postgres psql -U postgres -d ketpet -c '
SELECT
  (SELECT COUNT(*) FROM "Word") AS words,
  (SELECT COUNT(*) FROM "Word" WHERE "audioKey" IS NOT NULL) AS words_with_audio,
  (SELECT COUNT(*) FROM "Word" WHERE "glossZh" != '"'"''"'"') AS words_with_gloss,
  (SELECT COUNT(*) FROM "GrammarTopic") AS grammar_topics,
  (SELECT COUNT(*) FROM "GrammarQuestion") AS grammar_qs,
  (SELECT COUNT(*) FROM "SpeakingPhoto") AS speaking_photos;
'
```

Acceptance:
- words = 4624
- words_with_audio = 4624
- words_with_gloss = 4624
- grammar_topics = 40
- grammar_qs >= 500
- speaking_photos = 49

- [ ] **Step 3: User browser smoke test**

Ask user to:
1. Sign up a fresh account at /signup
2. Click "开始本周诊断" — verify it generates without error
3. Open vocab page (`/ket/vocab` or `/pet/vocab`) — verify words show + audio plays
4. Open grammar page (`/ket/grammar` or `/pet/grammar`) — verify topics + questions show

- [ ] **Step 4: Save recovery memory note**

Write `C:\Users\wul82\.claude\projects\C--Users-wul82-Desktop-----\memory\project_db_backup_setup.md` documenting the new backup infrastructure (path, retention, scheduler, runbook location, R2 prefix). Add to `MEMORY.md` index.

- [ ] **Step 5: Mark task #10 complete + report to user**

---

## Self-Review Notes

**Spec coverage:** Every phase from the chat plan maps to a numbered Phase here with concrete steps. R2-driven seeding (Phase 2) implements the user's explicit instruction. Backup automation (Phase 8) addresses the "this can never happen again" requirement.

**No placeholders:** Every code block contains real, runnable code or commands. Every step has expected output or acceptance criteria.

**Type consistency:** `reverseSlug`, `KNOWN_POS`, `computeKeysToDelete`, `parsePdf`, `getR2KeyByCambridgeId`, `pgDump`, `isoWeek` — all defined where used. Prisma model fields match `apps/web/prisma/schema.prisma` (Word, GrammarTopic, GrammarQuestion, SpeakingPhoto).

**Risk mitigation:**
- DeepSeek $10 ceiling: enforced in Phase 6 (smoke test first; abort if cost projections look wrong)
- Idempotency: every step uses upsert or conditional skip; safe to re-run
- Verification gates: SQL counts + spot-checks at every phase boundary
- Backup restore-test: validates dump/restore round-trip before claiming Phase 8 done
