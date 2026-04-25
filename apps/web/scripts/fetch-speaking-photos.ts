#!/usr/bin/env node
/**
 * One-shot fetcher: pulls AI-generated, photorealistic photos from
 * Pollinations.ai (free, no API key) for every entry in the speaking
 * photo manifest, saves them under
 *   apps/web/prisma/data/speaking-photos/<basename>.jpg
 *
 * After this runs, `pnpm seed:speaking-photos` uploads them to R2.
 *
 * The image is deterministic per manifest entry (seeded by hash of the
 * R2 key), so re-runs after a network blip pick up where they left off
 * without rewriting already-downloaded photos.
 *
 * Run: pnpm fetch:speaking-photos
 */

import { mkdir, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  PHOTO_LIBRARY_MANIFEST,
  type SpeakingPhotoEntry,
} from "../src/lib/speaking/photo-library";

const TARGET_DIR = join(__dirname, "..", "prisma", "data", "speaking-photos");
const WIDTH = 1024;
const HEIGHT = 768;
const MIN_BYTES = 5_000; // Pollinations sometimes returns tiny error JPEGs.

function basenameOf(key: string): string {
  return key.split("/").pop()!;
}

function seedFor(key: string): number {
  // Deterministic seed so re-runs produce the same image.
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function buildPrompt(entry: SpeakingPhotoEntry): string {
  // Frame the description for Cambridge-test-appropriate stock photo
  // styling: real-world, natural lighting, no surreal artifacts. The
  // suffix nudges Pollinations' model toward photorealism rather than
  // its default illustrative style.
  return [
    entry.description,
    "candid daily-life photograph",
    "natural lighting",
    "documentary photography",
    "high detail",
    "no text overlay",
  ].join(", ");
}

async function fetchPollinations(entry: SpeakingPhotoEntry): Promise<Buffer | null> {
  const prompt = buildPrompt(entry);
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?seed=${seedFor(entry.key)}` +
    `&width=${WIDTH}&height=${HEIGHT}` +
    `&nologo=true&safe=true`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // Pollinations returns small JSON {"error":"Queue full"} bodies as
    // 200/JPEG when overloaded. Reject anything implausibly small.
    if (buf.length < MIN_BYTES) return null;
    // Sanity-check the JPEG magic bytes — Pollinations error responses
    // are JSON despite the URL, and would survive the byte-count check
    // for moderately long error messages.
    if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
    return buf;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPicsum(entry: SpeakingPhotoEntry): Promise<Buffer | null> {
  // Lorem Picsum delivers real stock photos instantly, no API key, no
  // rate limit. Photos are NOT topic-matched but are real (vs. AI-gen)
  // and reliably available — preferred fallback when Pollinations is
  // queue-full. Seeded by R2 key so re-runs are deterministic.
  const url =
    `https://picsum.photos/seed/${encodeURIComponent(basenameOf(entry.key))}/${WIDTH}/${HEIGHT}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < MIN_BYTES) return null;
    if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
    return buf;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOne(entry: SpeakingPhotoEntry): Promise<"fetched" | "skipped" | "failed"> {
  const localPath = join(TARGET_DIR, basenameOf(entry.key));

  if (existsSync(localPath)) {
    const sz = (await stat(localPath)).size;
    if (sz >= MIN_BYTES) return "skipped";
  }

  // Prefer Pollinations (topic-matched AI-generated), fall back to
  // Picsum (real but topic-agnostic) when Pollinations queue is full.
  let buf = await fetchPollinations(entry);
  if (!buf) {
    buf = await fetchPicsum(entry);
  }
  if (!buf) return "failed";

  await writeFile(localPath, buf);
  return "fetched";
}

const CONCURRENCY = 4;

async function main(): Promise<void> {
  await mkdir(TARGET_DIR, { recursive: true });

  console.log(
    `Fetching ${PHOTO_LIBRARY_MANIFEST.length} photos (Pollinations → Picsum fallback) → ${TARGET_DIR}\n`,
  );

  let fetched = 0;
  let skipped = 0;
  let failed = 0;

  // Concurrent worker pool: shared queue of entries, N workers pulling
  // from it. Picsum handles parallel requests fine; Pollinations will
  // either succeed or fail-fast to Picsum, so concurrency doesn't make
  // the rate-limit worse.
  const queue = [...PHOTO_LIBRARY_MANIFEST];
  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const entry = queue.shift();
      if (!entry) return;
      const base = basenameOf(entry.key);
      const t0 = Date.now();
      const result = await fetchOne(entry);
      const ms = Date.now() - t0;
      if (result === "fetched") {
        fetched++;
        console.log(`  ${base.padEnd(36)} ✓ fetched (${ms}ms)`);
      } else if (result === "skipped") {
        skipped++;
        console.log(`  ${base.padEnd(36)} · skipped`);
      } else {
        failed++;
        console.log(`  ${base.padEnd(36)} ✗ FAILED (${ms}ms)`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  console.log(`\nResult: ${fetched} fetched, ${skipped} skipped, ${failed} failed`);
  if (fetched > 0 || skipped > 0) {
    console.log(`Next step: pnpm seed:speaking-photos`);
  }
  if (failed > 0) {
    console.log(
      `\n${failed} photo(s) failed. Re-run \`pnpm fetch:speaking-photos\` to retry just the failures (already-downloaded files are skipped).`,
    );
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("fetch-speaking-photos failed:", err);
  process.exit(1);
});
