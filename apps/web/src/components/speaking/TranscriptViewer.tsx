"use client";

import { useState } from "react";

interface Turn {
  role: "user" | "assistant";
  content: string;
  part: number;
}

interface Props {
  transcript: Turn[];
  defaultOpen?: boolean;
}

export function TranscriptViewer({ transcript, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  if (!transcript?.length) return null;
  return (
    <section className="rounded-md border border-neutral-300 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-neutral-50"
      >
        <span className="text-sm font-medium text-neutral-900">
          对话记录 · {transcript.length} 句
        </span>
        <span className="text-sm text-neutral-500">
          {open ? "收起" : "展开"}
        </span>
      </button>
      {open && (
        <ol className="divide-y divide-neutral-200 border-t border-neutral-200">
          {transcript.map((t, i) => (
            <li key={i} className="flex gap-3 px-4 py-3 text-sm">
              <span
                className={`mt-0.5 inline-block w-12 shrink-0 text-xs font-semibold uppercase tracking-wide ${
                  t.role === "assistant" ? "text-emerald-700" : "text-sky-700"
                }`}
              >
                {t.role === "assistant" ? "Mina" : "你"}
              </span>
              <span className="flex-1 text-neutral-800">
                <span className="mr-2 text-xs text-neutral-400">
                  P{t.part}
                </span>
                {t.content}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
