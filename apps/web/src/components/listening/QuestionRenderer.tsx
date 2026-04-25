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
  // Optional so Server Components rendering the read-only review (result page)
  // can omit this function prop — passing a function across the server→client
  // boundary is a Next.js error. When omitted, a local no-op is used and
  // passed to leaf components.
  onChange?: (val: string) => void;
  disabled?: boolean;
  showCorrectness?: boolean; // true on result page
  correctAnswer?: string;
}

// Internal type used by leaf question components. The top-level
// QuestionRenderer always supplies a concrete onChange (falling back to a
// no-op), so leaves can call it directly without null checks.
export interface QuestionLeafProps extends Omit<QuestionRendererProps, "onChange"> {
  onChange: (val: string) => void;
}

export function QuestionRenderer(props: QuestionRendererProps) {
  const { type } = props.question;
  const merged: QuestionLeafProps = {
    ...props,
    onChange: props.onChange ?? (() => {}),
  };
  if (type === "MCQ_3_PICTURE") return <Mcq3Picture {...merged} />;
  if (type === "GAP_FILL_OPEN") return <GapFillOpen {...merged} />;
  if (
    type === "MCQ_3_TEXT" ||
    type === "MCQ_3_TEXT_DIALOGUE" ||
    type === "MCQ_3_TEXT_INTERVIEW"
  )
    return <Mcq3Text {...merged} />;
  if (type === "MCQ_3_TEXT_SCENARIO") return <Mcq3TextScenario {...merged} />;
  if (type === "MATCHING_5_TO_8") return <Matching5To8 {...merged} />;
  return null;
}
