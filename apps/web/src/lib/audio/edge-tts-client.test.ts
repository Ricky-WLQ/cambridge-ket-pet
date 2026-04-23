import { describe, expect, it, vi, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const ttsPromiseMock = vi.fn();
vi.mock("node-edge-tts", () => ({
  EdgeTTS: vi.fn(function (this: { ttsPromise: typeof ttsPromiseMock }) {
    this.ttsPromise = ttsPromiseMock;
  }),
}));

import { synthesizeSegment } from "./edge-tts-client";

describe("synthesizeSegment", () => {
  const tmp = path.join(os.tmpdir(), "ket-pet-tts-test");

  beforeEach(() => {
    ttsPromiseMock.mockReset();
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });
  });

  it("calls node-edge-tts with the mapped voice for voiceTag", async () => {
    ttsPromiseMock.mockResolvedValue(undefined);
    const outPath = path.join(tmp, "seg1.mp3");

    await synthesizeSegment({
      text: "Hello.",
      voiceTag: "proctor",
      ratePercent: 0,
      outPath,
    });

    expect(ttsPromiseMock).toHaveBeenCalledTimes(1);
    expect(ttsPromiseMock).toHaveBeenCalledWith("Hello.", outPath);
  });

  it("rejects if synthesis throws", async () => {
    ttsPromiseMock.mockRejectedValue(new Error("ECONNRESET"));
    await expect(
      synthesizeSegment({
        text: "Hello.",
        voiceTag: "proctor",
        ratePercent: 0,
        outPath: path.join(tmp, "seg2.mp3"),
      })
    ).rejects.toThrow("ECONNRESET");
  });
});
