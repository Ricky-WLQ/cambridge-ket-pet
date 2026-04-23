"use client";

import type { ListeningQuestion } from "@/lib/audio/types";
import { Mcq3Picture } from "./questions/Mcq3Picture";
import { GapFillOpen } from "./questions/GapFillOpen";
import { Mcq3Text } from "./questions/Mcq3Text";
import { Mcq3TextScenario } from "./questions/Mcq3TextScenario";
import { Matching5To8 } from "./questions/Matching5To8";

export interface QuestionRendererProps {
  question: ListeningQuestion;
  value: string | undefined;
  onChange: (val: string) => void;
  disabled?: boolean;
  showCorrectness?: boolean; // true on result page
  correctAnswer?: string;
}

export function QuestionRenderer(props: QuestionRendererProps) {
  const { type } = props.question;
  if (type === "MCQ_3_PICTURE") return <Mcq3Picture {...props} />;
  if (type === "GAP_FILL_OPEN") return <GapFillOpen {...props} />;
  if (
    type === "MCQ_3_TEXT" ||
    type === "MCQ_3_TEXT_DIALOGUE" ||
    type === "MCQ_3_TEXT_INTERVIEW"
  )
    return <Mcq3Text {...props} />;
  if (type === "MCQ_3_TEXT_SCENARIO") return <Mcq3TextScenario {...props} />;
  if (type === "MATCHING_5_TO_8") return <Matching5To8 {...props} />;
  return null;
}
