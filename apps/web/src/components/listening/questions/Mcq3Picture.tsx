"use client";

import type { QuestionLeafProps } from "../QuestionRenderer";

export function Mcq3Picture(props: QuestionLeafProps) {
  const q = props.question;
  const opts = q.options ?? [];
  return (
    <div className="my-4 p-4 border rounded">
      <p className="font-semibold mb-3">{q.prompt}</p>
      <div className="grid grid-cols-3 gap-3">
        {opts.map((opt) => {
          const selected = props.value === opt.id;
          const isCorrect = props.showCorrectness && opt.id === props.correctAnswer;
          const isWrong =
            props.showCorrectness && selected && opt.id !== props.correctAnswer;
          return (
            <button
              key={opt.id}
              disabled={props.disabled}
              onClick={() => props.onChange(opt.id)}
              className={`p-4 border-2 rounded ${
                isCorrect ? "border-green-500 bg-green-50" :
                isWrong ? "border-red-500 bg-red-50" :
                selected ? "border-blue-500 bg-blue-50" : ""
              }`}
            >
              <div className="text-2xl font-bold mb-2">{opt.id}</div>
              <div className="text-sm text-slate-600">
                {opt.imageDescription ?? `Picture ${opt.id}`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
