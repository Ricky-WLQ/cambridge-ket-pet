"use client";

/**
 * Vocab section runner for the weekly diagnose.
 *
 * Why this is a NEW runner instead of reusing `VocabSpellRunner`:
 *  - `VocabSpellRunner` writes per-question results to `/api/vocab/progress`,
 *    which mutates the user's `VocabProgress` SRS state. The diagnose is a
 *    read-only assessment — pollutting SRS state would make the user's vocab
 *    practice queue noisy for the week after a diagnose.
 *  - The diagnose presents exactly 3 fixed items (T16 generator) with a
 *    visible countdown timer, whereas the practice runner is a continuous
 *    stream over a tier filter.
 *
 * Layout reuses `VocabSpellRunner`'s visual idioms for consistency
 * (same `rounded-2xl border` card chrome, same neutral-color palette).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { VocabAnswers, VocabItem } from "@/lib/diagnose/types";

interface Props {
  attemptId: string;
  items: VocabItem[];
  /**
   * Initial seconds remaining when the runner mounts. Caller (the page)
   * computes this with `remainingSec()` from the section's startedAt so
   * picking up a paused session resumes from where it stopped.
   */
  timeLimitSec: number;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function DiagnoseRunnerVocab({
  attemptId,
  items,
  timeLimitSec,
}: Props) {
  const router = useRouter();
  const [inputs, setInputs] = useState<string[]>(() =>
    Array(items.length).fill(""),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(timeLimitSec);
  const submittedRef = useRef(false);

  // Countdown — same shape as ReadingRunner's timer.
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [remaining]);

  const filledCount = useMemo(
    () => inputs.filter((v) => v.trim().length > 0).length,
    [inputs],
  );

  async function submit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setError(null);
    setSubmitting(true);

    const answersPayload: VocabAnswers = {
      sectionKind: "VOCAB",
      answers: inputs.map((v) => (v.trim() === "" ? null : v.trim())),
    };

    try {
      const res = await fetch("/api/diagnose/me/section/VOCAB/submit", {
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

  /**
   * Render the fillPattern: split on the literal `____` token (the v2 plan
   * pins this token shape), then alternate text spans with an `<input>`.
   * If the pattern lacks a `____`, we fall back to a single trailing input.
   */
  function renderFill(item: VocabItem, idx: number) {
    const pattern = item.fillPattern;
    const segments = pattern.split("____");
    return (
      <div className="leading-relaxed">
        {segments.map((seg, i) => (
          <span key={i}>
            {seg}
            {i < segments.length - 1 && (
              <input
                type="text"
                value={inputs[idx] ?? ""}
                onChange={(e) =>
                  setInputs((prev) => {
                    const next = [...prev];
                    next[idx] = e.target.value;
                    return next;
                  })
                }
                disabled={submitting}
                placeholder="填空"
                className="mx-1 inline-block w-32 rounded-md border border-neutral-300 px-2 py-1 text-sm focus:border-neutral-900 focus:outline-none"
                aria-label={`第 ${idx + 1} 题作答`}
              />
            )}
          </span>
        ))}
        {/* Fallback when pattern has no ____ token. */}
        {segments.length === 1 && (
          <input
            type="text"
            value={inputs[idx] ?? ""}
            onChange={(e) =>
              setInputs((prev) => {
                const next = [...prev];
                next[idx] = e.target.value;
                return next;
              })
            }
            disabled={submitting}
            placeholder="填空"
            className="ml-2 inline-block w-32 rounded-md border border-neutral-300 px-2 py-1 text-sm focus:border-neutral-900 focus:outline-none"
            aria-label={`第 ${idx + 1} 题作答`}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">本周诊断 · 词汇</h1>
          <p className="text-sm text-neutral-500">
            填入正确的单词 · 共 {items.length} 题
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

      <ol className="space-y-4">
        {items.map((item, idx) => (
          <li
            key={item.wordId}
            className="rounded-2xl border border-neutral-300 bg-white p-5"
          >
            <div className="mb-2 flex items-start gap-2">
              <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 px-1.5 text-xs font-medium text-white">
                {idx + 1}
              </span>
              {item.glossZh && (
                <span className="text-xs text-neutral-500">
                  {item.glossZh}
                </span>
              )}
            </div>
            {renderFill(item, idx)}
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
          已填 {filledCount} / {items.length}
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
