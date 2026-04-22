"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = { examType: "KET" | "PET"; initialPart?: number | null };

const PARTS: Record<
  "KET" | "PET",
  Array<{ part: number; label: string; subtitle: string }>
> = {
  KET: [
    {
      part: 6,
      label: "Part 6",
      subtitle: "Guided email · 25+ words · 10 min",
    },
    {
      part: 7,
      label: "Part 7",
      subtitle: "Picture story · 35+ words · 8 min",
    },
  ],
  PET: [
    {
      part: 1,
      label: "Part 1",
      subtitle: "Email response · ~100 words · 25 min",
    },
    {
      part: 2,
      label: "Part 2",
      subtitle: "Letter OR story · ~100 words · 20 min",
    },
  ],
};

export default function WritingNewForm({ examType, initialPart }: Props) {
  const router = useRouter();
  const validParts = PARTS[examType].map((p) => p.part);
  const startingPart =
    initialPart != null && validParts.includes(initialPart) ? initialPart : null;
  const [part, setPart] = useState<number | null>(startingPart);
  const [mode, setMode] = useState<"PRACTICE" | "MOCK">("PRACTICE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    if (part === null) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/writing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examType, part, mode }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        attemptId?: string;
      };
      if (!res.ok || !data.attemptId) {
        setError(data.error ?? "生成失败");
        setLoading(false);
        return;
      }
      const portal = examType === "KET" ? "ket" : "pet";
      router.push(`/${portal}/writing/runner/${data.attemptId}`);
    } catch {
      setError("网络错误，请重试");
      setLoading(false);
    }
  }

  const parts = PARTS[examType];
  const cefr = examType === "KET" ? "A2" : "B1";
  const portal = examType === "KET" ? "ket" : "pet";

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href={`/${portal}`}
        className="mb-4 inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:border-neutral-900 hover:bg-neutral-100"
      >
        <span aria-hidden>←</span> 返回 {examType} 门户
      </Link>
      <h1 className="mb-2 text-2xl font-semibold">
        新建 {examType} 写作练习
      </h1>
      <p className="mb-6 text-sm text-neutral-500">
        CEFR {cefr} · 选择题目部分与模式，AI 即时生成符合真题格式的写作任务
      </p>

      <div className="mb-6 space-y-2">
        <div className="text-sm font-medium">选择题目部分</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {parts.map((p) => (
            <button
              key={p.part}
              type="button"
              onClick={() => setPart(p.part)}
              className={`rounded-md border px-4 py-3 text-left transition ${
                part === p.part
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 hover:border-neutral-900"
              }`}
            >
              <div className="font-medium">{p.label}</div>
              <div
                className={`mt-0.5 text-xs ${
                  part === p.part ? "text-neutral-300" : "text-neutral-500"
                }`}
              >
                {p.subtitle}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 space-y-2">
        <div className="text-sm font-medium">选择模式</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("PRACTICE")}
            className={`flex-1 rounded-md border px-4 py-3 text-left transition ${
              mode === "PRACTICE"
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 hover:border-neutral-900"
            }`}
          >
            <div className="font-medium">练习模式</div>
            <div
              className={`mt-0.5 text-xs ${
                mode === "PRACTICE" ? "text-neutral-300" : "text-neutral-500"
              }`}
            >
              不计时，自由构思
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode("MOCK")}
            className={`flex-1 rounded-md border px-4 py-3 text-left transition ${
              mode === "MOCK"
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 hover:border-neutral-900"
            }`}
          >
            <div className="font-medium">模拟考试</div>
            <div
              className={`mt-0.5 text-xs ${
                mode === "MOCK" ? "text-neutral-300" : "text-neutral-500"
              }`}
            >
              严格计时，结束后统一批改
            </div>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleStart}
        disabled={loading || part === null}
        className="w-full rounded-md bg-neutral-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50"
      >
        {loading ? "生成中…（通常 10-20 秒）" : "开始生成"}
      </button>
    </div>
  );
}
