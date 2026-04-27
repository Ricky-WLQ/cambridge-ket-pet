"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type QuestionType =
  | "MCQ"
  | "OPEN_CLOZE"
  | "MATCHING"
  | "MCQ_CLOZE"
  | "GAPPED_TEXT";

export type RunnerQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  options: string[] | null;
};

export type RunnerProps = {
  attemptId: string;
  examType: "KET" | "PET";
  part: number;
  mode: "PRACTICE" | "MOCK";
  passage: string | null;
  questions: RunnerQuestion[];
  timeLimitSec: number;
};

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ReadingRunner({
  attemptId,
  examType,
  part,
  mode,
  passage,
  questions,
  timeLimitSec,
}: RunnerProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerActive = mode === "MOCK" && timeLimitSec > 0;
  const [remaining, setRemaining] = useState(timeLimitSec);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!timerActive) return;
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [timerActive, remaining]);

  const answeredCount = useMemo(
    () => Object.values(answers).filter((v) => v.trim().length > 0).length,
    [answers],
  );

  async function handleSubmit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/tests/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "提交失败");
        setSubmitting(false);
        submittedRef.current = false;
        return;
      }
      const portal = examType === "KET" ? "ket" : "pet";
      router.push(`/${portal}/reading/result/${attemptId}`);
    } catch {
      setError("网络错误，请重试");
      setSubmitting(false);
      submittedRef.current = false;
    }
  }

  // Auto-submit when timer hits 0 in mock mode
  useEffect(() => {
    if (timerActive && remaining === 0 && !submittedRef.current) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerActive, remaining]);

  return (
    <div className="page-section locked-height">
      <div className="site-header">
        <div className="flex items-center gap-2.5">
          <div className="leading-tight">
            <div className="text-[11px] font-bold text-ink/60">
              {examType} 阅读 · Part {part}
            </div>
            <div className="text-base font-extrabold">
              {mode === "MOCK" ? "模拟考试" : "练习模式"} · 共 {questions.length} 题
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {timerActive && (
            <div
              className={`rounded-full border-2 px-4 py-2 ${
                remaining <= 60
                  ? "border-red-300 bg-red-50 text-red-700"
                  : "border-ink/10 bg-butter-tint"
              }`}
              aria-live="polite"
            >
              <span className="font-mono font-extrabold text-lg tabular-nums">
                {formatTime(remaining)}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-full bg-ink text-white text-base font-extrabold px-6 py-2.5 hover:bg-ink/90 transition disabled:opacity-50"
          >
            {submitting ? "提交中…" : "提交答卷"}
          </button>
        </div>
      </div>

      <div
        className="grid gap-3.5 lg:grid-cols-[1.05fr_1fr] grow-fill min-h-0"
        style={{ gridTemplateRows: "minmax(0, 1fr)" }}
      >
        {passage && (
          <article className="self-start min-h-0 max-h-full overflow-y-auto rounded-3xl bg-white border-2 border-ink/10 p-5 sm:p-6 stitched-card">
            <div className="whitespace-pre-wrap text-base leading-[1.7] text-ink/85">
              {passage}
            </div>
          </article>
        )}

        <div className="flex flex-col gap-3 min-h-0 overflow-hidden">
          <ol className="space-y-3 overflow-y-auto pr-1 grow-fill min-h-0">
            {questions.map((q, idx) => {
              const hasAnswer = (answers[q.id] ?? "").trim().length > 0;
              return (
                <li
                  key={q.id}
                  className="rounded-2xl bg-white border-2 border-ink/10 p-4 stitched-card"
                >
                  <div className="mb-2.5 flex items-start gap-2.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink text-white font-extrabold text-sm">
                      {idx + 1}
                    </span>
                    <div className="flex-1 whitespace-pre-wrap text-base font-bold leading-snug text-ink/90">
                      {q.prompt}
                    </div>
                    {hasAnswer && (
                      <button
                        type="button"
                        onClick={() =>
                          setAnswers((prev) => {
                            const next = { ...prev };
                            delete next[q.id];
                            return next;
                          })
                        }
                        className="shrink-0 rounded-full border-2 border-ink/15 px-3 py-0.5 text-xs font-bold text-ink/70 hover:bg-ink/5 transition"
                        aria-label={`清除第 ${idx + 1} 题的作答`}
                      >
                        清除
                      </button>
                    )}
                  </div>
                  <QuestionInput
                    question={q}
                    value={answers[q.id] ?? ""}
                    onChange={(v) =>
                      setAnswers((prev) => ({ ...prev, [q.id]: v }))
                    }
                  />
                </li>
              );
            })}
          </ol>

          {error && (
            <div className="rounded-2xl bg-red-50 border-2 border-red-200 p-3 text-sm font-bold text-red-700 shrink-0">
              {error}
            </div>
          )}

          <div className="rounded-2xl bg-mint-tint border-2 border-ink/10 px-4 py-2.5 flex items-center gap-2.5 shrink-0">
            <span className="text-sm font-extrabold">
              已作答 {answeredCount} / {questions.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: RunnerQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  // MCQ-family with explicit options: radio buttons, A/B/C... labels
  if (
    (question.type === "MCQ" || question.type === "MCQ_CLOZE") &&
    question.options
  ) {
    return (
      <div className="space-y-2 ml-9">
        {question.options.map((opt, i) => {
          const letter = String.fromCharCode(65 + i); // 'A', 'B', ...
          const checked = value === letter;
          return (
            <label
              key={letter}
              className={`w-full flex items-start gap-3 rounded-xl px-3.5 py-2.5 transition cursor-pointer ${
                checked
                  ? "bg-butter-tint border-2 border-ink"
                  : "border-2 border-ink/10 hover:border-ink"
              }`}
            >
              <input
                type="radio"
                name={question.id}
                value={letter}
                checked={checked}
                onChange={() => onChange(letter)}
                className="mt-1.5"
              />
              <span className={`text-sm ${checked ? "font-extrabold" : ""}`}>
                <strong className="mr-1.5">{letter}.</strong>
                {opt}
              </span>
            </label>
          );
        })}
      </div>
    );
  }

  // MATCHING / GAPPED_TEXT: user types a letter (A-H typically). Short input.
  if (question.type === "MATCHING" || question.type === "GAPPED_TEXT") {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        maxLength={2}
        placeholder="字母 (A-H)"
        className="ml-9 w-32 rounded-2xl border-2 border-ink/15 bg-white px-4 py-2 font-mono text-sm font-extrabold focus:border-ink outline-none transition"
      />
    );
  }

  // OPEN_CLOZE: short word input
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={40}
      placeholder="填入一个单词"
      className="ml-9 w-48 rounded-2xl border-2 border-ink/15 bg-white px-4 py-2 text-sm font-medium focus:border-ink outline-none transition"
    />
  );
}
