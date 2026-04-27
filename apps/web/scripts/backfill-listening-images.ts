#!/usr/bin/env node
/**
 * One-shot backfill: walk every Test row of kind=LISTENING, find every
 * MCQ_3_PICTURE option missing imageUrl, and fill it via
 * `ensureOptionImage`. Idempotent — re-runs skip already-imaged options.
 *
 * Hard-cap of 250 SiliconFlow calls (≈ $5 ceiling). Stops mid-test if
 * the cap is hit; partially-backfilled tests will finish on next run.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-listening-images.ts
 *   pnpm tsx scripts/backfill-listening-images.ts --dry-run
 *   pnpm tsx scripts/backfill-listening-images.ts --max-calls 50
 *
 * Required env (loaded from apps/web/.env + services/ai/.env):
 *   SILICONFLOW_API_KEY, R2_ENDPOINT, R2_ACCESS_KEY_ID,
 *   R2_SECRET_ACCESS_KEY, R2_BUCKET, DATABASE_URL
 */

import "dotenv/config";
import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { ensureOptionImage } from "../src/lib/listening/option-image";

// Pull SILICONFLOW_API_KEY from services/ai/.env if not in apps/web/.env
dotenv.config({
  path: path.resolve(__dirname, "..", "..", "..", "services", "ai", ".env"),
});

const DEFAULT_MAX_CALLS = 250;
const CONCURRENCY = 4;

interface ListeningOption {
  id: string;
  text?: string;
  imageDescription?: string;
  imageUrl?: string;
}

interface ListeningQuestion {
  id: string;
  type: string;
  options?: ListeningOption[];
}

interface ListeningPart {
  partNumber: number;
  kind: string;
  questions: ListeningQuestion[];
}

interface ListeningPayloadV2 {
  version: number;
  parts: ListeningPart[];
  [k: string]: unknown;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const maxIdx = args.indexOf("--max-calls");
  const maxCalls =
    maxIdx >= 0 ? parseInt(args[maxIdx + 1], 10) : DEFAULT_MAX_CALLS;
  return { dryRun, maxCalls };
}

function collectOptionsNeedingImage(
  payload: ListeningPayloadV2,
): ListeningOption[] {
  const out: ListeningOption[] = [];
  if (!payload?.parts) return out;
  for (const part of payload.parts) {
    if (part.kind !== "MCQ_3_PICTURE") continue;
    for (const q of part.questions ?? []) {
      for (const opt of q.options ?? []) {
        if (opt.imageDescription && !opt.imageUrl) {
          out.push(opt);
        }
      }
    }
  }
  return out;
}

async function main() {
  const { dryRun, maxCalls } = parseArgs();
  const prisma = new PrismaClient();

  console.log(
    `[backfill] starting (dryRun=${dryRun}, maxCalls=${maxCalls}, concurrency=${CONCURRENCY})`,
  );

  const tests = await prisma.test.findMany({
    where: { kind: "LISTENING" },
    select: { id: true, payload: true, examType: true },
    orderBy: { createdAt: "desc" },
  });

  console.log(`[backfill] found ${tests.length} listening tests`);

  let totalNeeded = 0;
  let totalSkippedByCap = 0;
  let totalGenerated = 0;
  let totalFailed = 0;
  let testsTouched = 0;
  let calls = 0;

  for (const test of tests) {
    const payload = test.payload as unknown as ListeningPayloadV2;
    const todo = collectOptionsNeedingImage(payload);
    if (todo.length === 0) continue;
    totalNeeded += todo.length;
    console.log(
      `[backfill] test ${test.id} (${test.examType}): ${todo.length} options need images`,
    );

    if (dryRun) continue;

    // Process this test's options with bounded concurrency. Track
    // per-attempt cap so we never exceed maxCalls in total. (Cache hits
    // do not count toward the cap.)
    const queue = [...todo];
    let testGen = 0;
    let testFail = 0;
    async function worker() {
      while (queue.length > 0) {
        if (calls >= maxCalls) {
          totalSkippedByCap += queue.length;
          queue.length = 0;
          return;
        }
        const opt = queue.shift();
        if (!opt) return;
        calls++;
        const t0 = Date.now();
        const key = await ensureOptionImage(opt.imageDescription!).catch(
          () => null,
        );
        const ms = Date.now() - t0;
        if (key) {
          opt.imageUrl = key;
          testGen++;
          if (testGen % 10 === 0) {
            console.log(
              `  ... ${testGen} options resolved (latest ${ms}ms key=${key})`,
            );
          }
        } else {
          testFail++;
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

    if (testGen > 0) {
      // Persist updated payload
      await prisma.test.update({
        where: { id: test.id },
        data: { payload: payload as object },
      });
      testsTouched++;
    }
    totalGenerated += testGen;
    totalFailed += testFail;

    console.log(
      `  test ${test.id} done: +${testGen} ok, ${testFail} failed (running total: calls=${calls}/${maxCalls})`,
    );
    if (calls >= maxCalls) break;
  }

  console.log("");
  console.log(
    `[backfill] DONE — tests with picture options needing image: ${
      totalNeeded > 0 ? "many" : "none"
    }`,
  );
  console.log(`  totalNeeded:      ${totalNeeded}`);
  console.log(`  totalGenerated:   ${totalGenerated}`);
  console.log(`  totalFailed:      ${totalFailed}`);
  console.log(`  totalSkippedCap:  ${totalSkippedByCap}`);
  console.log(`  testsTouched:     ${testsTouched}`);
  console.log(`  callsConsumed:    ${calls}/${maxCalls}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("backfill-listening-images failed:", err);
  process.exit(1);
});
