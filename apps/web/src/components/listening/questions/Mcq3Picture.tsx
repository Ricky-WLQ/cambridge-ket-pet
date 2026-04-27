"use client";

import type { QuestionLeafProps } from "../QuestionRenderer";
import { signR2PublicUrl } from "@/lib/r2-signed-url";

export function Mcq3Picture(props: QuestionLeafProps) {
  const q = props.question;
  const opts = q.options ?? [];
  return (
    <div className="my-4 p-4 border rounded">
      <p className="font-semibold mb-3">{q.prompt}</p>
      <div className="grid grid-cols-3 gap-3">
        {opts.map((opt) => {
          const selected = props.value === opt.id;
          const isCorrect =
            props.showCorrectness && opt.id === props.correctAnswer;
          const isWrong =
            props.showCorrectness && selected && opt.id !== props.correctAnswer;
          const borderClass = isCorrect
            ? "border-green-500 bg-green-50"
            : isWrong
              ? "border-red-500 bg-red-50"
              : selected
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 hover:border-slate-400";
          return (
            <button
              key={opt.id}
              type="button"
              disabled={props.disabled}
              onClick={() => props.onChange(opt.id)}
              className={`flex flex-col items-stretch p-2 border-2 rounded transition ${borderClass}`}
            >
              <div className="text-xl font-bold mb-1 text-center">{opt.id}</div>
              {opt.imageUrl ? (
                <div className="aspect-square w-full overflow-hidden rounded bg-slate-100">
                  {/* Plain <img> — Next.js Image optimizer would require
                      registering R2 as a remote pattern; the /api/r2 stream
                      proxy already handles caching + auth so a plain img
                      tag is correct here. */}
                  <img
                    src={signR2PublicUrl(opt.imageUrl)}
                    alt={opt.imageDescription ?? `Option ${opt.id}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="aspect-square w-full flex items-center justify-center bg-slate-100 rounded text-sm text-slate-600 px-2 text-center">
                  {opt.imageDescription ?? `Picture ${opt.id}`}
                </div>
              )}
              {opt.imageUrl && opt.imageDescription ? (
                <div className="mt-1 text-xs text-slate-500 text-center truncate">
                  {opt.imageDescription}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
