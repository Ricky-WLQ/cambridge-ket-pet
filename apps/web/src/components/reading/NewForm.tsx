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
    { part: 1, label: "Part 1", subtitle: "Matching (6 items)" },
    { part: 2, label: "Part 2", subtitle: "Open cloze (7 items)" },
    { part: 3, label: "Part 3", subtitle: "Multiple-choice comprehension (5 items)" },
    { part: 4, label: "Part 4", subtitle: "Matching sentences to paragraphs (4 items)" },
    { part: 5, label: "Part 5", subtitle: "Multiple-choice cloze (4 items)" },
  ],
  PET: [
    { part: 1, label: "Part 1", subtitle: "Short-text MCQ, 5 options (5 items)" },
    { part: 2, label: "Part 2", subtitle: "Match people to texts (5 items)" },
    { part: 3, label: "Part 3", subtitle: "Article MCQ (5 items)" },
    { part: 4, label: "Part 4", subtitle: "Gapped text (5 items)" },
    { part: 5, label: "Part 5", subtitle: "MCQ cloze, 4 options (6 items)" },
    { part: 6, label: "Part 6", subtitle: "Open cloze (6 items)" },
  ],
};

export default function ReadingNewForm({ examType, initialPart }: Props) {
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
      const res = await fetch("/api/tests/generate", {
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
      router.push(`/${portal}/reading/runner/${data.attemptId}`);
    } catch {
      setError("网络错误，请重试");
      setLoading(false);
    }
  }

  const parts = PARTS[examType];
  const cefr = examType === "KET" ? "A2" : "B1";
  const portal = examType === "KET" ? "ket" : "pet";
  const TILES = ["tile-lavender", "tile-sky", "tile-butter", "tile-peach", "tile-mint", "tile-cream"];

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href={`/${portal}`}
        className="mb-4 inline-flex items-center gap-2 rounded-full bg-ink/5 hover:bg-ink/10 px-3.5 py-1.5 text-sm font-bold text-ink"
      >
        <span aria-hidden>←</span> 返回 {examType} 门户
      </Link>
      <h1 className="mb-1.5 text-3xl font-extrabold">
        新建 <span className="marker-yellow-thick">{examType} 阅读练习</span>
      </h1>
      <p className="mb-6 text-base sm:text-lg text-ink/75 leading-relaxed">
        CEFR {cefr} · 选择题目部分与模式，由 AI 即时生成符合真题格式的练习题
      </p>

      <div className="mb-6 space-y-2">
        <div className="text-sm font-extrabold">选择题目部分</div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {parts.map((p, idx) => {
            const tile = TILES[idx % TILES.length];
            const selected = part === p.part;
            return (
              <button
                key={p.part}
                type="button"
                onClick={() => setPart(p.part)}
                className={`rounded-2xl border-2 px-4 py-3 text-left stitched-card transition ${
                  selected
                    ? "bg-ink text-white border-ink"
                    : `${tile} border-ink/10 hover:border-ink`
                }`}
              >
                <div className="font-extrabold text-base">{p.label}</div>
                <div
                  className={`mt-0.5 text-xs ${
                    selected ? "text-white/70" : "text-ink/65"
                  }`}
                >
                  {p.subtitle}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-6 space-y-2">
        <div className="text-sm font-extrabold">选择模式</div>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => setMode("PRACTICE")}
            className={`flex-1 rounded-full border-2 px-4 py-3 text-left transition ${
              mode === "PRACTICE"
                ? "bg-ink text-white border-ink font-extrabold"
                : "bg-white text-ink border-ink/15 font-bold hover:bg-ink/5"
            }`}
          >
            <div className="font-extrabold text-base">练习模式</div>
            <div
              className={`mt-0.5 text-xs ${
                mode === "PRACTICE" ? "text-white/70" : "text-ink/65"
              }`}
            >
              不计时，提交后即时反馈
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode("MOCK")}
            className={`flex-1 rounded-full border-2 px-4 py-3 text-left transition ${
              mode === "MOCK"
                ? "bg-ink text-white border-ink font-extrabold"
                : "bg-white text-ink border-ink/15 font-bold hover:bg-ink/5"
            }`}
          >
            <div className="font-extrabold text-base">模拟考试</div>
            <div
              className={`mt-0.5 text-xs ${
                mode === "MOCK" ? "text-white/70" : "text-ink/65"
              }`}
            >
              严格计时，结束后统一批改
            </div>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border-2 border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 font-bold">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleStart}
        disabled={loading || part === null}
        className="w-full rounded-full bg-ink px-5 py-3.5 text-base font-extrabold text-white hover:bg-ink/90 transition disabled:opacity-50"
      >
        {loading ? "生成中…（通常 20-40 秒）" : "开始生成"}
      </button>
    </div>
  );
}
