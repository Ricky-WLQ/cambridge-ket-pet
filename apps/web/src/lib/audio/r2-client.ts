import * as fs from "node:fs";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

function bucket(): string {
  const v = process.env.R2_BUCKET;
  if (!v) throw new Error("R2_BUCKET env var is not set");
  return v;
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

export interface UploadArgs {
  testId: string;
  localPath: string;
}

/**
 * Upload a local audio file to Cloudflare R2 at key
 * `listening/{testId}/audio.mp3`. Retries once on failure with a 1.5s
 * backoff, then rethrows the last error.
 */
export async function uploadAudioToR2(args: UploadArgs): Promise<string> {
  const key = `listening/${args.testId}/audio.mp3`;
  const body = fs.readFileSync(args.localPath);
  const client = r2Client();

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
      return key;
    } catch (err) {
      lastErr = err;
      if (attempt === 2) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastErr;
}

export interface GetRangeArgs {
  r2Key: string;
  range?: string; // raw `Range` header value (e.g., "bytes=0-1023")
}

/**
 * Fetch an audio object (optionally range-requested) from R2. Returns the
 * streaming body plus the headers needed to forward a `206 Partial Content`
 * response.
 */
export async function getAudioStream(args: GetRangeArgs): Promise<{
  stream: ReadableStream<Uint8Array>;
  contentLength: number | undefined;
  contentRange: string | undefined;
  acceptRanges: string | undefined;
}> {
  const client = r2Client();
  const resp = await client.send(
    new GetObjectCommand({
      Bucket: bucket(),
      Key: args.r2Key,
      Range: args.range,
    }),
  );
  return {
    stream: resp.Body as unknown as ReadableStream<Uint8Array>,
    contentLength: resp.ContentLength,
    contentRange: resp.ContentRange,
    acceptRanges: resp.AcceptRanges,
  };
}

/**
 * Delete an audio object from R2. Used when a generation attempt needs to
 * be rolled back or a test is removed.
 */
export async function deleteAudio(r2Key: string): Promise<void> {
  const client = r2Client();
  await client.send(
    new DeleteObjectCommand({ Bucket: bucket(), Key: r2Key }),
  );
}
