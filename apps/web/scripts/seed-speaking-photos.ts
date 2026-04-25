#!/usr/bin/env node
/**
 * One-shot seed: uploads local JPEG/PNG/WebP photos to R2 under the
 * speaking/photos/ prefix using the bucket credentials already wired
 * for Phase 2. Idempotent — skips objects that already exist.
 *
 * Source images live in apps/web/prisma/data/speaking-photos/<key-basename>.jpg
 * Run: pnpm seed:speaking-photos
 */

import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  PHOTO_LIBRARY_MANIFEST,
  type SpeakingPhotoEntry,
} from "../src/lib/speaking/photo-library";

const required = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
};

const s3 = new S3Client({
  region: "auto",
  endpoint: required("R2_ENDPOINT"),
  credentials: {
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
  },
});
const BUCKET = required("R2_BUCKET");

const SOURCE_DIR = join(__dirname, "..", "prisma", "data", "speaking-photos");

function contentType(key: string): string {
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

async function alreadyUploaded(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (err: any) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) return false;
    throw err;
  }
}

async function uploadOne(entry: SpeakingPhotoEntry): Promise<"uploaded" | "skipped" | "missing"> {
  const basename = entry.key.split("/").pop()!;
  const localPath = join(SOURCE_DIR, basename);

  if (!existsSync(localPath)) return "missing";
  const size = (await stat(localPath)).size;
  if (size === 0) return "missing";

  if (await alreadyUploaded(entry.key)) return "skipped";

  const body = await readFile(localPath);
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: entry.key,
      Body: body,
      ContentType: contentType(entry.key),
      CacheControl: "public, max-age=31536000, immutable",
      Metadata: {
        levels: entry.levels.join(","),
        tags: entry.tags.join(","),
      },
    }),
  );
  return "uploaded";
}

async function main() {
  let uploaded = 0,
    skipped = 0,
    missing = 0;
  const missingKeys: string[] = [];

  for (const entry of PHOTO_LIBRARY_MANIFEST) {
    const result = await uploadOne(entry);
    if (result === "uploaded") uploaded++;
    else if (result === "skipped") skipped++;
    else {
      missing++;
      missingKeys.push(entry.key);
    }
  }

  console.log(
    `Photo seed done: uploaded=${uploaded} skipped=${skipped} missing=${missing}`,
  );
  if (missing > 0) {
    console.log("Missing source files (drop JPEGs with these basenames into",
      "apps/web/prisma/data/speaking-photos/ then re-run):");
    for (const k of missingKeys) console.log("  ", k.split("/").pop());
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
