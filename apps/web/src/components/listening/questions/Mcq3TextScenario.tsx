"use client";

import type { QuestionLeafProps } from "../QuestionRenderer";
import { Mcq3Text } from "./Mcq3Text";

export function Mcq3TextScenario(props: QuestionLeafProps) {
  // Same rendering as Mcq3Text — scenario prompt is read aloud by proctor
  // voice in the audio; the student sees the question prompt here.
  return <Mcq3Text {...props} />;
}
