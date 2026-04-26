"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExamType, WordTier } from "@prisma/client";
import type { WordDto } from "@/lib/vocab/types";
import { generateFillBlank, type FillBlankResult } from "@/lib/vocab/fillBlank";

interface Props { examType: ExamType }

const BATCH_SIZE_DEFAULT = 20;

interface Question { word: WordDto; fb: FillBlankResult }

export default function VocabSpellRunner({ examType }: Props) {
  const [batch, setBatch] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [inputs, setInputs] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [revealedAnswer, setRevealedAnswer] = useState(false);
  const [tierFilter, setTierFilter] = useState<WordTier | "ALL">("ALL");
  const [batchSize, setBatchSize] = useState(BATCH_SIZE_DEFAULT);
  const [loading, setLoading] = useState(true);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadBatch = useCallback(async () => {
    setLoading(true); setIdx(0); setSubmitted(false); setRevealedAnswer(false);
    const qs = new URLSearchParams({ examType, pageSize: String(batchSize), page: "1" });
    if (tierFilter !== "ALL") qs.set("tier", tierFilter);
    const res = await fetch(`/api/vocab/words?${qs}`);
    const data = await res.json();
    const shuffled = [...data.words].sort(() => Math.random() - 0.5) as WordDto[];
    const questions: Question[] = shuffled.map((w) => ({ word: w, fb: generateFillBlank(w.word, { blankRatio: 0.4 }) }));
    setBatch(questions); setLoading(false);
  }, [examType, tierFilter, batchSize]);

  useEffect(() => { loadBatch(); }, [loadBatch]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const t = url.searchParams.get("tier");
    if (t === "CORE" || t === "RECOMMENDED" || t === "EXTRA") setTierFilter(t);
  }, []);

  const cur = batch[idx] ?? null;
  const blanksCount = cur?.fb.answers.length ?? 0;

  // Reset inputs when card changes.
  useEffect(() => {
    if (!cur) return;
    setInputs(Array(cur.fb.answers.length).fill(""));
    setSubmitted(false); setRevealedAnswer(false);
    inputRefs.current = Array(cur.fb.answers.length).fill(null);
    setTimeout(() => inputRefs.current[0]?.focus(), 0);
  }, [cur]);

  // Auto-play audio on card change.
  useEffect(() => {
    if (!cur || !audioRef.current) return;
    audioRef.current.src = `/api/vocab/audio/${cur.word.id}`;
    audioRef.current.play().catch((err: DOMException) => {
      // Browser autoplay policy blocks the FIRST play before user interaction —
      // don't fall back to Web Speech for that (the user will click 播放发音).
      if (err?.name === "NotAllowedError") return;
      try {
        const u = new SpeechSynthesisUtterance(cur.word.word);
        u.lang = "en-GB"; window.speechSynthesis.speak(u);
      } catch { /* ignore */ }
    });
  }, [cur]);

  const isCorrect = useMemo(() => {
    if (!cur) return false;
    return inputs.every((v, i) => v.trim().toLowerCase() === cur.fb.answers[i]);
  }, [inputs, cur]);

  const submit = async () => {
    if (!cur || submitted) return;
    setSubmitted(true);
    const correct = isCorrect;
    await fetch("/api/vocab/progress", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ wordId: cur.word.id, examType, isCorrect: correct, source: "spell" }),
    }).catch(() => {});
  };

  const reveal = async () => {
    if (!cur) return;
    setRevealedAnswer(true); setSubmitted(true);
    await fetch("/api/vocab/progress", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ wordId: cur.word.id, examType, isCorrect: false, source: "spell" }),
    }).catch(() => {});
  };

  const advance = () => {
    if (idx + 1 < batch.length) setIdx(idx + 1);
    else loadBatch();
  };

  const handleInputChange = (i: number, v: string) => {
    const copy = [...inputs];
    copy[i] = v;
    setInputs(copy);
  };
  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (i === blanksCount - 1) submit();
      else inputRefs.current[i + 1]?.focus();
    } else if (e.key === "Tab" && !e.shiftKey && i < blanksCount - 1) {
      e.preventDefault(); inputRefs.current[i + 1]?.focus();
    } else if (e.key === "Tab" && e.shiftKey && i > 0) {
      e.preventDefault(); inputRefs.current[i - 1]?.focus();
    }
  };

  const playAudio = () => {
    if (!cur || !audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => { /* ignore */ });
  };

  if (loading) return <div className="mx-auto max-w-2xl px-6 py-12 text-center text-neutral-400">加载中...</div>;
  if (!cur) return <div className="mx-auto max-w-2xl px-6 py-12 text-center text-neutral-400">暂无单词。</div>;

  let blankCounter = -1;
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between text-sm text-neutral-500">
        <Link href={`/${examType.toLowerCase()}/vocab`} className="hover:text-neutral-900">← 词汇主页</Link>
        <div className="flex items-center gap-3 text-xs">
          <label>等级: <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value as WordTier | "ALL")} className="rounded border border-neutral-300 px-1">
            <option value="ALL">全部</option><option value="CORE">必修</option><option value="RECOMMENDED">推荐</option><option value="EXTRA">拓展</option>
          </select></label>
          <label>批量: <select value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))} className="rounded border border-neutral-300 px-1">
            <option value={10}>10</option><option value={20}>20</option><option value={30}>30</option><option value={50}>50</option>
          </select></label>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-300 bg-white p-8 text-center">
        <div className="mb-2 text-xs text-neutral-400">第 {idx + 1} / {batch.length}</div>
        <button onClick={playAudio} className="mb-3 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">🔊 播放发音</button>
        <div className="mb-2 text-base text-neutral-700"><span className="mr-1 italic text-neutral-500">{cur.word.pos}</span>{cur.word.glossZh}</div>
        {cur.word.example && (
          <div className="mb-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm italic text-neutral-600">
            {cur.word.example.replace(new RegExp(`\\b${cur.word.word}\\w*\\b`, "gi"), "____")}
          </div>
        )}
        <div className="my-4 rounded-md border border-neutral-200 bg-neutral-50 p-3">
          {cur.fb.segments.map((seg, i) => {
            if (seg.kind === "letter") {
              return <span key={i} className="px-0.5 font-mono text-xl text-neutral-600">{seg.letter}</span>;
            }
            // it's a blank — render seg.length inputs
            return Array.from({ length: seg.length }, (_, k) => {
              blankCounter++;
              const myIdx = blankCounter;
              const showCorrect = (submitted || revealedAnswer) && inputs[myIdx]?.trim().toLowerCase() !== cur.fb.answers[myIdx];
              return (
                <span key={`${i}-${k}`} className="inline-block">
                  <input
                    ref={(el) => { inputRefs.current[myIdx] = el; }}
                    type="text"
                    maxLength={1}
                    value={inputs[myIdx] ?? ""}
                    onChange={(e) => handleInputChange(myIdx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(myIdx, e)}
                    disabled={submitted}
                    className={`mx-px h-9 w-7 rounded border bg-white text-center font-mono text-xl ${
                      submitted
                        ? showCorrect ? "border-red-500 text-red-700" : "border-green-600 text-green-700"
                        : "border-neutral-400"
                    }`}
                  />
                  {showCorrect && <span className="mt-0.5 block text-xs text-red-600">{cur.fb.answers[myIdx]}</span>}
                </span>
              );
            });
          })}
        </div>
        {submitted && (
          <div className={`mt-2 text-sm ${isCorrect ? "text-green-700" : "text-red-700"}`}>
            {isCorrect ? "✓ 正确" : `× 正确答案：${cur.word.word}`}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button onClick={playAudio} className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm hover:border-neutral-900">🔊 再听</button>
        {!submitted ? (
          <>
            <button onClick={submit} className="rounded-md border border-green-600 bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700">✓ 提交 (Enter)</button>
            <button onClick={reveal} className="rounded-md border border-amber-600 bg-white px-4 py-2 text-sm text-amber-700 hover:bg-amber-50">显示答案</button>
          </>
        ) : (
          <button onClick={advance} className="rounded-md border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm text-white">下一个 →</button>
        )}
      </div>

      <audio ref={audioRef} className="hidden" preload="auto" />
    </div>
  );
}
