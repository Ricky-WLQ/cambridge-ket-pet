/**
 * Listening Part 1 (MCQ_3_PICTURE) option-image generator + R2 cache.
 *
 * The Cambridge KET/PET Listening Part 1 spec calls for 3 photo options
 * per question. This module turns the AI-returned `imageDescription`
 * into a real photo via SiliconFlow Qwen-Image and stores it in R2,
 * keyed by SHA256 of the normalized description so repeat generations
 * across tests reuse the cached image.
 *
 * Cache layout: `listening/options/<sha16>.jpg`
 *
 * Failure modes degrade gracefully — `ensureOptionImage` returns null
 * if anything goes wrong (SF API down, R2 unavailable, sharp crash),
 * and the caller leaves `imageUrl` undefined so the renderer falls
 * back to the existing description-as-text behavior.
 */

import "server-only";
import { createHash } from "node:crypto";
import {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

const SF_API = "https://api.siliconflow.cn/v1/images/generations";
const SF_MODEL = "Qwen/Qwen-Image";
const IMAGE_SIZE = "1024x768";
const SF_REQUEST_TIMEOUT_MS = 120_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const KEY_PREFIX = "listening/options/";

export function normalizeDescription(description: string): string {
  return description.trim().toLowerCase().replace(/\s+/g, " ");
}

export function hashDescription(description: string): string {
  const normalized = normalizeDescription(description);
  return createHash("sha256").update(normalized, "utf8").digest("hex").slice(0, 16);
}

function buildPrompt(description: string): string {
  return [
    `Single subject: ${description}.`,
    "Plain neutral white background",
    "centered",
    "isolated",
    "photorealistic",
    "soft natural lighting",
    "no people",
    "no text",
    "no logos",
    "no watermarks",
    "square aspect",
    "Cambridge English exam multiple-choice photo style",
  ].join(", ");
}

interface SfImagesResponse {
  images?: Array<{ url?: string }>;
  data?: Array<{ url?: string }>;
  error?: { message?: string };
}

function getR2Client(): S3Client | null {
  if (
    !process.env.R2_ENDPOINT ||
    !process.env.R2_ACCESS_KEY_ID ||
    !process.env.R2_SECRET_ACCESS_KEY ||
    !process.env.R2_BUCKET
  ) {
    return null;
  }
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

async function r2KeyExists(client: S3Client, key: string): Promise<boolean> {
  try {
    await client.send(
      new HeadObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }),
    );
    return true;
  } catch (err: unknown) {
    const status = (err as { $metadata?: { httpStatusCode?: number } })
      ?.$metadata?.httpStatusCode;
    const name = (err as { name?: string })?.name;
    if (status === 404 || name === "NotFound" || name === "NoSuchKey") {
      return false;
    }
    // Unknown error — log and treat as miss so we attempt regeneration. The
    // PUT below will surface the real failure if R2 is genuinely down.
    console.warn(`[option-image] R2 HEAD failed for ${key}:`, err);
    return false;
  }
}

async function siliconflowGeneratePng(
  description: string,
  apiKey: string,
): Promise<Buffer | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SF_REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(SF_API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: SF_MODEL,
        prompt: buildPrompt(description),
        image_size: IMAGE_SIZE,
        batch_size: 1,
      }),
      signal: ctrl.signal,
    });
  } catch (err) {
    console.warn(`[option-image] SF fetch threw for "${description}":`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "(unreadable)");
    console.warn(
      `[option-image] SF gen ${res.status} for "${description}": ${body.slice(0, 200)}`,
    );
    return null;
  }

  let json: SfImagesResponse;
  try {
    json = (await res.json()) as SfImagesResponse;
  } catch {
    console.warn(`[option-image] SF returned non-JSON for "${description}"`);
    return null;
  }

  const url = json.images?.[0]?.url ?? json.data?.[0]?.url;
  if (!url) {
    console.warn(
      `[option-image] SF returned no image URL for "${description}":`,
      JSON.stringify(json).slice(0, 200),
    );
    return null;
  }

  const dlCtrl = new AbortController();
  const dlTimer = setTimeout(() => dlCtrl.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const dl = await fetch(url, { signal: dlCtrl.signal });
    if (!dl.ok) {
      console.warn(
        `[option-image] download ${dl.status} for "${description}" url=${url}`,
      );
      return null;
    }
    return Buffer.from(await dl.arrayBuffer());
  } catch (err) {
    console.warn(`[option-image] download threw for "${description}":`, err);
    return null;
  } finally {
    clearTimeout(dlTimer);
  }
}

/**
 * Resolve (or generate + upload) the R2 key for an MCQ_3_PICTURE option's
 * image. Returns the R2 key on success, or null if any step fails — caller
 * should leave `imageUrl` undefined so the renderer falls back to text.
 *
 * Idempotent: subsequent calls with the same description hit the R2 cache.
 */
export async function ensureOptionImage(
  description: string,
): Promise<string | null> {
  const normalized = normalizeDescription(description);
  if (!normalized) return null;

  const apiKey = process.env.SILICONFLOW_API_KEY;
  if (!apiKey) {
    console.warn(
      "[option-image] SILICONFLOW_API_KEY not set — skipping image generation",
    );
    return null;
  }

  const client = getR2Client();
  if (!client) {
    console.warn(
      "[option-image] R2 env vars not set — skipping image generation",
    );
    return null;
  }

  const key = `${KEY_PREFIX}${hashDescription(description)}.jpg`;

  // Cache hit?
  if (await r2KeyExists(client, key)) {
    return key;
  }

  // Cache miss → generate via SF
  const pngBuf = await siliconflowGeneratePng(description, apiKey);
  if (!pngBuf) return null;

  // Convert PNG → JPEG via sharp
  let jpegBuf: Buffer;
  try {
    jpegBuf = await sharp(pngBuf).jpeg({ quality: 85 }).toBuffer();
  } catch (err) {
    console.warn(
      `[option-image] sharp PNG→JPEG failed for "${description}":`,
      err,
    );
    return null;
  }

  // Upload to R2
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: key,
        Body: jpegBuf,
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable",
        Metadata: {
          source: "siliconflow-qwen-image",
          description: normalized,
          generated_at: new Date().toISOString(),
        },
      }),
    );
  } catch (err) {
    console.warn(`[option-image] R2 PUT failed for ${key}:`, err);
    return null;
  }

  return key;
}
