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
import { Mascot } from "@/components/Mascot";
import type { Portal } from "@/i18n/voice";
import type { GrammarAnswers, GrammarItem } from "@/lib/diagnose/types";

interface Props {
  attemptId: string;
  questions: GrammarItem[];
  /**
   * Initial seconds remaining when the runner mounts. Caller (the page)
   * computes this with `remainingSec()` from the section's startedAt.
   */
  timeLimitSec: number;
  /** Mascot to render in the hero strip — Leo for KET, Aria for PET. */
  portal?: Portal;
  /**
   * When true, the runner is rendered in view-only mode — no submit button
   * (and no auto-submit-on-timer), with a "练习模式 — 不计分" banner. Used
   * by the diagnose replay page (I1).
   */
  readOnly?: boolean;
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
  portal = "ket",
  readOnly = false,
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
    if (readOnly) return;
    if (remaining === 0 && !submittedRef.current) {
      void submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, readOnly]);

  return (
    <div className="mx-auto max-w-2xl w-full">
      <div className="mb-4 flex items-center gap-3 px-1">
        <Mascot pose="chart" portal={portal} width={56} height={56} decorative />
        <div className="flex-1">
          <h1 className="text-base font-extrabold leading-tight">
            语法 · 共 {questions.length} 题
          </h1>
          <p className="mt-0.5 text-xs font-medium text-ink/60">
            选择正确选项
          </p>
        </div>
        <div
          className={`rounded-full border-2 px-3 py-1.5 font-mono text-base font-extrabold ${
            remaining <= 30
              ? "border-rose-300 bg-rose-50 text-rose-700"
              : "border-ink/15 bg-white"
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
            className="rounded-2xl border-2 border-ink/10 bg-white p-5 stitched-card"
          >
            <div className="mb-3 flex items-start gap-2">
              <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-ink px-1.5 text-xs font-extrabold text-white">
                {idx + 1}
              </span>
              <p className="flex-1 whitespace-pre-wrap text-sm leading-relaxed text-ink/90 font-bold">
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
        <div className="mt-6 rounded-2xl border-2 border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
          {error}
        </div>
      )}

      {readOnly && (
        <div className="mt-6 rounded-2xl border-2 border-amber-300 bg-amber-50 px-3 py-2 text-xs font-extrabold text-amber-900">
          练习模式 — 不计分
        </div>
      )}

      <div className="mt-8 flex items-center justify-between gap-4">
        <div className="text-sm font-bold text-ink/55">
          已答 {answeredCount} / {questions.length}
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            data-attempt-id={attemptId}
            className="rounded-full bg-ink px-6 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-ink/90 disabled:opacity-50"
          >
            {submitting ? "提交中…" : "提交"}
          </button>
        )}
      </div>
    </div>
  );
}
