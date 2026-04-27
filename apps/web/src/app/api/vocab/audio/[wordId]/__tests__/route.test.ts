import { describe, expect, it, vi, beforeEach } from "vitest";
import { GET } from "../route";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "u1" } })),
}));
const findUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { word: { findUnique: (...a: unknown[]) => findUnique(...a) } },
}));
const sign = vi.fn();
vi.mock("@/lib/vocab/audio-url", () => ({
  vocabAudioSignedUrl: (...a: unknown[]) => sign(...a),
}));

beforeEach(() => {
  findUnique.mockReset();
  sign.mockReset();
});

const mkReq = () => new Request("http://t/api/vocab/audio/wid");
const mkCtx = (wordId: string) => ({ params: Promise.resolve({ wordId }) });

describe("GET /api/vocab/audio/[wordId]", () => {
  it("returns 401 without session", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as unknown as { mockResolvedValueOnce: (v: unknown) => void }).mockResolvedValueOnce(null);
    const res = await GET(mkReq(), mkCtx("w1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 if word not found", async () => {
    findUnique.mockResolvedValue(null);
    const res = await GET(mkReq(), mkCtx("w1"));
    expect(res.status).toBe(404);
  });

  it("returns 404 if word has no audioKey", async () => {
    findUnique.mockResolvedValue({ id: "w1", audioKey: null });
    const res = await GET(mkReq(), mkCtx("w1"));
    expect(res.status).toBe(404);
  });

  it("redirects (302) to signed URL when audioKey present", async () => {
    findUnique.mockResolvedValue({ id: "w1", audioKey: "vocab/en-GB-RyanNeural/ket-act-v.mp3" });
    sign.mockResolvedValue("/api/r2/vocab/en-GB-RyanNeural/ket-act-v.mp3");
    const res = await GET(mkReq(), mkCtx("w1"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/api/r2/vocab/en-GB-RyanNeural/ket-act-v.mp3");
    expect(res.headers.get("cache-control")).toContain("private");
  });

  // The Location is intentionally server-relative — see the route's docstring
  // for why (Zeabur's edge proxy doesn't preserve the public Host header, so
  // `new URL(path, request.url)` would emit `http://localhost:8080/...`).
  it("emits a server-relative Location, never an absolute URL with the inner socket host", async () => {
    findUnique.mockResolvedValue({ id: "w1", audioKey: "vocab/S1_male/ket-actor-n.mp3" });
    sign.mockResolvedValue("/api/r2/vocab/S1_male/ket-actor-n.mp3");
    // Simulate Next.js seeing the inner socket as `request.url` on Zeabur.
    const innerSocketReq = new Request("http://localhost:8080/api/vocab/audio/wid");
    const res = await GET(innerSocketReq, mkCtx("w1"));
    expect(res.status).toBe(302);
    const location = res.headers.get("location");
    expect(location).toBe("/api/r2/vocab/S1_male/ket-actor-n.mp3");
    expect(location).not.toMatch(/^https?:\/\//);
    expect(location).not.toContain("localhost:8080");
  });
});
