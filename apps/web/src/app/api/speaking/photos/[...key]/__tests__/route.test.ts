import { describe, expect, it } from "vitest";
import { GET } from "../route";

describe("GET /api/speaking/photos/[...key] (deprecated 308 redirect)", () => {
  // Location is intentionally server-relative — see route docstring for why
  // (Zeabur's edge proxy doesn't preserve the public Host header).
  it("308-redirects to /api/r2/[...key] with a server-relative Location", async () => {
    // Use the inner-socket URL to mirror what Next.js actually sees on Zeabur.
    const req = new Request("http://localhost:8080/api/speaking/photos/choice-club-01.jpg");
    const res = await GET(req, { params: Promise.resolve({ key: ["choice-club-01.jpg"] }) });
    expect(res.status).toBe(308);
    const location = res.headers.get("location");
    expect(location).toBe("/api/r2/choice-club-01.jpg");
    expect(location).not.toContain("localhost:8080");
  });

  it("preserves multi-segment keys", async () => {
    const req = new Request("http://localhost:8080/api/speaking/photos/folder/subfolder/file.png");
    const res = await GET(req, {
      params: Promise.resolve({ key: ["folder", "subfolder", "file.png"] }),
    });
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("/api/r2/folder/subfolder/file.png");
  });
});
