"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type WritingRunnerProps = {
  attemptId: string;
  examType: "KET" | "PET";
  part: number;
  mode: "PRACTICE" | "MOCK";
  taskType: "EMAIL" | "PICTURE_STORY" | "LETTER_OR_STORY";
  prompt: string;
  contentPoints: string[];
  sceneDescriptions: string[];
  minWords: number;
  timeLimitSec: number;
  /**
   * Optional override for the submit endpoint. Defaults to the existing
   * `/api/tests/${attemptId}/submit` to preserve current behavior.
   *
   * Used by the diagnose runner wrapper to route submissions to
   * `/api/diagnose/me/section/WRITING/submit`.
   */
  submitUrl?: string;
};

function countWords(s: string): number {
  // Collapse whitespace, then split. Empty string -> 0.
  const trimmed = s.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function WritingRunner({
  attemptId,
  examType,
  part,
  mode,
  taskType,
  prompt,
  contentPoints,
  sceneDescriptions,
  minWords,
  timeLimitSec,
  submitUrl: submitUrlProp,
}: WritingRunnerProps) {
  const router = useRouter();
  // Default preserves existing call-site behavior; diagnose wrapper overrides.
  const submitUrl = submitUrlProp ?? `/api/tests/${attemptId}/submit`;
  const [response, setResponse] = useState("");
  const [chosenOption, setChosenOption] = useState<"A" | "B" | "">("");
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

  const wordCount = useMemo(() => countWords(response), [response]);
  const meetsMin = wordCount >= minWords;

  async function handleSubmit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setError(null);
    setSubmitting(true);

    const payload: { response: string; chosenOption?: "A" | "B" } = {
      response: response.trim(),
    };
    if (taskType === "LETTER_OR_STORY" && chosenOption) {
      payload.chosenOption = chosenOption;
    }

    try {
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: payload }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "提交失败");
        setSubmitting(false);
        submittedRef.current = false;
        return;
      }
      const portal = examType === "KET" ? "ket" : "pet";
      router.push(`/${portal}/writing/result/${attemptId}`);
    } catch {
      setError("网络错误，请重试");
      setSubmitting(false);
      submittedRef.current = false;
    }
  }

  // Auto-submit when mock timer hits 0
  useEffect(() => {
    if (timerActive && remaining === 0 && !submittedRef.current) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerActive, remaining]);

  if (submitting) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-8">
          <div className="text-lg font-medium">AI 批改中…</div>
          <p className="mt-2 text-sm text-neutral-500">
            通常需要 30-90 秒。批改完成后会自动跳转到成绩页面。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {examType} 写作 · Part {part}
          </h1>
          <p className="text-sm text-neutral-500">
            {mode === "MOCK" ? "模拟考试" : "练习模式"} · 至少 {minWords} 词
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

      {/* Task prompt */}
      <div className="mb-4 whitespace-pre-wrap rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-relaxed">
        {prompt}
      </div>

      {/* Content points (KET P6, PET P1) */}
      {contentPoints.length > 0 && (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-4">
          <div className="mb-2 text-sm font-medium text-blue-900">
            你的作文必须包含以下要点：
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-blue-900">
            {contentPoints.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Scene descriptions (KET P7) */}
      {sceneDescriptions.length > 0 && (
        <div className="mb-4 rounded-md border border-purple-200 bg-purple-50 p-4">
          <div className="mb-2 text-sm font-medium text-purple-900">
            三个画面（按顺序）：
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-purple-900">
            {sceneDescriptions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      {/* PET Part 2: option picker */}
      {taskType === "LETTER_OR_STORY" && (
        <div className="mb-4 rounded-md border border-neutral-200 p-4">
          <div className="mb-2 text-sm font-medium">选择一个题目作答：</div>
          <div className="flex gap-2">
            {(["A", "B"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setChosenOption(opt)}
                className={`flex-1 rounded-md border px-4 py-2 text-sm transition ${
                  chosenOption === opt
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 hover:border-neutral-900"
                }`}
              >
                选择 {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Response textarea */}
      <div className="mb-2">
        <label
          htmlFor="response"
          className="mb-1 block text-sm font-medium"
        >
          你的作文
        </label>
        <textarea
          id="response"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          rows={12}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm leading-relaxed focus:border-neutral-900 focus:outline-none"
          placeholder="在这里用英语写下你的作文…"
        />
      </div>

      <div className="mb-6 flex items-center justify-between text-xs">
        <div
          className={`font-medium ${
            meetsMin ? "text-green-700" : "text-neutral-500"
          }`}
        >
          已写 <span className="font-mono">{wordCount}</span> 词
          {meetsMin ? " ✓ 达到最低要求" : `（至少 ${minWords} 词）`}
        </div>
        <div className="text-neutral-400">
          {taskType === "LETTER_OR_STORY" && !chosenOption && "请先选择 A 或 B"}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={
          submitting ||
          wordCount === 0 ||
          (taskType === "LETTER_OR_STORY" && !chosenOption)
        }
        className="w-full rounded-md bg-neutral-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50"
      >
        {submitting ? "提交中…" : "提交作文"}
      </button>
    </div>
  );
}
