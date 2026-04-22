// HTTP client for the internal Python Pydantic-AI service.
// Server-side only (uses INTERNAL_AI_SHARED_SECRET).

const INTERNAL_AI_URL =
  process.env.INTERNAL_AI_URL ?? "http://localhost:8001";
const INTERNAL_AI_SHARED_SECRET =
  process.env.INTERNAL_AI_SHARED_SECRET ?? "";

export type QuestionType =
  | "MCQ"
  | "OPEN_CLOZE"
  | "MATCHING"
  | "MCQ_CLOZE"
  | "GAPPED_TEXT";

export type ReadingQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  options: string[] | null;
  answer: string;
  explanation_zh: string;
  exam_point_id: string;
  difficulty_point_id: string | null;
};

export type ReadingTestPayload = {
  passage: string | null;
  questions: ReadingQuestion[];
  time_limit_sec: number;
};

export type ReadingTestRequest = {
  exam_type: "KET" | "PET";
  part: number;
  mode?: "PRACTICE" | "MOCK";
  seed_exam_points?: string[];
  seed_difficulty_points?: string[];
};

const DEFAULT_TIMEOUT_MS = 75_000; // DeepSeek takes 20-40s; give headroom.

export async function generateReadingTest(
  req: ReadingTestRequest,
): Promise<ReadingTestPayload> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    DEFAULT_TIMEOUT_MS,
  );

  try {
    const res = await fetch(`${INTERNAL_AI_URL}/v1/reading/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${INTERNAL_AI_SHARED_SECRET}`,
      },
      body: JSON.stringify(req),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `AI service ${res.status}: ${text.slice(0, 400) || res.statusText}`,
      );
    }

    return (await res.json()) as ReadingTestPayload;
  } finally {
    clearTimeout(timeoutId);
  }
}
