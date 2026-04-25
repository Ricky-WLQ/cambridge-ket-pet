import type { ExamType, WordTier } from "@prisma/client";

/** Word as returned by /api/vocab/words. Excludes server-only fields like `source`. */
export interface WordDto {
  id: string;
  examType: ExamType;
  cambridgeId: string;
  word: string;
  pos: string;
  phonetic: string | null;
  glossEn: string | null;
  glossZh: string;
  example: string | null;
  topics: string[];
  tier: WordTier;
  audioKey: string | null;
}

/** VocabProgress row + computed flags for the dashboard. */
export interface VocabProgressDto {
  wordId: string;
  word: string;
  mastery: number;
  lastReviewed: string | null;     // ISO string
  nextReview: string | null;       // ISO string
  reviewCount: number;
  correctCount: number;
}

/** Aggregate stats for the /api/vocab/progress GET response. */
export interface VocabStats {
  total: number;          // total VocabProgress rows for (user, examType)
  mastered: number;       // mastery >= MASTERY_MASTERED_THRESHOLD
  byTier: Record<WordTier, { total: number; mastered: number }>;
  byMastery: number[];    // length 6, count per mastery 0..5
}

export interface PaginationDto {
  page: number;
  pageSize: number;
  totalPages: number;
}
