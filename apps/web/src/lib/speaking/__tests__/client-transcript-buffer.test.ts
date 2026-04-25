import { describe, it, expect } from "vitest";
import { createClientTranscriptBuffer } from "../client-transcript-buffer";

describe("client-transcript-buffer", () => {
  it("captures user + bot turns with current part", () => {
    const buf = createClientTranscriptBuffer();
    buf.setCurrentPart(1);
    buf.captureStreamMessage({
      v: 2, type: "chat", fin: true, idx: 0,
      pld: { from: "user", text: "hello" },
    });
    buf.captureStreamMessage({
      v: 2, type: "chat", fin: true, idx: 0,
      pld: { from: "bot", text: "hi there" },
    });
    const turns = buf.snapshot();
    expect(turns).toHaveLength(2);
    expect(turns[0].role).toBe("user");
    expect(turns[1].role).toBe("assistant");
    expect(turns[0].source).toBe("akool_stt");
  });

  it("ignores non-fin messages (chunked mid-stream)", () => {
    const buf = createClientTranscriptBuffer();
    buf.setCurrentPart(1);
    buf.captureStreamMessage({
      v: 2, type: "chat", fin: false, idx: 0,
      pld: { from: "bot", text: "partial" },
    });
    expect(buf.snapshot()).toHaveLength(0);
  });

  it("ignores non-chat types (commands)", () => {
    const buf = createClientTranscriptBuffer();
    buf.setCurrentPart(1);
    buf.captureStreamMessage({
      v: 2, type: "command", pld: { cmd: "set-params", code: 1000 },
    });
    expect(buf.snapshot()).toHaveLength(0);
  });
});
