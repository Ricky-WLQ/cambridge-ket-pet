import { describe, expect, it } from "vitest";
import { GET } from "../route";

describe("GET /api/speaking/photos/[...key] (deprecated 308 redirect)", () => {
  it("308-redirects to /api/r2/[...key]", async () => {
    const req = new Request("http://t/api/speaking/photos/choice-club-01.jpg");
    const res = await GET(req, { params: Promise.resolve({ key: ["choice-club-01.jpg"] }) });
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("http://t/api/r2/choice-club-01.jpg");
  });

  it("preserves multi-segment keys", async () => {
    const req = new Request("http://t/api/speaking/photos/folder/subfolder/file.png");
    const res = await GET(req, {
      params: Promise.resolve({ key: ["folder", "subfolder", "file.png"] }),
    });
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("http://t/api/r2/folder/subfolder/file.png");
  });
});
