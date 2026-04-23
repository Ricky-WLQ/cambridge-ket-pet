import { describe, expect, it, vi } from "vitest";

const execFileMock = vi.fn();
vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => execFileMock(...args),
}));
vi.mock("ffmpeg-static", () => ({ default: "/path/to/ffmpeg" }));

import { probeDurationMs } from "./concat";

describe("probeDurationMs", () => {
  it("parses ffprobe duration output (e.g., '5.432')", async () => {
    execFileMock.mockImplementation((_bin: string, _args: string[], cb: (e: Error | null, stdout: string) => void) => {
      cb(null, "5.432\n");
    });
    const ms = await probeDurationMs("/tmp/fake.mp3");
    expect(ms).toBe(5432);
  });

  it("rounds fractional ms", async () => {
    execFileMock.mockImplementation((_bin: string, _args: string[], cb: (e: Error | null, stdout: string) => void) => {
      cb(null, "2.0017\n");
    });
    const ms = await probeDurationMs("/tmp/fake.mp3");
    expect(ms).toBe(2002);
  });
});
