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
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {examType} 阅读 · Part {part}
          </h1>
          <p className="text-sm text-neutral-500">
            {mode === "MOCK" ? "模拟考试" : "练习模式"} · 共 {questions.length} 题
          </p>
        </div>
        {timerActive && (
          <div
            className={`rounded-md border px-3 py-1.5 font-mono text-lg ${
              remaining <= 60
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-neutral-300"
            }`}
            aria-live="polite"
          >
            {formatTime(remaining)}
          </div>
        )}
      </div>

      {passage && (
        <div className="mb-6 whitespace-pre-wrap rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-relaxed">
          {passage}
        </div>
      )}

      <ol className="space-y-6">
        {questions.map((q, idx) => (
          <li key={q.id} className="rounded-md border border-neutral-200 p-4">
            <div className="mb-3 flex items-start gap-2">
              <span className="inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 px-1.5 text-xs font-medium text-white">
                {idx + 1}
              </span>
              <div className="flex-1 whitespace-pre-wrap text-sm">
                {q.prompt}
              </div>
            </div>
            <QuestionInput
              question={q}
              value={answers[q.id] ?? ""}
              onChange={(v) =>
                setAnswers((prev) => ({ ...prev, [q.id]: v }))
              }
            />
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
          已作答 {answeredCount} / {questions.length}
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-md bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50"
        >
          {submitting ? "提交中…" : "提交答卷"}
        </button>
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
      <div className="space-y-2">
        {question.options.map((opt, i) => {
          const letter = String.fromCharCode(65 + i); // 'A', 'B', ...
          const checked = value === letter;
          return (
            <label
              key={letter}
              className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm transition ${
                checked
                  ? "border-neutral-900 bg-neutral-50"
                  : "border-neutral-200 hover:border-neutral-400"
              }`}
            >
              <input
                type="radio"
                name={question.id}
                value={letter}
                checked={checked}
                onChange={() => onChange(letter)}
                className="mt-1"
              />
              <span>
                <strong className="mr-2">{letter}.</strong>
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
        className="w-32 rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm focus:border-neutral-900 focus:outline-none"
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
      className="w-48 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
    />
  );
}
