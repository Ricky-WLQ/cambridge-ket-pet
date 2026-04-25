import "server-only";

export interface BufferedTurn {
  userText: string;
  replyText: string;
  partNumber: number;
  ts: string; // ISO-8601
}

// Process-local. Intentionally volatile: if the Next.js process recycles
// mid-session we fall through to the client transcript backup at submit.
const buffers = new Map<string, BufferedTurn[]>();

export function appendTurn(attemptId: string, turn: BufferedTurn): void {
  const list = buffers.get(attemptId);
  if (list) list.push(turn);
  else buffers.set(attemptId, [turn]);
}

export function readTurns(attemptId: string): BufferedTurn[] {
  return buffers.get(attemptId)?.slice() ?? [];
}

export function clearTurns(attemptId: string): void {
  buffers.delete(attemptId);
}

/** Test hook — resets all in-memory buffers. */
export function __resetAllBuffers(): void {
  buffers.clear();
}
