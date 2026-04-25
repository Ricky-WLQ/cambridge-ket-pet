import { NextResponse } from "next/server";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { auth } from "@/lib/auth";

/**
 * GET /api/r2/[...key]
 *
 * Generic R2 stream-proxy. Streams any R2-backed asset (Speaking photos,
 * Vocab audio, future grammar audio, etc.) from Cloudflare R2 through
 * Zeabur's Next.js. The R2 domain stays hidden from Chinese users (they
 * only see our Zeabur Singapore endpoint). Mirrors the Phase 2 listening
 * audio stream-proxy pattern, but simpler since assets are small
 * (~200KB photos, ~50KB MP3s) — range requests are not required.
 *
 * Auth: requires a logged-in session. Unauthenticated callers get 401.
 *
 * Content-Type: inferred from the key's extension (defaults to
 * application/octet-stream for unknown extensions). Cache-Control is
 * `private, max-age=300` — per-user caching for 5 minutes so re-renders
 * don't hammer R2.
 */

const CONTENT_TYPES: Record<string, string> = {
  // Image types
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  // Audio types
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  webm: "audio/webm",
  wav: "audio/wav",
};

function inferContentType(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

function r2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ key: string[] }> },
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { key: keySegments } = await ctx.params;
  if (!keySegments || keySegments.length === 0) {
    return NextResponse.json({ error: "missing_key" }, { status: 400 });
  }
  // The key segments arrive URL-decoded from Next.js' catch-all route.
  const key = keySegments.join("/");

  const bucket = process.env.R2_BUCKET;
  if (!bucket) {
    return NextResponse.json(
      { error: "R2_BUCKET not configured" },
      { status: 500 },
    );
  }

  const client = r2Client();
  try {
    const resp = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const body = resp.Body;
    if (!body) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const headers = new Headers();
    headers.set("Content-Type", resp.ContentType ?? inferContentType(key));
    if (resp.ContentLength !== undefined) {
      headers.set("Content-Length", String(resp.ContentLength));
    }
    headers.set("Cache-Control", "private, max-age=300");

    return new NextResponse(body as unknown as BodyInit, {
      status: 200,
      headers,
    });
  } catch (err) {
    const name = (err as { name?: string } | undefined)?.name;
    if (name === "NoSuchKey" || name === "NotFound") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    console.error("[r2] R2 fetch failed", err);
    return NextResponse.json({ error: "r2_error" }, { status: 502 });
  }
}
