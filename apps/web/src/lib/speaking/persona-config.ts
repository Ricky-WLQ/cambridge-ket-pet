/**
 * Human-readable summary of the Mina persona for the current attempt.
 * Shown to students in the pre-flight UI and bundled in logs.
 * NB: the actual examiner system prompt lives in Python
 * (services/ai/app/prompts/speaking_examiner_system.py). This file just
 * renders a short client-facing blurb.
 */

export interface PersonaSummaryInput {
  level: "KET" | "PET";
  initialGreeting: string;
  partCount: number;
}

export function buildPersonaSummary(input: PersonaSummaryInput): string {
  return `Mina — a British Cambridge ${input.level} examiner (practice mode, light coaching). `
    + `Today's session has ${input.partCount} parts. `
    + `She'll open with: "${input.initialGreeting}"`;
}
