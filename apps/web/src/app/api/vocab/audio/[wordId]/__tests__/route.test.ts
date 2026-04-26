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
    sign.mockResolvedValue("https://r2.example/signed?x=1");
    const res = await GET(mkReq(), mkCtx("w1"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://r2.example/signed?x=1");
    expect(res.headers.get("cache-control")).toContain("private");
  });

  it("resolves relative signed URLs against request origin (NextResponse.redirect requires absolute)", async () => {
    findUnique.mockResolvedValue({ id: "w1", audioKey: "vocab/S1_male/ket-actor-n.mp3" });
    sign.mockResolvedValue("/api/r2/vocab/S1_male/ket-actor-n.mp3");  // server-relative, like signR2PublicUrl actually returns
    const res = await GET(mkReq(), mkCtx("w1"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://t/api/r2/vocab/S1_male/ket-actor-n.mp3");
  });
});
