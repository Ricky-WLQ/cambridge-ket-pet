"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Mascot } from "@/components/Mascot";

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
  const TILES = ["tile-lavender", "tile-sky", "tile-butter", "tile-peach", "tile-mint", "tile-cream"];

  return (
    <div className="mx-auto max-w-3xl w-full">
      <div className="mb-3 px-1">
        <Link
          href={`/${portal}`}
          className="text-sm font-bold text-ink/70 hover:text-ink hover:underline"
        >
          ← 返回 {examType} 门户
        </Link>
      </div>
      <div className="mb-5 flex items-center gap-3 px-1">
        <Mascot pose="writing" portal={portal} width={64} height={64} decorative />
        <div className="flex-1">
          <h1 className="text-lg font-extrabold leading-tight">
            {examType} 写作练习
          </h1>
          <p className="mt-0.5 text-xs font-medium text-ink/60">
            CEFR {cefr} · AI 即时生成符合真题格式的写作任务
          </p>
        </div>
      </div>

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
              不计时，自由构思
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
        {loading ? "生成中…（通常 10-20 秒）" : "开始生成"}
      </button>
    </div>
  );
}
