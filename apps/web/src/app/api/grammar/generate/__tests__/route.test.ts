import { describe, expect, it, vi, beforeEach } from "vitest";
import { _resetForTests } from "@/lib/grammar/rate-limit";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

const findUnique = vi.fn();
const findMany = vi.fn();
const createMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    grammarTopic: { findUnique: (...a: unknown[]) => findUnique(...a) },
    grammarQuestion: {
      findMany: (...a: unknown[]) => findMany(...a),
      createMany: (...a: unknown[]) => createMany(...a),
    },
  },
}));

const fetchSpy = vi.fn();
vi.stubGlobal("fetch", (...a: unknown[]) => fetchSpy(...a));

beforeEach(() => {
  findUnique.mockReset();
  findMany.mockReset();
  createMany.mockReset();
  fetchSpy.mockReset();
  findMany.mockResolvedValue([]);
  _resetForTests();
});

import { POST } from "../route";

const reqWith = (init?: RequestInit) => new Request("http://t/api/grammar/generate", init);

const _aiResp = (overrides = {}) => ({
  questions: [{
    question: "She _____ in this factory since 2018.",
    options: ["works", "worked", "has worked", "will work"],
    correct_index: 2,
    explanation_en: null,
    explanation_zh: "现在完成时。",
    difficulty: 2,
    ...overrides,
  }],
});

describe("POST /api/grammar/generate", () => {
  it("rejects when required fields missing", async () => {
    const res = await POST(reqWith({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ examType: "KET" }),
    }));
    expect(res.status).toBe(400);
  });

  it("rate-limits at 5 requests/min/user (6th returns 429)", async () => {
    findUnique.mockResolvedValue({ id: "topic-1", spec: "...", examples: [], examType: "KET" });
    createMany.mockResolvedValue({ count: 1 });
    fetchSpy.mockResolvedValue({ ok: true, json: async () => _aiResp(), text: async () => "" });

    const body = JSON.stringify({ examType: "KET", topicId: "tenses_present", count: 5 });
    const init = { method: "POST", headers: { "content-type": "application/json" }, body };

    for (let i = 0; i < 5; i++) {
      const res = await POST(reqWith(init));
      expect(res.status).toBe(200);
    }
    const sixth = await POST(reqWith(init));
    expect(sixth.status).toBe(429);
    expect(sixth.headers.get("retry-after")).toBeTruthy();
  });

  it("returns 404 when topic doesn't exist", async () => {
    findUnique.mockResolvedValue(null);
    const res = await POST(reqWith({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ examType: "KET", topicId: "fake_topic", count: 5 }),
    }));
    expect(res.status).toBe(404);
  });

  it("forwards to AI service with topic spec + examples + existing questions", async () => {
    findUnique.mockResolvedValue({
      id: "topic-1", spec: "Present perfect spec", examples: ["I have lived here.", "She has worked here."], examType: "KET",
    });
    createMany.mockResolvedValue({ count: 1 });
    fetchSpy.mockResolvedValue({ ok: true, json: async () => _aiResp(), text: async () => "" });

    await POST(reqWith({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ examType: "KET", topicId: "topic-1", count: 5 }),
    }));

    expect(fetchSpy).toHaveBeenCalledOnce();
    const aiBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(aiBody.spec).toBe("Present perfect spec");
    expect(aiBody.examples).toEqual(["I have lived here.", "She has worked here."]);
    expect(aiBody.count).toBe(5);
  });

  it("persists returned questions to GrammarQuestion table", async () => {
    findUnique.mockResolvedValue({ id: "topic-1", spec: "...", examples: [], examType: "KET" });
    createMany.mockResolvedValue({ count: 1 });
    fetchSpy.mockResolvedValue({ ok: true, json: async () => _aiResp(), text: async () => "" });

    const res = await POST(reqWith({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ examType: "KET", topicId: "topic-1", count: 5 }),
    }));

    expect(res.status).toBe(200);
    expect(createMany).toHaveBeenCalledOnce();
    const args = createMany.mock.calls[0][0];
    expect(args.data[0].question).toBe("She _____ in this factory since 2018.");
    expect(args.data[0].correctIndex).toBe(2);
    expect(args.data[0].source).toMatch(/^ai:deepseek:/);
  });
});
