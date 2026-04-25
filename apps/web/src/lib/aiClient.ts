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

export type WritingGradeRequest = {
  exam_type: "KET" | "PET";
  part: number;
  prompt: string;
  content_points: string[];
  scene_descriptions: string[];
  chosen_option: "A" | "B" | null;
  student_response: string;
};

export type WritingRubricScores = {
  content: number;
  communicative: number;
  organisation: number;
  language: number;
};

export type WritingGradeResponse = {
  scores: WritingRubricScores;
  total_band: number; // 0-20
  feedback_zh: string;
  specific_suggestions_zh: string[];
};

const GRADE_TIMEOUT_MS = 120_000; // grader can run 30-90s on longer essays

export async function gradeWriting(
  req: WritingGradeRequest,
): Promise<WritingGradeResponse> {
  return postToAi<WritingGradeResponse>(
    "/v1/writing/grade",
    req,
    GRADE_TIMEOUT_MS,
  );
}

export type StudentAnalysisRequest = {
  student_name: string;
  class_name: string;
  stats: {
    total_graded: number;
    avg_score: number | null;
    best_score: number | null;
    worst_score: number | null;
  };
  recent_attempts: Array<{
    date: string;
    exam_type: "KET" | "PET";
    kind: string;
    part: number | null;
    mode: "PRACTICE" | "MOCK";
    score: number;
  }>;
  writing_averages: {
    content: number;
    communicative: number;
    organisation: number;
    language: number;
    count: number;
  } | null;
  top_error_exam_points: Array<{
    id: string;
    label_zh: string;
    description_zh: string | null;
    count: number;
  }>;
  recent_writing_samples: Array<{
    exam_type: "KET" | "PET";
    part: number;
    prompt: string;
    response: string;
    scores: {
      content: number;
      communicative: number;
      organisation: number;
      language: number;
    };
    feedback_zh: string | null;
  }>;
  focus_exam_type: "KET" | "PET" | null;
};

export type StudentAnalysisResponse = {
  strengths: string[];
  weaknesses: string[];
  priority_actions: string[];
  narrative_zh: string;
};

const ANALYSIS_TIMEOUT_MS = 90_000;

export async function analyzeStudent(
  req: StudentAnalysisRequest,
): Promise<StudentAnalysisResponse> {
  return postToAi<StudentAnalysisResponse>(
    "/v1/analysis/student",
    req,
    ANALYSIS_TIMEOUT_MS,
  );
}

export interface GenerateListeningTestRequest {
  exam_type: "KET" | "PET";
  scope: "FULL" | "PART";
  part?: number;
  mode: "PRACTICE" | "MOCK";
  seed_exam_points?: string[];
}

/**
 * Call the Python /v1/listening/generate endpoint.
 * Returns the raw snake_case JSON — caller is responsible for transforming
 * to camelCase via the converter in `lib/audio/generate.ts`.
 */
export async function generateListeningTest(
  req: GenerateListeningTestRequest,
): Promise<Record<string, unknown>> {
  return postToAi<Record<string, unknown>>("/v1/listening/generate", req);
}

async function postToAi<T>(
  path: string,
  body: unknown,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
