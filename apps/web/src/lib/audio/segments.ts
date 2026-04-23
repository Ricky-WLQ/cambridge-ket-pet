import type { AudioSegment, AudioSegmentRecord } from "./types";

export interface ConcatEntry {
  segment: AudioSegment;
  durationMs: number;
}

export function computeSegmentRecords(entries: ConcatEntry[]): AudioSegmentRecord[] {
  const records: AudioSegmentRecord[] = [];
  let cursor = 0;
  for (const entry of entries) {
    const { segment, durationMs } = entry;
    records.push({
      id: segment.id,
      kind: segment.kind,
      voiceTag: segment.voiceTag,
      startMs: cursor,
      endMs: cursor + durationMs,
      questionId: segment.questionId,
      partNumber: segment.partNumber,
    });
    cursor += durationMs;
  }
  return records;
}
