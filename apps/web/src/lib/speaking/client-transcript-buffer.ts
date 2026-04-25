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
      // ECHO FILTER: Akool's avatar TTS-es user STT verbatim ~10ms after
      // STT (the same bug we cancel via `interrupt` in the runner). The
      // echo arrives as `from: "bot"` with identical text. We must NOT
      // log it as an assistant turn — that would corrupt the transcript
      // sent to the scorer (Mina would appear to say the candidate's
      // words back). Drop any bot message whose text equals the most
      // recent user turn.
      if (from === "bot" && turns.length > 0) {
        const last = turns[turns.length - 1];
        if (last.role === "user" && last.content === text) return;
      }
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
