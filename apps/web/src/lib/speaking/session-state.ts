/**
 * Shared (server + client) sentinel parser for Phase 3 Speaking.
 * Keeps `[[PART:N]]` + `[[SESSION_END]]` semantics identical to the
 * Python validator in services/ai/app/validators/speaking.py.
 */

export class SentinelParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SentinelParseError";
  }
}

export interface ParsedExaminerOutput {
  reply: string;
  advancePart: number | null;
  sessionEnd: boolean;
}

const PART_RE = /\[\[PART:(\d+)\]\]/g;
// Permissive companion of PART_RE — catches tokens like `[[PART:abc]]` or
// `[[PART:2.5]]` so we can reject them explicitly instead of silently
// leaking the malformed sentinel into the avatar's speech.
const PART_LOOSE_RE = /\[\[PART:[^\]]*\]\]/g;
const END_RE = /\[\[SESSION_END\]\]/g;

export function parseExaminerOutput(
  raw: string,
  opts: { currentPart: number; lastPart: number },
): ParsedExaminerOutput {
  const { currentPart, lastPart } = opts;

  const looseTokens = [...raw.matchAll(PART_LOOSE_RE)].map((m) => m[0]);
  const strictMatches = [...raw.matchAll(PART_RE)];

  // Fix 2: any loose match that isn't also a strict match is malformed —
  // surface it rather than silently leaking the sentinel downstream.
  if (looseTokens.length !== strictMatches.length) {
    const strictTokens = new Set(strictMatches.map((m) => m[0]));
    const bad = looseTokens.find((t) => !strictTokens.has(t));
    throw new SentinelParseError(
      `malformed [[PART:…]] sentinel: ${bad ?? "(unknown)"}`,
    );
  }

  // Fix 1: more than one valid sentinel in a single reply is a conflict.
  if (strictMatches.length > 1) {
    const nums = strictMatches.map((m) => m[1]);
    throw new SentinelParseError(
      `multiple [[PART:N]] sentinels in one reply: [${nums.join(", ")}]`,
    );
  }

  let advancePart: number | null = null;
  if (strictMatches.length === 1) {
    const n = Number(strictMatches[0][1]);
    if (n <= currentPart) {
      throw new SentinelParseError(
        `[[PART:${n}]] is not ahead of currentPart ${currentPart}`,
      );
    }
    if (n > lastPart) {
      throw new SentinelParseError(
        `[[PART:${n}]] exceeds lastPart ${lastPart}`,
      );
    }
    advancePart = n;
  }

  const sessionEnd = END_RE.test(raw);
  // Reset lastIndex after the .test()
  END_RE.lastIndex = 0;

  // Fix 3: substitute a space (not empty) so sentinels adjacent to words
  // don't weld tokens together (e.g. "Thank[[SESSION_END]]you" → "Thank you").
  // The \s{2,} collapse below normalises any double spaces we create here.
  let reply = raw.replace(PART_RE, " ").replace(END_RE, " ");
  reply = reply.replace(/\s{2,}/g, " ").trim();

  if (!reply) {
    throw new SentinelParseError("reply was empty after stripping sentinels");
  }

  return { reply, advancePart, sessionEnd };
}
