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
  return postToAi<ReadingTestPayload>("/v1/reading/generate", req);
}

export type WritingTaskType =
  | "EMAIL"
  | "PICTURE_STORY"
  | "LETTER_OR_STORY";

export type WritingTestPayload = {
  task_type: WritingTaskType;
  prompt: string;
  content_points: string[];
  scene_descriptions: string[];
  min_words: number;
  topic_context: string | null;
  exam_point_id: string;
};

export type WritingTestRequest = {
  exam_type: "KET" | "PET";
  part: number;
  seed_exam_points?: string[];
  seed_difficulty_points?: string[];
};

export async function generateWritingTest(
  req: WritingTestRequest,
): Promise<WritingTestPayload> {
  return postToAi<WritingTestPayload>("/v1/writing/generate", req);
}

async function postToAi<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    DEFAULT_TIMEOUT_MS,
  );

  try {
    const res = await fetch(`${INTERNAL_AI_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${INTERNAL_AI_SHARED_SECRET}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `AI service ${res.status}: ${text.slice(0, 400) || res.statusText}`,
      );
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}
