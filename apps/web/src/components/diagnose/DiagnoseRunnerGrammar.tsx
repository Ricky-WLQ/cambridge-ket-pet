"use client";

/**
 * Grammar section runner for the weekly diagnose.
 *
 * Why this is a NEW runner instead of reusing `GrammarQuizRunner`:
 *  - `GrammarQuizRunner` writes per-question outcomes to `/api/grammar/progress`,
 *    which mutates `GrammarProgress` (the SRS state and weak-topic map). The
 *    diagnose is a read-only assessment — pollutting SRS state would make the
 *    user's grammar practice queue noisy for the week after a diagnose.
 *  - The diagnose presents 3 fixed MCQs (T16 generator) with a hard countdown
 *    rather than the practice flow's per-question reveal-and-explain loop.
 *
 * Layout reuses `<MCQOption>` for option rendering (same letter chip + state
 * styling) and matches `GrammarQuizRunner`'s card chrome for visual coherence.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { MCQOption } from "@/components/grammar/MCQOption";
import type { GrammarAnswers, GrammarItem } from "@/lib/diagnose/types";

interface Props {
  attemptId: string;
  questions: GrammarItem[];
  /**
   * Initial seconds remaining when the runner mounts. Caller (the page)
   * computes this with `remainingSec()` from the section's startedAt.
   */
  timeLimitSec: number;
}

const LETTERS: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function DiagnoseRunnerGrammar({
  attemptId,
  questions,
  timeLimitSec,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<(number | null)[]>(() =>
    Array(questions.length).fill(null),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(timeLimitSec);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [remaining]);

  const answeredCount = useMemo(
    () => selected.filter((v) => v !== null).length,
    [selected],
  );

  async function submit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setError(null);
    setSubmitting(true);

    const answersPayload: GrammarAnswers = {
      sectionKind: "GRAMMAR",
      answers: selected,
    };

    try {
      const res = await fetch("/api/diagnose/me/section/GRAMMAR/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answersPayload }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "提交失败");
        setSubmitting(false);
        submittedRef.current = false;
        return;
      }
      router.push("/diagnose");
    } catch {
      setError("网络错误，请重试");
      setSubmitting(false);
      submittedRef.current = false;
    }
  }

  // Auto-submit when timer hits zero.
  useEffect(() => {
    if (remaining === 0 && !submittedRef.current) {
      void submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">本周诊断 · 语法</h1>
          <p className="text-sm text-neutral-500">
            选择正确选项 · 共 {questions.length} 题
          </p>
        </div>
        <div
          className={`rounded-md border px-3 py-1.5 font-mono text-lg ${
            remaining <= 30
              ? "border-red-300 bg-red-50 text-red-700"
              : "border-neutral-300"
          }`}
          aria-live="polite"
        >
          {formatTime(remaining)}
        </div>
      </div>

      <ol className="space-y-5">
        {questions.map((q, idx) => (
          <li
            key={q.questionId}
            className="rounded-2xl border border-neutral-300 bg-white p-5"
          >
            <div className="mb-3 flex items-start gap-2">
              <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 px-1.5 text-xs font-medium text-white">
                {idx + 1}
              </span>
              <p className="flex-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-900">
                {q.questionText}
              </p>
            </div>

            <div className="space-y-2">
              {q.options.map((text, i) => {
                const state =
                  selected[idx] === i ? ("selected" as const) : ("default" as const);
                return (
                  <MCQOption
                    key={i}
                    letter={LETTERS[i]}
                    text={text}
                    state={state}
                    disabled={submitting}
                    onClick={() =>
                      setSelected((prev) => {
                        const next = [...prev];
                        next[idx] = i;
                        return next;
                      })
                    }
                  />
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      {error && (
        <div className="mt-6 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-8 flex items-center justify-between gap-4">
        <div className="text-sm text-neutral-500">
          已答 {answeredCount} / {questions.length}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          data-attempt-id={attemptId}
          className="rounded-md bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50"
        >
          {submitting ? "提交中…" : "提交"}
        </button>
      </div>
    </div>
  );
}
