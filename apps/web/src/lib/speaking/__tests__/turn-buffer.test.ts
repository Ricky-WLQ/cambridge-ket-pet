import { describe, it, expect, beforeEach } from "vitest";
import {
  appendTurn,
  readTurns,
  clearTurns,
  __resetAllBuffers,
} from "../turn-buffer";

beforeEach(() => {
  __resetAllBuffers();
});

describe("turn-buffer", () => {
  it("starts empty for an unknown attempt", () => {
    expect(readTurns("attempt-1")).toEqual([]);
  });

  it("appends turns in arrival order", () => {
    appendTurn("attempt-1", {
      userText: "hi",
      replyText: "hello",
      partNumber: 1,
      ts: "2026-04-25T10:00:00Z",
    });
    appendTurn("attempt-1", {
      userText: "I live in Beijing",
      replyText: "nice",
      partNumber: 1,
      ts: "2026-04-25T10:00:05Z",
    });
    const turns = readTurns("attempt-1");
    expect(turns).toHaveLength(2);
    expect(turns[0].userText).toBe("hi");
    expect(turns[1].replyText).toBe("nice");
  });

  it("keeps separate buffers per attempt", () => {
    appendTurn("a", { userText: "u", replyText: "r", partNumber: 1, ts: "t" });
    appendTurn("b", { userText: "u2", replyText: "r2", partNumber: 1, ts: "t2" });
    expect(readTurns("a")).toHaveLength(1);
    expect(readTurns("b")).toHaveLength(1);
  });

  it("clearTurns drops the attempt's buffer", () => {
    appendTurn("a", { userText: "u", replyText: "r", partNumber: 1, ts: "t" });
    clearTurns("a");
    expect(readTurns("a")).toEqual([]);
  });
});
