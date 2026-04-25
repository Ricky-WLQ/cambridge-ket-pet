import { describe, it, expect } from "vitest";
import {
  reconcileTranscript,
  type ClientTranscriptTurn,
} from "../transcript-reconciler";
import type { BufferedTurn } from "../turn-buffer";

describe("reconcileTranscript", () => {
  it("converts the server buffer into a {user, assistant} sequence", () => {
    const server: BufferedTurn[] = [
      { userText: "hi", replyText: "hello", partNumber: 1, ts: "2026-04-25T10:00:00Z" },
      { userText: "I live in Beijing", replyText: "nice", partNumber: 1, ts: "2026-04-25T10:00:05Z" },
    ];
    const client: ClientTranscriptTurn[] = [];
    const out = reconcileTranscript({ serverBuffer: server, clientBuffer: client });
    expect(out).toEqual([
      { role: "user", content: "hi", part: 1, ts: "2026-04-25T10:00:00Z", source: "server" },
      { role: "assistant", content: "hello", part: 1, ts: "2026-04-25T10:00:00Z", source: "server" },
      { role: "user", content: "I live in Beijing", part: 1, ts: "2026-04-25T10:00:05Z", source: "server" },
      { role: "assistant", content: "nice", part: 1, ts: "2026-04-25T10:00:05Z", source: "server" },
    ]);
  });

  it("appends a trailing user turn from client buffer when server buffer is shorter", () => {
    const server: BufferedTurn[] = [
      { userText: "hi", replyText: "hello", partNumber: 1, ts: "2026-04-25T10:00:00Z" },
    ];
    const client: ClientTranscriptTurn[] = [
      { role: "user", content: "hi", part: 1, ts: "2026-04-25T10:00:00Z", source: "akool_stt" },
      { role: "assistant", content: "hello", part: 1, ts: "2026-04-25T10:00:01Z", source: "akool_stt" },
      { role: "user", content: "I live in Beijing", part: 1, ts: "2026-04-25T10:00:05Z", source: "akool_stt" },
    ];
    const out = reconcileTranscript({ serverBuffer: server, clientBuffer: client });

    // First two entries come from server; last user turn from client backup.
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ role: "user", content: "hi", source: "server" });
    expect(out[1]).toMatchObject({ role: "assistant", content: "hello", source: "server" });
    expect(out[2]).toMatchObject({
      role: "user",
      content: "I live in Beijing",
      source: "client_fallback",
    });
  });

  it("falls back to client buffer entirely when server buffer is empty", () => {
    const server: BufferedTurn[] = [];
    const client: ClientTranscriptTurn[] = [
      { role: "user", content: "hi", part: 1, ts: "2026-04-25T10:00:00Z", source: "akool_stt" },
      { role: "assistant", content: "hello", part: 1, ts: "2026-04-25T10:00:01Z", source: "akool_stt" },
    ];
    const out = reconcileTranscript({ serverBuffer: server, clientBuffer: client });
    expect(out).toHaveLength(2);
    expect(out.every((t) => t.source === "client_fallback")).toBe(true);
  });

  it("returns an empty array when both are empty", () => {
    expect(
      reconcileTranscript({ serverBuffer: [], clientBuffer: [] }),
    ).toEqual([]);
  });
});
