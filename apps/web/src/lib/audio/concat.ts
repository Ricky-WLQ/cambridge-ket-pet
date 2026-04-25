import * as fs from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { PAUSE_SEC } from "./constants";
import { RUBRIC } from "./rubric";
import type { AudioSegment, ListeningPart, ListeningTestPayloadV2 } from "./types";

function resolveFfmpeg(): string {
  const override = process.env.FFMPEG_BINARY;
  if (override && override !== "auto") return override;
  if (!ffmpegPath) throw new Error("ffmpeg-static did not provide a binary path");
  return ffmpegPath;
}

/**
 * Probe an audio file's duration in milliseconds.
 *
 * Uses `ffmpeg -hide_banner -i <file> -f null -` — ffmpeg prints the
 * file info (including Duration) to stderr then exits non-zero (because
 * no output target is specified). We parse the Duration: HH:MM:SS.xx
 * line from stderr regardless of the exit code.
 *
 * This keeps ffmpeg-static as the only binary dependency — no ffprobe
 * required.
 */
export function probeDurationMs(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    execFile(
      resolveFfmpeg(),
      ["-hide_banner", "-i", filePath, "-f", "null", "-"],
      (err, _stdout, stderr) => {
        const m = /Duration: (\d{2}):(\d{2}):(\d{2}\.\d+)/.exec(String(stderr ?? ""));
        if (m) {
          const hours = parseInt(m[1], 10);
          const mins = parseInt(m[2], 10);
          const secs = parseFloat(m[3]);
          resolve(Math.round((hours * 3600 + mins * 60 + secs) * 1000));
          return;
        }
        reject(
          err ??
            new Error(`Could not parse duration from ffmpeg stderr: ${stderr}`)
        );
      }
    );
  });
}

/**
 * Generate a silent mp3 of the requested duration and save to `outPath`.
 */
export function generateSilenceMp3(durationSec: number, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      resolveFfmpeg(),
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        `anullsrc=r=24000:cl=mono`,
        "-t",
        String(durationSec),
        "-q:a",
        "9",
        "-acodec",
        "libmp3lame",
        outPath,
      ],
      (err) => (err ? reject(err) : resolve()),
    );
  });
}

/**
 * Concatenate a list of mp3 files into a single mp3 using ffmpeg's
 * concat demuxer.
 */
export function concatMp3s(inputPaths: string[], outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const listPath = path.join(path.dirname(outPath), `concat-${Date.now()}.txt`);
    const manifest = inputPaths
      .map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
      .join("\n");
    fs.writeFileSync(listPath, manifest, "utf-8");

    execFile(
      resolveFfmpeg(),
      ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath],
      (err) => {
        try {
          fs.rmSync(listPath, { force: true });
        } catch {
          /* ignore cleanup */
        }
        if (err) reject(err);
        else resolve();
      },
    );
  });
}

export interface PlanEntry {
  kind: AudioSegment["kind"];
  segment?: AudioSegment;
  text?: string; // for synthesized speech (rubric + part_intro + repeat_cue + part_end + transfer etc.)
  voiceTag?: AudioSegment["voiceTag"];
  durationMs?: number; // for silence entries
  id: string;
  questionId?: string;
  partNumber?: number;
}

/**
 * Build a full concat plan for a single part, applying its play_rule.
 *
 * The agent emits a SINGLE logical pass in `audioScript`; this function
 * applies PER_ITEM or PER_PART duplication and injects Cambridge-spec pauses.
 */
export function buildConcatPlan(part: ListeningPart, _examType: "KET" | "PET"): PlanEntry[] {
  const entries: PlanEntry[] = [];
  const previewMs = part.previewSec * 1000;

  entries.push({
    id: `part${part.partNumber}_preview_pause`,
    kind: "preview_pause",
    durationMs: previewMs,
  });

  if (part.playRule === "PER_ITEM") {
    // Group audioScript segments by questionId; segments without a questionId
    // (e.g. "Question N" markers) attach to the NEXT questionId group that follows.
    const groups = new Map<string, AudioSegment[]>();
    const orderedKeys: string[] = [];
    const pending: AudioSegment[] = [];
    for (const seg of part.audioScript) {
      if (!seg.questionId) {
        pending.push(seg);
        continue;
      }
      const key = seg.questionId;
      if (!groups.has(key)) {
        groups.set(key, []);
        orderedKeys.push(key);
      }
      const bucket = groups.get(key)!;
      if (pending.length > 0) {
        bucket.push(...pending);
        pending.length = 0;
      }
      bucket.push(seg);
    }
    if (pending.length > 0) {
      // Any trailing un-tagged segments go into a final ungrouped bucket
      const key = "__ungrouped__";
      groups.set(key, pending.slice());
      orderedKeys.push(key);
    }
    for (const qid of orderedKeys) {
      const segs = groups.get(qid)!;
      const push = () => {
        for (const seg of segs) {
          entries.push({
            id: seg.id,
            kind: seg.kind,
            segment: seg,
            text: seg.text,
            voiceTag: seg.voiceTag,
            questionId: seg.questionId,
            partNumber: part.partNumber,
          });
        }
      };
      push();
      entries.push({
        id: `${qid}_pre_repeat`,
        kind: "pause",
        durationMs: PAUSE_SEC.BEFORE_REPEAT * 1000,
      });
      entries.push({
        id: `${qid}_repeat_cue`,
        kind: "repeat_cue",
        text: "Now listen again.",
        voiceTag: "proctor",
        partNumber: part.partNumber,
      });
      entries.push({
        id: `${qid}_post_cue`,
        kind: "pause",
        durationMs: PAUSE_SEC.BEFORE_REPEAT * 1000,
      });
      push();
      entries.push({
        id: `${qid}_between_items`,
        kind: "pause",
        durationMs: PAUSE_SEC.BETWEEN_ITEMS * 1000,
      });
    }
  } else {
    // PER_PART: emit all segments, pause, repeat_cue, pause, emit all segments again
    const push = () => {
      for (const seg of part.audioScript) {
        entries.push({
          id: seg.id,
          kind: seg.kind,
          segment: seg,
          text: seg.text,
          voiceTag: seg.voiceTag,
          questionId: seg.questionId,
          partNumber: part.partNumber,
        });
      }
    };
    push();
    entries.push({
      id: `part${part.partNumber}_pre_repeat`,
      kind: "pause",
      durationMs: PAUSE_SEC.BEFORE_REPEAT * 1000,
    });
    entries.push({
      id: `part${part.partNumber}_repeat_cue`,
      kind: "repeat_cue",
      text: "Now listen again.",
      voiceTag: "proctor",
      partNumber: part.partNumber,
    });
    entries.push({
      id: `part${part.partNumber}_post_cue`,
      kind: "pause",
      durationMs: PAUSE_SEC.BEFORE_REPEAT * 1000,
    });
    push();
  }

  return entries;
}

/**
 * Build the full concat plan for an entire listening paper: opening rubric,
 * per-part intro + body (via buildConcatPlan) + part_end with inter-part
 * pauses, and the transfer block (transfer_start → 5-min pause →
 * transfer_one_min → 1-min pause → closing).
 */
export function buildFullPlan(payload: ListeningTestPayloadV2): PlanEntry[] {
  const entries: PlanEntry[] = [];
  const rubric = payload.examType === "KET" ? RUBRIC.ket : RUBRIC.pet;

  entries.push({
    id: "opening",
    kind: "rubric",
    text: rubric.opening,
    voiceTag: "proctor",
  });
  entries.push({
    id: "post_opening",
    kind: "pause",
    durationMs: PAUSE_SEC.PRE_PART_INSTRUCTION * 1000,
  });

  for (let i = 0; i < payload.parts.length; i++) {
    const part = payload.parts[i];
    // Part intro (except for final: we still say "Now look at the instructions for Part N")
    entries.push({
      id: `part${part.partNumber}_intro`,
      kind: "part_intro",
      text: rubric.partIntro(part.partNumber),
      voiceTag: "proctor",
      partNumber: part.partNumber,
    });
    // Body
    const partPlan = buildConcatPlan(part, payload.examType);
    entries.push(...partPlan);
    // Part end
    entries.push({
      id: `part${part.partNumber}_end`,
      kind: "part_end",
      text: rubric.partEnd(part.partNumber),
      voiceTag: "proctor",
      partNumber: part.partNumber,
    });
    // Inter-part pause (except after the last part — then we do transfer block)
    if (i < payload.parts.length - 1) {
      entries.push({
        id: `inter_part_${i}`,
        kind: "pause",
        durationMs: PAUSE_SEC.INTER_PART * 1000,
      });
    }
  }

  // Transfer block
  entries.push({
    id: "transfer_start",
    kind: "transfer_start",
    text: rubric.transferStart,
    voiceTag: "proctor",
  });
  entries.push({
    id: "transfer_preamble_pause",
    kind: "pause",
    durationMs: PAUSE_SEC.TRANSFER_BLOCK_PREAMBLE * 1000,
  });
  entries.push({
    id: "transfer_one_min",
    kind: "transfer_one_min",
    text: rubric.oneMinuteWarn,
    voiceTag: "proctor",
  });
  entries.push({
    id: "transfer_final_pause",
    kind: "pause",
    durationMs: PAUSE_SEC.TRANSFER_BLOCK_FINAL * 1000,
  });
  entries.push({
    id: "closing",
    kind: "closing",
    text: rubric.closing,
    voiceTag: "proctor",
  });

  return entries;
}
