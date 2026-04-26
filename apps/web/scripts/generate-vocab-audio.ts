/**
 * Pre-generate single-word MP3s via Microsoft Edge TTS, upload to Cloudflare R2,
 * write the resulting key back to Word.audioKey.
 *
 * Idempotent — only processes rows where audioKey is null. Concurrency cap = 5.
 *
 * R2 key pattern: vocab/{voiceTag}/{cambridgeId}.mp3
 *   (cambridgeId is unique across KET+PET in this dataset — verified at runtime.)
 *
 * Reuses Phase 2 helpers:
 *   - synthesizeSegmentWithRetry  ./src/lib/audio/edge-tts-client.ts
 *   - VOICE_CAST                  ./src/lib/audio/voices.ts
 *
 * The Phase 2 R2 helper (uploadAudioToR2) hard-codes the listening/{testId} key
 * pattern, so this script issues PutObjectCommand directly with a vocab/* key.
 *
 * Usage:
 *   pnpm tsx scripts/generate-vocab-audio.ts
 *   pnpm tsx scripts/generate-vocab-audio.ts --voiceTag S1_male
 *   pnpm tsx scripts/generate-vocab-audio.ts --take 10              (smoke test)
 *   pnpm tsx scripts/generate-vocab-audio.ts --concurrency 3
 */
import "dotenv/config";

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

import { synthesizeSegmentWithRetry } from "../src/lib/audio/edge-tts-client";
import type { VoiceTag } from "../src/lib/audio/types";
import { voiceNameFor } from "../src/lib/audio/voices";

const prisma = new PrismaClient();

const DEFAULT_VOICE_TAG: VoiceTag = "S1_male"; // en-GB-RyanNeural (British male)
const DEFAULT_CONCURRENCY = 5;

interface WordRow {
  id: string;
  cambridgeId: string;
  word: string;
  examType: string;
}

function bucket(): string {
  const v = process.env.R2_BUCKET;
  if (!v) throw new Error("R2_BUCKET env var is not set");
  return v;
}

function r2Client(): S3Client {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 env vars missing — need R2_ENDPOINT + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY",
    );
  }
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function uploadVocabMp3(
  client: S3Client,
  key: string,
  body: Buffer,
): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket(),
          Key: key,
          Body: body,
          ContentType: "audio/mpeg",
        }),
      );
      return;
    } catch (err) {
      lastErr = err;
      if (attempt === 2) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastErr;
}

async function processOne(
  client: S3Client,
  word: WordRow,
  voiceTag: VoiceTag,
  tmpDir: string,
): Promise<string> {
  // Edge-TTS only writes to disk; use a temp file then read into a Buffer.
  const tmpPath = path.join(tmpDir, `${word.id}.mp3`);
  try {
    await synthesizeSegmentWithRetry({
      text: word.word,
      voiceTag,
      ratePercent: 0,
      outPath: tmpPath,
    });
    const buffer = fs.readFileSync(tmpPath);
    if (buffer.length === 0) {
      throw new Error("Edge-TTS produced an empty MP3");
    }
    const key = `vocab/${voiceTag}/${word.cambridgeId}.mp3`;
    await uploadVocabMp3(client, key, buffer);
    await prisma.word.update({
      where: { id: word.id },
      data: { audioKey: key },
    });
    return key;
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      /* ignore */
    }
  }
}

async function processWithConcurrency(
  client: S3Client,
  todo: WordRow[],
  voiceTag: VoiceTag,
  concurrency: number,
  tmpDir: string,
) {
  let idx = 0;
  let done = 0;
  let failed = 0;
  const failures: { cambridgeId: string; word: string; error: string }[] = [];
  const total = todo.length;
  const startedAt = Date.now();

  async function worker(workerId: number) {
    while (true) {
      const i = idx++;
      if (i >= todo.length) return;
      const w = todo[i];
      try {
        await processOne(client, w, voiceTag, tmpDir);
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        failures.push({ cambridgeId: w.cambridgeId, word: w.word, error: msg });
        console.error(
          `[audio] worker=${workerId} FAILED ${w.examType}/${w.cambridgeId} (${w.word}):`,
          msg,
        );
      }
      done++;
      if (done % 50 === 0 || done === total) {
        const elapsed = (Date.now() - startedAt) / 1000;
        const rate = done / Math.max(elapsed, 0.001);
        const remaining = total - done;
        const etaSec = remaining / Math.max(rate, 0.001);
        console.log(
          `[audio] ${done} / ${total} (failed=${failed}) — ${rate.toFixed(2)}/s, ETA ${etaSec.toFixed(0)}s`,
        );
      }
    }
  }
  const workers: Promise<void>[] = [];
  for (let n = 0; n < concurrency; n++) workers.push(worker(n));
  await Promise.all(workers);
  return { done, failed, failures };
}

function arg(name: string): string | null {
  const args = process.argv.slice(2);
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

function parseVoiceTag(raw: string | null): VoiceTag {
  if (raw === null) return DEFAULT_VOICE_TAG;
  if (
    raw === "proctor" ||
    raw === "S1_male" ||
    raw === "S2_female_A" ||
    raw === "S2_female_B"
  ) {
    return raw;
  }
  throw new Error(
    `--voiceTag must be one of: proctor, S1_male, S2_female_A, S2_female_B (got ${raw})`,
  );
}

async function main() {
  const voiceTag = parseVoiceTag(arg("--voiceTag"));
  const voiceName = voiceNameFor(voiceTag);
  const concurrencyArg = arg("--concurrency");
  const concurrency = concurrencyArg
    ? Math.max(1, parseInt(concurrencyArg, 10))
    : DEFAULT_CONCURRENCY;
  const takeArg = arg("--take");
  const take = takeArg ? Math.max(1, parseInt(takeArg, 10)) : null;

  const findArgs: Parameters<typeof prisma.word.findMany>[0] = {
    where: { audioKey: null },
    select: {
      id: true,
      cambridgeId: true,
      word: true,
      examType: true,
    },
    orderBy: [{ examType: "asc" }, { cambridgeId: "asc" }],
  };
  if (take !== null) findArgs.take = take;

  const todo = (await prisma.word.findMany(findArgs)) as WordRow[];

  console.log(
    `[config] voiceTag=${voiceTag} (${voiceName}) concurrency=${concurrency}` +
      (take !== null ? ` take=${take} (smoke test)` : ""),
  );
  console.log(`[audio] ${todo.length} words to generate`);

  if (todo.length === 0) {
    console.log("[audio] nothing to do — exiting");
    await prisma.$disconnect();
    return;
  }

  // Sanity check: cambridgeId must be unique within the planned R2 prefix
  // (i.e., across the rows we're about to upload). vocab/{voice}/{cambridgeId}.mp3
  // overwrites otherwise — verified globally above; double-check for the take
  // subset too.
  const seen = new Set<string>();
  for (const w of todo) {
    if (seen.has(w.cambridgeId)) {
      throw new Error(
        `Duplicate cambridgeId ${w.cambridgeId} in todo set — would clobber R2 keys`,
      );
    }
    seen.add(w.cambridgeId);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vocab-tts-"));
  console.log(`[audio] tmp dir: ${tmpDir}`);

  const client = r2Client();
  const start = Date.now();
  const { done, failed, failures } = await processWithConcurrency(
    client,
    todo,
    voiceTag,
    concurrency,
    tmpDir,
  );
  const wallSec = (Date.now() - start) / 1000;

  try {
    fs.rmdirSync(tmpDir);
  } catch {
    /* ignore non-empty tmp dir */
  }

  console.log(
    `[audio] DONE — ${done - failed} succeeded, ${failed} failed (of ${todo.length}) in ${wallSec.toFixed(1)}s`,
  );
  if (failures.length > 0) {
    console.log("[audio] failure list:");
    for (const f of failures) {
      console.log(`  ${f.cambridgeId} (${f.word}): ${f.error}`);
    }
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
