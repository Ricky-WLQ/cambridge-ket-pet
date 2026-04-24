import "server-only";

import type { TranscriptTurn } from "./transcript-reconciler";

export interface SpeakingScoreResult {
  grammarVocab: number;
  discourseManagement: number;
  pronunciation: number;
  interactive: number;
  overall: number;
  justification: string;
  weakPoints: Array<{ tag: string; quote: string; suggestion: string }>;
}

export async function scoreSpeakingAttempt(args: {
  level: "KET" | "PET";
  transcript: TranscriptTurn[];
}): Promise<SpeakingScoreResult> {
  const base = process.env.INTERNAL_AI_URL;
  if (!base) throw new Error("Missing INTERNAL_AI_URL env");

  const res = await fetch(`${base}/speaking/score`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.INTERNAL_AI_SHARED_SECRET ?? ""}`,
    },
    body: JSON.stringify({
      level: args.level,
      transcript: args.transcript.map((t) => ({
        role: t.role,
        content: t.content,
        part: t.part,
      })),
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`speaking/score HTTP ${res.status}`);
  }
  return (await res.json()) as SpeakingScoreResult;
}
