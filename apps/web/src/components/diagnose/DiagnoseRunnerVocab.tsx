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

import { Mascot } from "@/components/Mascot";
import type { Portal } from "@/i18n/voice";
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
  /** Mascot to render in the hero strip — Leo for KET, Aria for PET. */
  portal?: Portal;
  /**
   * When true, the runner is rendered in view-only mode — no submit button
   * (and no auto-submit-on-timer), with a "练习模式 — 不计分" banner. Used
   * by the diagnose replay page (I1) so re-takes against past-week testIds
   * don't 404 the current-week submit endpoint.
   */
  readOnly?: boolean;
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
  portal = "ket",
  readOnly = false,
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
    if (readOnly) return;
    if (remaining === 0 && !submittedRef.current) {
      void submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, readOnly]);

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
                className="mx-1 inline-block w-32 rounded-xl border-2 border-ink/15 px-2 py-1 text-sm focus:border-ink focus:outline-none"
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
            className="ml-2 inline-block w-32 rounded-xl border-2 border-ink/15 px-2 py-1 text-sm focus:border-ink focus:outline-none"
            aria-label={`第 ${idx + 1} 题作答`}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl w-full">
      <div className="mb-4 flex items-center gap-3 px-1">
        <Mascot pose="flashcards" portal={portal} width={56} height={56} decorative />
        <div className="flex-1">
          <h1 className="text-base font-extrabold leading-tight">
            词汇 · 共 {items.length} 题
          </h1>
          <p className="mt-0.5 text-xs font-medium text-ink/60">
            填入正确的单词
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

      <ol className="space-y-4">
        {items.map((item, idx) => (
          <li
            key={item.wordId}
            className="rounded-2xl border-2 border-ink/10 bg-white p-5 stitched-card"
          >
            <div className="mb-2 flex items-start gap-2">
              <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-ink px-1.5 text-xs font-extrabold text-white">
                {idx + 1}
              </span>
              {item.glossZh && (
                <span className="text-xs font-bold text-ink/55">
                  {item.glossZh}
                </span>
              )}
            </div>
            {renderFill(item, idx)}
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
          已填 {filledCount} / {items.length}
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
