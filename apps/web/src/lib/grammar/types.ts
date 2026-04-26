import type { ExamType, NoteStatus } from "@prisma/client";

/** Topic as returned by /api/grammar/topics. Excludes server-only fields like `source`. */
export interface GrammarTopicDto {
  id: string;
  examType: ExamType;
  category: string;
  topicId: string;
  labelEn: string;
  labelZh: string;
  spec: string;
  description: string | null;
  examples: string[];
  murphyUnits: number[];
}

/** MCQ question as served to the quiz runner. Snapshot fields are recomputed
 *  on the client when posting back so the server can store them in the
 *  GrammarProgress attempt row. */
export interface GrammarQuestionDto {
  id: string;
  examType: ExamType;
  topicId: string;
  questionType: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanationEn: string | null;
  explanationZh: string;
  difficulty: number;
}

/** Per-topic accuracy + attempt counts for the hub dashboard. */
export interface GrammarPerTopicStat {
  topicId: string;
  attempted: number;
  correct: number;
  accuracy: number;  // 0..1; 0 if attempted = 0
}

/** Aggregate response from /api/grammar/progress GET. */
export interface GrammarProgressStats {
  totalAttempted: number;
  totalCorrect: number;
  accuracy: number;            // overall, 0..1
  perTopic: GrammarPerTopicStat[];
  weakTopics: string[];        // topicIds, ordered by accuracy ascending
}

/** Grammar attempt row as rendered in the mistakes review. */
export interface GrammarMistakeDto {
  id: string;
  topicId: string;
  questionText: string;
  questionOptions: string[];
  correctIndex: number;
  userAnswer: number;
  explanationZh: string;
  status: NoteStatus;
  createdAt: string;           // ISO
}

export interface GrammarMistakeCounts {
  NEW: number;
  REVIEWED: number;
  MASTERED: number;
  total: number;
}

export interface GrammarPagination {
  page: number;
  pageSize: number;
  totalPages: number;
}
