"use client";

import type { QuestionLeafProps } from "../QuestionRenderer";

export function Matching5To8(props: QuestionLeafProps) {
  const q = props.question;
  const opts = q.options ?? [];
  const selected = props.value;
  const isCorrect = props.showCorrectness && selected === props.correctAnswer;
  const isWrong = props.showCorrectness && selected && !isCorrect;

  return (
    <div className="my-4 p-4 border rounded">
      <p className="font-semibold mb-2">{q.prompt}</p>
      <select
        value={selected ?? ""}
        onChange={(e) => props.onChange(e.target.value)}
        disabled={props.disabled}
        className={`border-2 rounded px-3 py-1 ${
          isCorrect ? "border-green-500" : isWrong ? "border-red-500" : "border-slate-300"
        }`}
      >
        <option value="">— 选择 —</option>
        {opts.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.id}. {opt.text ?? ""}
          </option>
        ))}
      </select>
      {props.showCorrectness && !isCorrect && (
        <p className="text-sm text-green-700 mt-2">
          正确答案: {props.correctAnswer}
        </p>
      )}
    </div>
  );
}
