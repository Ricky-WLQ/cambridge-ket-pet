import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "u1" } })),
}));

const send = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class { async send(...a: unknown[]) { return send(...a); } },
  GetObjectCommand: class { constructor(public input: unknown) {} },
}));

import { GET } from "../route";

beforeAll(() => {
  // Required by the route's R2 client wiring; the S3Client itself is mocked
  // above so the value doesn't have to be valid — just present.
  process.env.R2_BUCKET = "test-bucket";
  process.env.R2_ENDPOINT = "https://test.r2.example.com";
  process.env.R2_ACCESS_KEY_ID = "test-key";
  process.env.R2_SECRET_ACCESS_KEY = "test-secret";
});

beforeEach(() => { send.mockReset(); });

const mkReq = () => new Request("http://t/api/r2/whatever");
const mkCtx = (key: string[]) => ({ params: Promise.resolve({ key }) });

describe("GET /api/r2/[...key]", () => {
  it("returns 401 without session", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as unknown as { mockResolvedValueOnce: (v: unknown) => void }).mockResolvedValueOnce(null);
    const res = await GET(mkReq(), mkCtx(["foo.jpg"]));
    expect(res.status).toBe(401);
  });

  it("infers audio/mpeg for .mp3 keys", async () => {
    send.mockResolvedValue({ Body: { transformToWebStream: () => new ReadableStream() } });
    const res = await GET(mkReq(), mkCtx(["vocab", "en-GB-RyanNeural", "ket-act-v.mp3"]));
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
  });

  it("infers image/jpeg for .jpg keys (back-compat with speaking photos)", async () => {
    send.mockResolvedValue({ Body: { transformToWebStream: () => new ReadableStream() } });
    const res = await GET(mkReq(), mkCtx(["choice-club-01.jpg"]));
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
  });

  it("falls back to application/octet-stream for unknown extensions", async () => {
    send.mockResolvedValue({ Body: { transformToWebStream: () => new ReadableStream() } });
    const res = await GET(mkReq(), mkCtx(["foo.unknown"]));
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
  });
});
