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
