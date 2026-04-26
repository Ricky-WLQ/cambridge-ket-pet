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

  useEffect(() => { loadBatch(); }, [loadBatch]);

  // Read tier from query param on first mount.
  useEffect(() => {
    const url = new URL(window.location.href);
    const t = url.searchParams.get("tier");
    if (t === "CORE" || t === "RECOMMENDED" || t === "EXTRA") setTierFilter(t);
  }, []);

  const cur = batch[idx] ?? null;

  // Play audio when card changes.
  useEffect(() => {
    if (!cur || !audioRef.current) return;
    setRevealed(false);
    audioRef.current.src = `/api/vocab/audio/${cur.id}`;
    audioRef.current.play().catch(() => {
      // R2 fetch failed → fall back to Web Speech
      try {
        const u = new SpeechSynthesisUtterance(cur.word);
        u.lang = "en-GB";
        window.speechSynthesis.speak(u);
      } catch { /* both audio paths failed; carry on silently */ }
    });
    if (autoReveal) {
      const t = setTimeout(() => setRevealed(true), 1500);
      return () => clearTimeout(t);
    }
  }, [cur, autoReveal]);

  const playAgain = () => {
    if (!cur || !audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {
      try {
        const u = new SpeechSynthesisUtterance(cur.word);
        u.lang = "en-GB";
        window.speechSynthesis.speak(u);
      } catch { /* ignore */ }
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
    return <div className="mx-auto max-w-2xl px-6 py-12 text-center text-neutral-400">加载中...</div>;
  }
  if (!cur) {
    return <div className="mx-auto max-w-2xl px-6 py-12 text-center text-neutral-400">暂无单词。<button onClick={loadBatch} className="ml-2 underline">重试</button></div>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between text-sm text-neutral-500">
        <Link href={`/${examType.toLowerCase()}/vocab`} className="hover:text-neutral-900">← 词汇主页</Link>
        <div className="flex items-center gap-3 text-xs">
          <label>等级: <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value as WordTier | "ALL")} className="rounded border border-neutral-300 px-1">
            <option value="ALL">全部</option>
            <option value="CORE">必修</option>
            <option value="RECOMMENDED">推荐</option>
            <option value="EXTRA">拓展</option>
          </select></label>
          <label>批量: <select value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))} className="rounded border border-neutral-300 px-1">
            <option value={10}>10</option><option value={20}>20</option><option value={30}>30</option><option value={50}>50</option>
          </select></label>
          <label><input type="checkbox" checked={autoReveal} onChange={(e) => setAutoReveal(e.target.checked)} /> 自动显示</label>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-300 bg-white p-8 text-center">
        <div className="mb-2 text-xs text-neutral-400">第 {idx + 1} / {batch.length}</div>
        <div className={`mb-1 font-mono text-3xl tracking-wider ${revealed ? "text-neutral-900" : "text-neutral-300"}`}>
          {revealed ? cur.word : "? ".repeat(cur.word.length).trim()}
        </div>
        <div className="mb-3 min-h-[1.25rem] font-mono text-sm text-neutral-500">{revealed ? cur.phonetic ?? "" : " "}</div>
        <button onClick={playAgain} className="mb-3 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">🔊 播放发音</button>
        <div className="mb-2 text-base text-neutral-700"><span className="mr-1 italic text-neutral-500">{cur.pos}</span>{cur.glossZh}</div>
        {cur.example && <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm italic text-neutral-600">
          {/* hide the headword in the example — just blank it out as ____ */}
          {cur.example.replace(new RegExp(`\\b${cur.word}\\w*\\b`, "gi"), "____")}
        </div>}
        <audio ref={audioRef} className="hidden" preload="auto" />
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button onClick={playAgain} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm hover:border-neutral-900">🔊 再听一次</button>
        {!revealed && <button onClick={() => setRevealed(true)} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm hover:border-neutral-900">显示单词</button>}
        <button onClick={markMastered} className="rounded-md border border-green-600 bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700">✓ 已掌握</button>
      </div>

      <div className="mx-auto mt-3 flex max-w-md justify-between text-sm text-neutral-500">
        <button onClick={prev} disabled={idx === 0} className="disabled:opacity-30">← 上一个</button>
        <span className="text-neutral-400">{idx + 1} / {batch.length}</span>
        <button onClick={advance}>下一个 →</button>
      </div>
    </div>
  );
}
