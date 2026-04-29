/**
 * Banned phrases for any Chinese text shown to users (AI-generated or static).
 * Mirrored from services/ai/app/validators/_banned_phrases.py — KEEP THE TWO
 * LISTS IN SYNC.
 */
export const BANNED_PHRASES = [
  "决定通过率",
  "属于低分段",
  "未达标",
  "短板",
  "critical 弱项",
  "moderate 弱项",
  "minor 弱项",
  "请重视",
  "切记",
  "不容忽视",
  "亟待提升",
  "[critical]",
  "[moderate]",
  "[minor]",
] as const;

export function findBanned(text: string): string[] {
  return BANNED_PHRASES.filter((p) => text.includes(p));
}
