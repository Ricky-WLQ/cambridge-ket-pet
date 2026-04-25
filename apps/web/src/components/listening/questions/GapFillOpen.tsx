"use client";

import type { QuestionLeafProps } from "../QuestionRenderer";

export function GapFillOpen(props: QuestionLeafProps) {
  const q = props.question;
  const selected = props.value ?? "";
  const isCorrect =
    props.showCorrectness &&
    selected.trim().toLowerCase() === props.correctAnswer?.trim().toLowerCase();
  const isWrong = props.showCorrectness && selected.length > 0 && !isCorrect;

  return (
    <div className="my-4 p-4 border rounded">
      <p className="font-semibold mb-2">{q.prompt}</p>
      <input
        type="text"
        value={selected}
        onChange={(e) => props.onChange(e.target.value)}
        disabled={props.disabled}
        className={`border-2 rounded px-3 py-1 ${
          isCorrect ? "border-green-500" : isWrong ? "border-red-500" : "border-slate-300"
        }`}
      />
      {props.showCorrectness && !isCorrect && (
        <p className="text-sm text-green-700 mt-2">
          正确答案: {props.correctAnswer}
        </p>
      )}
    </div>
  );
}
