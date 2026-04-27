"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ExamType, WordTier } from "@prisma/client";
import type { WordDto } from "@/lib/vocab/types";

interface Props { examType: ExamType }

const BATCH_SIZE_DEFAULT = 20;

export default function VocabListenRunner({ examType }: Props) {
  const [batch, setBatch] = useState<WordDto[]>([]);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [autoReveal, setAutoReveal] = useState(false);
  const [tierFilter, setTierFilter] = useState<WordTier | "ALL">("ALL");
  const [batchSize, setBatchSize] = useState(BATCH_SIZE_DEFAULT);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadBatch = useCallback(async () => {
    setLoading(true);
    setIdx(0); setRevealed(false);
    const qs = new URLSearchParams({ examType, pageSize: String(batchSize), page: "1" });
    if (tierFilter !== "ALL") qs.set("tier", tierFilter);
    const res = await fetch(`/api/vocab/words?${qs}`);
    const data = await res.json();
    // shuffle once
    const w = [...data.words].sort(() => Math.random() - 0.5);
    setBatch(w); setLoading(false);
  }, [examType, tierFilter, batchSize]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard data-fetch effect
  useEffect(() => { loadBatch(); }, [loadBatch]);

  // Read tier from query param on first mount.
  useEffect(() => {
    const url = new URL(window.location.href);
    const t = url.searchParams.get("tier");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot URL→state hydration on mount
    if (t === "CORE" || t === "RECOMMENDED" || t === "EXTRA") setTierFilter(t);
  }, []);

  const cur = batch[idx] ?? null;

  // Play audio when card changes. Silent on autoplay-block; if R2 audio
  // genuinely fails, we'd rather show no sound than fall back to a robotic
  // browser TTS voice — the user can click 播放发音 to retry.
  // AbortError is expected when navigating between cards quickly: setting
  // `src` triggers a fresh load that interrupts the in-flight `play()`. It's
  // harmless and we filter it from the warn log alongside autoplay blocks.
  useEffect(() => {
    if (!cur || !audioRef.current) return;
    setRevealed(false);
    audioRef.current.src = `/api/vocab/audio/${cur.id}`;
    audioRef.current.play().catch((err: DOMException) => {
      if (err?.name !== "NotAllowedError" && err?.name !== "AbortError") {
        console.warn("[vocab/listen] audio play failed:", err?.name, err?.message);
      }
    });
    if (autoReveal) {
      const t = setTimeout(() => setRevealed(true), 1500);
      return () => clearTimeout(t);
    }
  }, [cur, autoReveal]);

  const playAgain = () => {
    if (!cur || !audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch((err: DOMException) => {
      if (err?.name !== "NotAllowedError" && err?.name !== "AbortError") {
        console.warn("[vocab/listen] audio replay failed:", err?.name, err?.message);
      }
    });
  };

  const markMastered = async () => {
    if (!cur) return;
    await fetch("/api/vocab/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wordId: cur.id, examType, isCorrect: true, markMastered: true, source: "listen" }),
    }).catch(() => {});
    advance();
  };

  const advance = () => {
    if (idx + 1 < batch.length) { setIdx(idx + 1); setRevealed(false); }
    else loadBatch();
  };

  const prev = () => { if (idx > 0) { setIdx(idx - 1); setRevealed(false); } };

  if (loading) {
    return <div className="mx-auto max-w-2xl px-6 py-12 text-center text-ink/40 font-bold">加载中...</div>;
  }
  if (!cur) {
    return <div className="mx-auto max-w-2xl px-6 py-12 text-center text-ink/40 font-bold">暂无单词。<button onClick={loadBatch} className="ml-2 font-bold text-ink underline">重试</button></div>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-ink/65">
        <Link href={`/${examType.toLowerCase()}/vocab`} className="font-bold hover:text-ink transition">← 词汇主页</Link>
        <div className="flex items-center gap-3 text-xs">
          <label className="font-bold">等级: <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value as WordTier | "ALL")} className="ml-1 rounded border-2 border-ink/15 px-1 py-0.5 font-bold">
            <option value="ALL">全部</option>
            <option value="CORE">必修</option>
            <option value="RECOMMENDED">推荐</option>
            <option value="EXTRA">拓展</option>
          </select></label>
          <label className="font-bold">批量: <select value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))} className="ml-1 rounded border-2 border-ink/15 px-1 py-0.5 font-bold">
            <option value={10}>10</option><option value={20}>20</option><option value={30}>30</option><option value={50}>50</option>
          </select></label>
          <label className="font-bold flex items-center gap-1"><input type="checkbox" checked={autoReveal} onChange={(e) => setAutoReveal(e.target.checked)} /> 自动显示</label>
        </div>
      </div>

      <div className="rounded-3xl bg-white border-2 border-ink/10 p-8 text-center stitched-card">
        <div className="mb-2 text-xs font-bold text-ink/40">第 {idx + 1} / {batch.length}</div>
        <div className={`mb-1 font-mono text-4xl tracking-wider font-extrabold ${revealed ? "text-ink" : "text-ink/30"}`}>
          {revealed ? cur.word : "? ".repeat(cur.word.length).trim()}
        </div>
        <div className="mb-3 min-h-[1.25rem] font-mono text-sm text-ink/55">{revealed ? cur.phonetic ?? "" : " "}</div>
        <button
          onClick={playAgain}
          className="mb-4 grid h-20 w-20 mx-auto place-items-center rounded-full bg-lavender-soft border-2 border-ink/15 hover:bg-lavender transition text-2xl"
          aria-label="播放发音"
        >
          🔊
        </button>
        <div className="mb-2 text-base font-medium text-ink/85"><span className="mr-1 italic text-ink/55">{cur.pos}</span>{cur.glossZh}</div>
        {cur.example && <div className="rounded-xl border-2 border-ink/10 bg-ink/[0.02] px-3 py-2 text-sm italic text-ink/65">
          {/* hide the headword in the example — just blank it out as ____ */}
          {cur.example.replace(new RegExp(`\\b${cur.word}\\w*\\b`, "gi"), "____")}
        </div>}
        <audio ref={audioRef} className="hidden" preload="auto" />
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <button onClick={playAgain} className="rounded-full border-2 border-ink/15 bg-white px-4 py-2 text-sm font-bold hover:bg-ink/5 transition">🔊 再听一次</button>
        {!revealed && <button onClick={() => setRevealed(true)} className="rounded-full border-2 border-ink/15 bg-white px-4 py-2 text-sm font-bold hover:bg-ink/5 transition">显示单词</button>}
        <button onClick={markMastered} className="rounded-full border-2 border-emerald-600 bg-emerald-600 px-5 py-2 text-sm font-extrabold text-white hover:bg-emerald-700 transition">✓ 已掌握</button>
      </div>

      <div className="mx-auto flex max-w-md justify-between text-sm font-bold text-ink/65">
        <button onClick={prev} disabled={idx === 0} className="disabled:opacity-30 hover:text-ink transition">← 上一个</button>
        <span className="text-ink/45">{idx + 1} / {batch.length}</span>
        <button onClick={advance} className="hover:text-ink transition">下一个 →</button>
      </div>
    </div>
  );
}
