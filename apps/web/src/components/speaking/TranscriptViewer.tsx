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
    <section className="rounded-2xl bg-white border-2 border-ink/10 stitched-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-ink/5 transition rounded-2xl"
      >
        <span className="text-sm font-extrabold text-ink">
          对话记录 · {transcript.length} 句
        </span>
        <span className="text-sm font-bold text-ink/60">
          {open ? "收起" : "展开"}
        </span>
      </button>
      {open && (
        <ol className="divide-y divide-ink/10 border-t-2 border-ink/10">
          {transcript.map((t, i) => (
            <li key={i} className="flex gap-3 px-4 py-3 text-sm">
              <span
                className={`mt-0.5 inline-block w-12 shrink-0 text-xs font-extrabold uppercase tracking-wide ${
                  t.role === "assistant" ? "text-emerald-700" : "text-sky-700"
                }`}
              >
                {t.role === "assistant" ? "Mina" : "你"}
              </span>
              <span className="flex-1 text-ink/85">
                <span className="mr-2 text-xs font-bold text-ink/40">
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
