/**
 * Daily pg_dump → gzip → R2 upload with retention rotation.
 *
 * Retention policy:
 *   db-backups/daily/<YYYY-MM-DD>.sql.gz   — keep last 7
 *   db-backups/weekly/<YYYY-WW>.sql.gz     — keep last 4 (taken on Sundays)
 *   db-backups/monthly/<YYYY-MM>.sql.gz    — keep last 12 (taken on 1st of month)
 *
 * Run: pnpm tsx scripts/backup-db-to-r2.ts
 */
import "dotenv/config";
import { spawn } from "node:child_process";
import { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { gzipSync } from "node:zlib";

const KEEP_DAILY = 7, KEEP_WEEKLY = 4, KEEP_MONTHLY = 12;

export function computeKeysToDelete(existing: string[], _today: Date): string[] {
  const toDelete: string[] = [];
  for (const tier of ["daily", "weekly", "monthly"] as const) {
    const limit = { daily: KEEP_DAILY, weekly: KEEP_WEEKLY, monthly: KEEP_MONTHLY }[tier];
    const tierKeys = existing.filter((k) => k.startsWith(`db-backups/${tier}/`)).sort().reverse();
    for (const k of tierKeys.slice(limit)) toDelete.push(k);
  }
  return toDelete;
}

function pgDump(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn("docker", [
      "exec",
      "ketpet-postgres",
      "pg_dump",
      "-U",
      "postgres",
      "-d",
      "ketpet",
      "--clean",
      "--if-exists",
    ]);
    const chunks: Buffer[] = [];
    proc.stdout.on("data", (c) => chunks.push(c));
    proc.stderr.on("data", (c) => process.stderr.write(c));
    proc.on("close", (code) => {
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
  console.log(`[backup] gzipped to ${gz.length} bytes (ratio ${(sql.length / gz.length).toFixed(1)}x)`);

  const client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  // Always upload a daily; conditionally upload weekly (Sunday) + monthly (1st of month).
  const uploads = [`db-backups/daily/${ymd}.sql.gz`];
  if (dow === 0) uploads.push(`db-backups/weekly/${isoWeek(today)}.sql.gz`);
  if (dom === 1) uploads.push(`db-backups/monthly/${ym}.sql.gz`);

  for (const key of uploads) {
    await client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      Body: gz,
      ContentType: "application/gzip",
    }));
    console.log(`[backup] uploaded ${key}`);
  }

  // Apply retention rotation: list all db-backups/, compute deletes, batch-delete
  let token: string | undefined;
  const allKeys: string[] = [];
  do {
    const r: any = await client.send(new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET!,
      Prefix: "db-backups/",
      ContinuationToken: token,
      MaxKeys: 1000,
    }));
    for (const o of r.Contents ?? []) allKeys.push(o.Key);
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  const toDelete = computeKeysToDelete(allKeys, today);
  if (toDelete.length > 0) {
    await client.send(new DeleteObjectsCommand({
      Bucket: process.env.R2_BUCKET!,
      Delete: { Objects: toDelete.map((Key) => ({ Key })) },
    }));
    console.log(`[backup] deleted ${toDelete.length} expired backups: ${toDelete.join(", ")}`);
  } else {
    console.log(`[backup] no expired backups to delete`);
  }
  console.log(`[backup] done`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
