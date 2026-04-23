"use client";

import type { QuestionLeafProps } from "../QuestionRenderer";

export function Mcq3Text(props: QuestionLeafProps) {
  const q = props.question;
  const opts = q.options ?? [];
  return (
    <div className="my-4 p-4 border rounded">
      <p className="font-semibold mb-3">{q.prompt}</p>
      <div className="space-y-2">
        {opts.map((opt) => {
          const selected = props.value === opt.id;
          const isCorrect = props.showCorrectness && opt.id === props.correctAnswer;
          const isWrong =
            props.showCorrectness && selected && opt.id !== props.correctAnswer;
          return (
            <label
              key={opt.id}
              className={`flex items-start gap-2 p-2 rounded cursor-pointer ${
                isCorrect ? "bg-green-50" : isWrong ? "bg-red-50" : selected ? "bg-blue-50" : ""
              }`}
            >
              <input
                type="radio"
                name={q.id}
                value={opt.id}
                checked={selected}
                disabled={props.disabled}
                onChange={() => props.onChange(opt.id)}
              />
              <span>
                <strong>{opt.id}.</strong> {opt.text}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
