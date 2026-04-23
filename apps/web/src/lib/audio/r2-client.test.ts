import { describe, expect, it, vi, beforeEach } from "vitest";

// Populate R2 env vars so bucket()/r2Client() return values during tests.
process.env.R2_BUCKET = "test-bucket";
process.env.R2_ENDPOINT = "https://test.r2.cloudflarestorage.com";
process.env.R2_ACCESS_KEY_ID = "test-key";
process.env.R2_SECRET_ACCESS_KEY = "test-secret";

const sendMock = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(function (this: { send: typeof sendMock }) {
    this.send = sendMock;
  }),
  PutObjectCommand: vi.fn(function (
    this: { __type: string; args: unknown },
    args: unknown,
  ) {
    this.__type = "Put";
    this.args = args;
  }),
  GetObjectCommand: vi.fn(function (
    this: { __type: string; args: unknown },
    args: unknown,
  ) {
    this.__type = "Get";
    this.args = args;
  }),
  DeleteObjectCommand: vi.fn(function (
    this: { __type: string; args: unknown },
    args: unknown,
  ) {
    this.__type = "Delete";
    this.args = args;
  }),
}));

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { uploadAudioToR2 } from "./r2-client";

describe("uploadAudioToR2", () => {
  const tmp = path.join(os.tmpdir(), "ket-pet-r2-test");
  const file = path.join(tmp, "audio.mp3");

  beforeEach(() => {
    sendMock.mockReset();
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });
    fs.writeFileSync(file, Buffer.from([0x49, 0x44, 0x33])); // ID3 stub
  });

  it("issues a PutObjectCommand with the expected key + content-type", async () => {
    sendMock.mockResolvedValue({});
    await uploadAudioToR2({ testId: "abc123", localPath: file });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0][0];
    expect(call.__type).toBe("Put");
    expect(call.args.Bucket).toBeDefined();
    expect(call.args.Key).toBe("listening/abc123/audio.mp3");
    expect(call.args.ContentType).toBe("audio/mpeg");
  });

  it("returns the R2 key on success", async () => {
    sendMock.mockResolvedValue({});
    const key = await uploadAudioToR2({ testId: "abc123", localPath: file });
    expect(key).toBe("listening/abc123/audio.mp3");
  });

  it("retries once on network failure then rethrows", async () => {
    sendMock
      .mockRejectedValueOnce(new Error("network"))
      .mockRejectedValueOnce(new Error("network"));
    await expect(
      uploadAudioToR2({ testId: "abc", localPath: file }),
    ).rejects.toThrow("network");
    expect(sendMock).toHaveBeenCalledTimes(2);
  }, 10000);
});
