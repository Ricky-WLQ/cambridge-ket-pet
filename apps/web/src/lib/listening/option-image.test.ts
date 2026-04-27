import { describe, it, expect, beforeEach, vi } from "vitest";

// We import the SUT lazily inside each test (after vi.mock setup) so the
// mocked AWS SDK module is what the helper sees. The helper's exports:
//   normalizeDescription(description) -> string
//   hashDescription(description)      -> string (16 hex chars)
//   ensureOptionImage(description)    -> Promise<string | null>

vi.mock("@aws-sdk/client-s3", () => {
  const sendMock = vi.fn();
  class S3Client {
    send = sendMock;
  }
  class HeadObjectCommand {
    constructor(public input: unknown) {}
  }
  class PutObjectCommand {
    constructor(public input: unknown) {}
  }
  return { S3Client, HeadObjectCommand, PutObjectCommand, __sendMock: sendMock };
});

vi.mock("sharp", () => {
  // sharp(buf).jpeg({...}).toBuffer() pipeline; mock returns a fixed JPEG buffer
  const toBuffer = vi.fn().mockResolvedValue(Buffer.from("FAKE-JPEG", "utf8"));
  const jpeg = vi.fn().mockReturnValue({ toBuffer });
  const factory = vi.fn(() => ({ jpeg }));
  return { default: factory, __jpegMock: jpeg, __toBufferMock: toBuffer };
});

const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.SILICONFLOW_API_KEY = "sk-fake-test-key";
  process.env.R2_ENDPOINT = "https://fake-account.r2.cloudflarestorage.com";
  process.env.R2_ACCESS_KEY_ID = "fake-access";
  process.env.R2_SECRET_ACCESS_KEY = "fake-secret";
  process.env.R2_BUCKET = "fake-bucket";
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

import { afterEach } from "vitest";

describe("normalizeDescription", () => {
  it("lowercases and trims", async () => {
    const { normalizeDescription } = await import("./option-image");
    expect(normalizeDescription("  A Box of EGGS  ")).toBe("a box of eggs");
  });
  it("collapses internal whitespace", async () => {
    const { normalizeDescription } = await import("./option-image");
    expect(normalizeDescription("box   of\teggs")).toBe("box of eggs");
  });
  it("returns empty string for empty input", async () => {
    const { normalizeDescription } = await import("./option-image");
    expect(normalizeDescription("")).toBe("");
    expect(normalizeDescription("   ")).toBe("");
  });
});

describe("hashDescription", () => {
  it("is deterministic — same input → same 16-char hex", async () => {
    const { hashDescription } = await import("./option-image");
    const a = hashDescription("box of eggs");
    const b = hashDescription("box of eggs");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });
  it("different normalized inputs → different hashes", async () => {
    const { hashDescription } = await import("./option-image");
    expect(hashDescription("box of eggs")).not.toBe(hashDescription("carton of milk"));
  });
  it("hashes the NORMALIZED form so case + whitespace differences collide", async () => {
    const { hashDescription } = await import("./option-image");
    // case + whitespace differences MUST collide — the AI prompt constrains
    // descriptions to be lowercase + no articles + no extra whitespace, so
    // normalization handles drift around case and spacing only.
    expect(hashDescription("  Box of EGGS  ")).toBe(hashDescription("box of eggs"));
    expect(hashDescription("BOX  of\teggs")).toBe(hashDescription("box of eggs"));
  });
});

describe("ensureOptionImage", () => {
  it("returns the R2 key on cache hit (HEAD succeeds, no SF call)", async () => {
    const sdk = await import("@aws-sdk/client-s3");
    const { __sendMock } = sdk as unknown as { __sendMock: ReturnType<typeof vi.fn> };
    __sendMock.mockResolvedValueOnce({}); // HEAD success
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const { ensureOptionImage, hashDescription } = await import("./option-image");
    const key = await ensureOptionImage("box of eggs");

    expect(key).toBe(`listening/options/${hashDescription("box of eggs")}.jpg`);
    expect(__sendMock).toHaveBeenCalledTimes(1); // HEAD only — no PUT
    expect(fetchMock).not.toHaveBeenCalled(); // no SF call
  });

  it("on cache miss, calls SF + uploads + returns key", async () => {
    const sdk = await import("@aws-sdk/client-s3");
    const { __sendMock } = sdk as unknown as { __sendMock: ReturnType<typeof vi.fn> };
    // First call (HEAD): 404
    __sendMock.mockRejectedValueOnce({ name: "NotFound", $metadata: { httpStatusCode: 404 } });
    // Second call (PUT): success
    __sendMock.mockResolvedValueOnce({});

    const fetchMock = vi
      .fn()
      // First fetch: SF /v1/images/generations
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ images: [{ url: "https://sf.example/img.png" }] }),
      })
      // Second fetch: download the PNG from the SF URL
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const { ensureOptionImage, hashDescription } = await import("./option-image");
    const key = await ensureOptionImage("red car");

    expect(key).toBe(`listening/options/${hashDescription("red car")}.jpg`);
    expect(__sendMock).toHaveBeenCalledTimes(2); // HEAD + PUT
    expect(fetchMock).toHaveBeenCalledTimes(2); // SF gen + download
    // SF was called with the right model + size
    const sfCallArgs = fetchMock.mock.calls[0];
    expect(sfCallArgs[0]).toBe("https://api.siliconflow.cn/v1/images/generations");
    const body = JSON.parse((sfCallArgs[1] as { body: string }).body);
    expect(body.model).toBe("Qwen/Qwen-Image");
    expect(body.image_size).toBe("1024x768");
    expect(body.prompt).toContain("red car");
  });

  it("returns null when SF returns non-OK status", async () => {
    const sdk = await import("@aws-sdk/client-s3");
    const { __sendMock } = sdk as unknown as { __sendMock: ReturnType<typeof vi.fn> };
    __sendMock.mockRejectedValueOnce({ name: "NotFound", $metadata: { httpStatusCode: 404 } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => "queue full" });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const { ensureOptionImage } = await import("./option-image");
    const key = await ensureOptionImage("rare object");
    expect(key).toBeNull();
  });

  it("returns null when SF response has no image URL", async () => {
    const sdk = await import("@aws-sdk/client-s3");
    const { __sendMock } = sdk as unknown as { __sendMock: ReturnType<typeof vi.fn> };
    __sendMock.mockRejectedValueOnce({ name: "NotFound", $metadata: { httpStatusCode: 404 } });
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const { ensureOptionImage } = await import("./option-image");
    const key = await ensureOptionImage("anything");
    expect(key).toBeNull();
  });

  it("returns null when image download fails", async () => {
    const sdk = await import("@aws-sdk/client-s3");
    const { __sendMock } = sdk as unknown as { __sendMock: ReturnType<typeof vi.fn> };
    __sendMock.mockRejectedValueOnce({ name: "NotFound", $metadata: { httpStatusCode: 404 } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ images: [{ url: "https://sf.example/img.png" }] }),
      })
      .mockResolvedValueOnce({ ok: false, status: 404 });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const { ensureOptionImage } = await import("./option-image");
    const key = await ensureOptionImage("anything");
    expect(key).toBeNull();
  });

  it("returns null for empty / blank descriptions (no SF call)", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const { ensureOptionImage } = await import("./option-image");
    expect(await ensureOptionImage("")).toBeNull();
    expect(await ensureOptionImage("   ")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
