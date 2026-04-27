#!/usr/bin/env node
/**
 * Regenerate all speaking-prompt photos using SiliconFlow Qwen-Image.
 *
 * Why: the original `fetch-speaking-photos.ts` falls back to Picsum
 * (random stock photos) when Pollinations.ai queue is full, which left
 * many speaking photos unrelated to their intended topic (e.g.,
 * "choice-gifts-01.jpg" returned a fish-underwater photo). This script
 * uses SiliconFlow's Qwen-Image model (paid, reliable, topic-matched)
 * to regenerate every entry in PHOTO_LIBRARY_MANIFEST.
 *
 * Idempotent w/ --skip-existing: skips entries whose local JPEG already
 * exists. Default behaviour: regenerate ALL (overwriting both local
 * file and R2 object).
 *
 * Usage:
 *   pnpm tsx scripts/regenerate-speaking-photos.ts                # regenerate all
 *   pnpm tsx scripts/regenerate-speaking-photos.ts --keys daily-life-01,school-01   # only listed
 *   pnpm tsx scripts/regenerate-speaking-photos.ts --skip-existing                  # only regen missing local files
 *   pnpm tsx scripts/regenerate-speaking-photos.ts --concurrency 2                  # tune worker pool
 *
 * Required env (loaded from apps/web/.env + services/ai/.env):
 *   SILICONFLOW_API_KEY         SF Bearer token
 *   R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 */

import "dotenv/config";
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import dotenv from "dotenv";
import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  PHOTO_LIBRARY_MANIFEST,
  type SpeakingPhotoEntry,
} from "../src/lib/speaking/photo-library";

// Pull SILICONFLOW_API_KEY from services/ai/.env (where other AI keys live)
dotenv.config({ path: path.resolve(__dirname, "../../../services/ai/.env") });

const SF_API = "https://api.siliconflow.cn/v1/images/generations";
const SF_MODEL = "Qwen/Qwen-Image";
const IMAGE_SIZE = "1024x768";
const TARGET_DIR = path.resolve(__dirname, "..", "prisma", "data", "speaking-photos");
const REQUEST_TIMEOUT_MS = 120_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const SF_KEY = process.env.SILICONFLOW_API_KEY;
const R2_BUCKET = process.env.R2_BUCKET;
const DEFAULT_CONCURRENCY = 4;

if (!SF_KEY) throw new Error("SILICONFLOW_API_KEY missing — check services/ai/.env");
if (!R2_BUCKET) throw new Error("R2_BUCKET missing — check apps/web/.env");
if (!process.env.R2_ENDPOINT) throw new Error("R2_ENDPOINT missing");

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

interface SfImagesResponse {
  images?: Array<{ url: string }>;
  data?: Array<{ url: string }>;
  error?: { message: string };
}

function buildPrompt(entry: SpeakingPhotoEntry, extraSuffix?: string): string {
  // Same shape as the original fetch script's buildPrompt — keeps the
  // photorealistic / documentary-style framing the photos were originally
  // commissioned with.
  const parts = [
    entry.description,
    "candid daily-life photograph",
    "natural lighting",
    "documentary photography",
    "high detail",
    "no text overlay",
  ];
  if (extraSuffix) parts.push(extraSuffix);
  return parts.join(", ");
}

async function generateOne(entry: SpeakingPhotoEntry, promptSuffix?: string): Promise<Buffer> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(SF_API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${SF_KEY}`,
      },
      body: JSON.stringify({
        model: SF_MODEL,
        prompt: buildPrompt(entry, promptSuffix),
        image_size: IMAGE_SIZE,
        batch_size: 1,
      }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SF gen ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as SfImagesResponse;
  const url = json.images?.[0]?.url ?? json.data?.[0]?.url;
  if (!url) {
    throw new Error(`SF returned no image URL: ${JSON.stringify(json).slice(0, 300)}`);
  }
  // Download the generated image (PNG) from temporary signed URL.
  const dlCtrl = new AbortController();
  const dlTimer = setTimeout(() => dlCtrl.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const dl = await fetch(url, { signal: dlCtrl.signal });
    if (!dl.ok) throw new Error(`download ${dl.status}`);
    return Buffer.from(await dl.arrayBuffer());
  } finally {
    clearTimeout(dlTimer);
  }
}

async function processEntry(
  entry: SpeakingPhotoEntry,
  opts: { skipExisting: boolean; promptSuffix?: string },
): Promise<"regenerated" | "skipped" | "failed"> {
  const basename = entry.key.split("/").pop()!;
  const localPath = path.join(TARGET_DIR, basename);

  if (opts.skipExisting && existsSync(localPath)) {
    return "skipped";
  }

  // Step 1: generate via SF
  let pngBuf: Buffer;
  try {
    pngBuf = await generateOne(entry, opts.promptSuffix);
  } catch (err: any) {
    console.error(`  ${basename}  ✗ SF generate FAILED: ${err.message?.slice(0, 200)}`);
    return "failed";
  }

  // Step 2: convert PNG → JPEG (quality 88, sane size for Cambridge prompts)
  let jpegBuf: Buffer;
  try {
    jpegBuf = await sharp(pngBuf).jpeg({ quality: 88 }).toBuffer();
  } catch (err: any) {
    console.error(`  ${basename}  ✗ JPEG convert FAILED: ${err.message?.slice(0, 200)}`);
    return "failed";
  }

  // Step 3: save local copy (overwrite)
  try {
    await writeFile(localPath, jpegBuf);
  } catch (err: any) {
    console.error(`  ${basename}  ✗ local write FAILED: ${err.message?.slice(0, 200)}`);
    return "failed";
  }

  // Step 4: upload to R2 (overwrite same key)
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: entry.key,
        Body: jpegBuf,
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable",
        Metadata: {
          source: "siliconflow-qwen-image",
          regenerated_at: new Date().toISOString(),
          levels: entry.levels.join(","),
          tags: entry.tags.join(","),
        },
      }),
    );
  } catch (err: any) {
    console.error(`  ${basename}  ✗ R2 upload FAILED: ${err.message?.slice(0, 200)}`);
    return "failed";
  }

  return "regenerated";
}

function parseArgs() {
  const args = process.argv.slice(2);
  const skipExisting = args.includes("--skip-existing");
  const concurrencyIdx = args.indexOf("--concurrency");
  const concurrency = concurrencyIdx >= 0 ? parseInt(args[concurrencyIdx + 1], 10) : DEFAULT_CONCURRENCY;
  const keysIdx = args.indexOf("--keys");
  const keysFilter = keysIdx >= 0 ? new Set(args[keysIdx + 1].split(",").map((k) => k.trim())) : null;
  const suffixIdx = args.indexOf("--prompt-suffix");
  const promptSuffix = suffixIdx >= 0 ? args[suffixIdx + 1] : undefined;
  return { skipExisting, concurrency, keysFilter, promptSuffix };
}

async function main() {
  const { skipExisting, concurrency, keysFilter, promptSuffix } = parseArgs();
  await mkdir(TARGET_DIR, { recursive: true });

  const entries = keysFilter
    ? PHOTO_LIBRARY_MANIFEST.filter((e) =>
        keysFilter.has(e.key.split("/").pop()!.replace(/\.jpg$/, "")),
      )
    : [...PHOTO_LIBRARY_MANIFEST];

  console.log(
    `Regenerating ${entries.length} photos via SF Qwen-Image  ` +
      `(concurrency=${concurrency}, skipExisting=${skipExisting})`,
  );
  console.log(`Target dir: ${TARGET_DIR}`);
  console.log(`R2 bucket: ${R2_BUCKET}`);
  console.log("");

  let regenerated = 0;
  let skipped = 0;
  let failed = 0;
  const failures: string[] = [];

  const queue = [...entries];
  const t0 = Date.now();
  async function worker(workerId: number): Promise<void> {
    while (queue.length > 0) {
      const entry = queue.shift();
      if (!entry) return;
      const basename = entry.key.split("/").pop()!;
      const t1 = Date.now();
      const result = await processEntry(entry, { skipExisting, promptSuffix });
      const ms = Date.now() - t1;
      if (result === "regenerated") {
        regenerated++;
        console.log(`  [w${workerId}] ${basename.padEnd(32)} ✓ regenerated (${ms}ms)`);
      } else if (result === "skipped") {
        skipped++;
        console.log(`  [w${workerId}] ${basename.padEnd(32)} · skipped (local exists)`);
      } else {
        failed++;
        failures.push(basename);
      }
    }
  }
  await Promise.all(
    Array.from({ length: concurrency }, (_, i) => worker(i + 1)),
  );

  const totalMs = Date.now() - t0;
  console.log("");
  console.log(
    `Done in ${(totalMs / 1000).toFixed(1)}s — regenerated=${regenerated}  skipped=${skipped}  failed=${failed}`,
  );
  if (failures.length > 0) {
    console.log("Failed entries (re-run with --keys to retry):");
    for (const f of failures) console.log(`  ${f}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("regenerate-speaking-photos failed:", err);
  process.exit(1);
});
