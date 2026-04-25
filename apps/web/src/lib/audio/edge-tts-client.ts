import { EdgeTTS } from "node-edge-tts";

import type { VoiceTag } from "./types";
import { voiceNameFor } from "./voices";

export interface SynthesizeArgs {
  text: string;
  voiceTag: VoiceTag;
  ratePercent: number; // e.g., -5 for KET, 0 for PET
  outPath: string;
}

/**
 * Synthesize a single TTS segment to disk via Microsoft Edge TTS.
 *
 * Retries on transient failures are implemented in Task 20 via
 * `synthesizeSegmentWithRetry`.
 */
export async function synthesizeSegment(args: SynthesizeArgs): Promise<void> {
  const tts = new EdgeTTS({
    voice: voiceNameFor(args.voiceTag),
    lang: "en-GB",
    outputFormat: "audio-24khz-96kbitrate-mono-mp3",
    rate: `${args.ratePercent >= 0 ? "+" : ""}${args.ratePercent}%`,
    pitch: "default",
    volume: "default",
  });
  await tts.ttsPromise(args.text, args.outPath);
}

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 2000;

function isTransient(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as NodeJS.ErrnoException).code;
  const msg = (err as Error).message ?? "";
  return (
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    /ECONNRESET|WebSocket|socket hang up/i.test(msg)
  );
}

/**
 * Wrap `synthesizeSegment` with up to 3 attempts, retrying on transient
 * network errors (ECONNRESET/ETIMEDOUT/ECONNREFUSED, WebSocket, socket hang up)
 * with a 2s backoff between attempts. Non-transient errors throw immediately.
 */
export async function synthesizeSegmentWithRetry(
  args: SynthesizeArgs,
): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      await synthesizeSegment(args);
      return;
    } catch (err) {
      lastErr = err;
      if (!isTransient(err) || attempt === RETRY_MAX_ATTEMPTS) {
        break;
      }
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
    }
  }
  throw lastErr;
}
