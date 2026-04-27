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
  /**
   * Optional override for the post-submit redirect path. Defaults to the
   * existing `/${portal}/writing/result/${attemptId}`. The diagnose runner
   * wrapper passes `/diagnose` so a student lands back on the hub after a
   * section submit (I3).
   */
  redirectAfterSubmit?: string;
  /**
   * When true, the runner is rendered in view-only mode — no submit button,
   * a "练习模式 — 不计分" banner is shown. Used by the diagnose replay page
   * (I1).
   */
  readOnly?: boolean;
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
  redirectAfterSubmit,
  readOnly = false,
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
      const target =
        redirectAfterSubmit ?? `/${portal}/writing/result/${attemptId}`;
      router.push(target);
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
      <div className="page-section">
        <div className="mx-auto max-w-2xl w-full px-1 py-16 text-center">
          <div className="rounded-3xl bg-white border-2 border-ink/10 p-8 stitched-card">
            <div className="text-lg font-extrabold">AI 批改中…</div>
            <p className="mt-2 text-sm text-ink/65">
              通常需要 30-90 秒。批改完成后会自动跳转到成绩页面。
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-section locked-height">
      <div className="site-header">
        <div className="flex items-center gap-2.5">
          <div className="leading-tight">
            <div className="text-[11px] font-bold text-ink/60">
              {examType} 写作 · Part {part}
            </div>
            <div className="text-base font-extrabold">
              {mode === "MOCK" ? "模拟考试" : "练习模式"} · 至少 {minWords} 词
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div
            className={`rounded-full border-2 px-4 py-2 text-sm font-extrabold ${
              meetsMin
                ? "bg-mint-tint border-ink/10 text-emerald-700"
                : "bg-butter-tint border-ink/10 text-ink/70"
            }`}
          >
            已写 <span className="font-mono">{wordCount}</span> 词
            {meetsMin ? " ✓ 达到最低要求" : `（至少 ${minWords} 词）`}
          </div>
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
          {!readOnly && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                submitting ||
                wordCount === 0 ||
                (taskType === "LETTER_OR_STORY" && !chosenOption)
              }
              className="rounded-full bg-ink text-white text-base font-extrabold px-6 py-2.5 hover:bg-ink/90 transition disabled:opacity-50"
            >
              {submitting ? "提交中…" : "提交作文"}
            </button>
          )}
        </div>
      </div>

      <div
        className="grid gap-3.5 lg:grid-cols-[1.05fr_1fr] grow-fill min-h-0"
        style={{ gridTemplateRows: "minmax(0, 1fr)" }}
      >
        {/* Left column: prompt + content points + option picker */}
        <div className="flex flex-col gap-3 min-h-0 overflow-y-auto pr-1">
          {readOnly && (
            <div className="rounded-2xl bg-butter-tint border-2 border-ink/10 px-4 py-3 text-sm font-bold">
              练习模式 — 不计分
            </div>
          )}

          {/* Task prompt */}
          <div className="rounded-2xl bg-mist border-2 border-ink/10 p-4 stitched-card whitespace-pre-wrap text-sm leading-relaxed">
            {prompt}
          </div>

          {/* Content points (KET P6, PET P1) */}
          {contentPoints.length > 0 && (
            <div className="rounded-2xl bg-sky-tint border-2 border-sky-300 p-4 stitched-card">
              <div className="mb-2 text-sm font-extrabold text-sky-900">
                你的作文必须包含以下要点：
              </div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-sky-900">
                {contentPoints.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Scene descriptions (KET P7) */}
          {sceneDescriptions.length > 0 && (
            <div className="rounded-2xl bg-lavender-tint border-2 border-ink/10 p-4 stitched-card">
              <div className="mb-2 text-sm font-extrabold text-ink">
                三个画面（按顺序）：
              </div>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-ink/85">
                {sceneDescriptions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
          )}

          {/* PET Part 2: option picker */}
          {taskType === "LETTER_OR_STORY" && (
            <div className="rounded-2xl bg-white border-2 border-ink/10 p-4 stitched-card">
              <div className="mb-2 text-sm font-extrabold">选择一个题目作答：</div>
              <div className="flex gap-2">
                {(["A", "B"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setChosenOption(opt)}
                    className={`flex-1 rounded-xl border-2 px-4 py-2 text-sm font-bold transition ${
                      chosenOption === opt
                        ? "border-ink bg-ink text-white"
                        : "border-ink/15 hover:border-ink"
                    }`}
                  >
                    选择 {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-2xl bg-red-50 border-2 border-red-200 p-3 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          {taskType === "LETTER_OR_STORY" && !chosenOption && (
            <div className="text-xs font-bold text-ink/55">请先选择 A 或 B</div>
          )}
        </div>

        {/* Right column: full-height textarea */}
        <div className="flex flex-col gap-2 min-h-0 overflow-hidden">
          <label
            htmlFor="response"
            className="block text-sm font-extrabold shrink-0"
          >
            你的作文
          </label>
          <textarea
            id="response"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            readOnly={readOnly}
            className="rounded-2xl border-2 border-ink/15 bg-white p-5 text-base font-medium focus:border-ink outline-none resize-none flex-1 min-h-0 leading-relaxed transition"
            placeholder="在这里用英语写下你的作文…"
          />
        </div>
      </div>
    </div>
  );
}
