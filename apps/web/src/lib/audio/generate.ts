import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  buildFullPlan,
  buildConcatPlan,
  concatMp3s,
  generateSilenceMp3,
  probeDurationMs,
  type PlanEntry,
} from "./concat";
import { synthesizeSegmentWithRetry } from "./edge-tts-client";
import { uploadAudioToR2 } from "./r2-client";
import { computeSegmentRecords, type ConcatEntry } from "./segments";
import type {
  AudioSegment,
  AudioSegmentRecord,
  ListeningTestPayloadV2,
} from "./types";

export interface GenerateArgs {
  testId: string;
  payload: ListeningTestPayloadV2;
  ratePercent: number; // -5 for KET, 0 for PET
}

export interface GenerateResult {
  r2Key: string;
  segments: AudioSegmentRecord[];
}

export async function generateListeningAudio(args: GenerateArgs): Promise<GenerateResult> {
  const { testId, payload, ratePercent } = args;
  const workDir = path.join(os.tmpdir(), `ket-pet-audio-${testId}-${Date.now()}`);
  fs.mkdirSync(workDir, { recursive: true });

  try {
    // 1. Build full plan (scope-aware: FULL uses buildFullPlan, PART uses buildConcatPlan)
    let plan: PlanEntry[];
    if (payload.scope === "FULL") {
      plan = buildFullPlan(payload);
    } else {
      // PART scope — just the part's concat plan (no opening rubric or transfer block)
      plan = buildConcatPlan(payload.parts[0], payload.examType);
    }

    // 2. For each entry, produce a file on disk (synthesized TTS or silence)
    const filePaths: string[] = [];
    const concatEntries: ConcatEntry[] = [];

    for (let i = 0; i < plan.length; i++) {
      const entry = plan[i];
      const filePath = path.join(workDir, `seg-${String(i).padStart(4, "0")}.mp3`);

      if (entry.kind === "pause" || entry.kind === "preview_pause") {
        const durSec = Math.max(0.1, (entry.durationMs ?? 0) / 1000);
        await generateSilenceMp3(durSec, filePath);
      } else {
        if (!entry.text || entry.voiceTag == null) {
          throw new Error(
            `Plan entry ${entry.id} of kind ${entry.kind} missing text or voiceTag`,
          );
        }
        await synthesizeSegmentWithRetry({
          text: entry.text,
          voiceTag: entry.voiceTag,
          ratePercent,
          outPath: filePath,
        });
      }

      filePaths.push(filePath);

      // Record actual duration for timestamping
      const dur = await probeDurationMs(filePath);
      const seg: AudioSegment = {
        id: entry.id,
        kind: entry.kind,
        voiceTag: entry.voiceTag ?? null,
        questionId: entry.questionId,
        partNumber: entry.partNumber,
      };
      concatEntries.push({ segment: seg, durationMs: dur });
    }

    // 3. Concatenate all files into a single mp3
    const outputMp3 = path.join(workDir, "listening.mp3");
    await concatMp3s(filePaths, outputMp3);

    // 4. Upload to R2
    const r2Key = await uploadAudioToR2({ testId, localPath: outputMp3 });

    // 5. Compute timestamp records
    const segments = computeSegmentRecords(concatEntries);

    return { r2Key, segments };
  } finally {
    // Cleanup temp dir (ignore errors)
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}
