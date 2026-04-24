"use client";

import type { StreamMessage } from "./trtc-client";
import type { ClientTranscriptTurn } from "./transcript-reconciler";

export interface ClientTranscriptBuffer {
  setCurrentPart(part: number): void;
  captureStreamMessage(msg: StreamMessage): void;
  snapshot(): ClientTranscriptTurn[];
  clear(): void;
}

export function createClientTranscriptBuffer(): ClientTranscriptBuffer {
  let currentPart = 1;
  const turns: ClientTranscriptTurn[] = [];

  return {
    setCurrentPart(part) {
      currentPart = part;
    },
    captureStreamMessage(msg) {
      if (msg.type !== "chat" || !msg.fin) return;
      const text = msg.pld.text;
      if (!text) return;
      const from = msg.pld.from;
      if (from !== "user" && from !== "bot") return;
      turns.push({
        role: from === "user" ? "user" : "assistant",
        content: text,
        part: currentPart,
        ts: new Date().toISOString(),
        source: "akool_stt",
      });
    },
    snapshot() {
      return turns.slice();
    },
    clear() {
      turns.length = 0;
    },
  };
}
