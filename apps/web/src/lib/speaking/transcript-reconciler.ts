import type { BufferedTurn } from "./turn-buffer";

export type TranscriptSource = "server" | "akool_stt" | "client_fallback";

export interface TranscriptTurn {
  role: "user" | "assistant";
  content: string;
  part: number;
  ts: string;
  source: TranscriptSource;
}

export interface ClientTranscriptTurn {
  role: "user" | "assistant";
  content: string;
  part: number;
  ts: string;
  source: Exclude<TranscriptSource, "server">; // client only sees akool_stt or client_fallback
}

export function reconcileTranscript(args: {
  serverBuffer: BufferedTurn[];
  clientBuffer: ClientTranscriptTurn[];
}): TranscriptTurn[] {
  const { serverBuffer, clientBuffer } = args;

  const fromServer: TranscriptTurn[] = [];
  for (const turn of serverBuffer) {
    fromServer.push({
      role: "user",
      content: turn.userText,
      part: turn.partNumber,
      ts: turn.ts,
      source: "server",
    });
    fromServer.push({
      role: "assistant",
      content: turn.replyText,
      part: turn.partNumber,
      ts: turn.ts,
      source: "server",
    });
  }

  if (fromServer.length === 0) {
    return clientBuffer.map((t) => ({
      role: t.role,
      content: t.content,
      part: t.part,
      ts: t.ts,
      source: "client_fallback" as const,
    }));
  }

  // Append any client turns not already represented server-side.
  // Strategy: if client buffer has N entries and server has exactly N
  // user turns represented, we return server as-is. If client has more,
  // the tail entries are the gap.
  const serverUserCount = serverBuffer.length;
  const clientUserCount = clientBuffer.filter((t) => t.role === "user").length;

  if (clientUserCount <= serverUserCount) {
    return fromServer;
  }

  // Otherwise append trailing client turns beyond what the server saw.
  const tail: TranscriptTurn[] = [];
  let seenUsers = 0;
  for (const t of clientBuffer) {
    if (t.role === "user") {
      seenUsers += 1;
      if (seenUsers <= serverUserCount) continue;
    } else {
      // An assistant turn only "counts" if its preceding user was beyond
      // the server's view. Keep it too.
      if (seenUsers <= serverUserCount) continue;
    }
    tail.push({
      role: t.role,
      content: t.content,
      part: t.part,
      ts: t.ts,
      source: "client_fallback",
    });
  }

  return [...fromServer, ...tail];
}
