export type VoiceTag =
  | "proctor"
  | "S1_male"
  | "S2_female_A"
  | "S2_female_B";

export type AudioSegmentKind =
  | "rubric"
  | "part_intro"
  | "preview_pause"
  | "scenario_prompt"
  | "question_stimulus"
  | "question_number"
  | "repeat_cue"
  | "pause"
  | "part_end"
  | "transfer_start"
  | "transfer_one_min"
  | "closing"
  | "example";

export interface AudioSegment {
  id: string;
  kind: AudioSegmentKind;
  voiceTag: VoiceTag | null;
  text?: string;
  durationMs?: number;
  partNumber?: number;
  questionId?: string;
}

export type PlayRule = "PER_ITEM" | "PER_PART";

export type QuestionType =
  | "MCQ_3_PICTURE"
  | "GAP_FILL_OPEN"
  | "MCQ_3_TEXT"
  | "MCQ_3_TEXT_SCENARIO"
  | "MATCHING_5_TO_8"
  | "MCQ_3_TEXT_DIALOGUE"
  | "MCQ_3_TEXT_INTERVIEW";

export interface ListeningOption {
  id: string;
  text?: string;
  imageDescription?: string;
  // R2 key (e.g., "listening/options/<sha16>.jpg") populated by
  // `enrichListeningOptionImages` AFTER the AI returns the test. The
  // Mcq3Picture component renders this via `signR2PublicUrl(imageUrl)`
  // when present, falling back to imageDescription text when missing.
  imageUrl?: string;
}

export interface ListeningQuestion {
  id: string;
  prompt: string;
  type: QuestionType;
  options?: ListeningOption[];
  answer: string;
  explanationZh: string;
  examPointId: string;
  difficultyPointId?: string;
}

export interface ListeningPart {
  partNumber: number;
  kind: QuestionType;
  instructionZh: string;
  previewSec: number;
  playRule: PlayRule;
  audioScript: AudioSegment[];
  questions: ListeningQuestion[];
}

export interface ListeningTestPayloadV2 {
  version: 2;
  examType: "KET" | "PET";
  scope: "FULL" | "PART";
  part?: number;
  parts: ListeningPart[];
  cefrLevel: "A2" | "B1";
  generatedBy: string;
}

export interface AudioSegmentRecord {
  id: string;
  kind: AudioSegmentKind;
  voiceTag: VoiceTag | null;
  startMs: number;
  endMs: number;
  questionId?: string;
  partNumber?: number;
}
