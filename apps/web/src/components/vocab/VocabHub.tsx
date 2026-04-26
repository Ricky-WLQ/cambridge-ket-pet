"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ExamType, WordTier } from "@prisma/client";
import type { WordDto, VocabProgressDto, VocabStats, WordlistTotals, PaginationDto } from "@/lib/vocab/types";
import { WordRow } from "./WordRow";

const TIER_LABELS: Record<WordTier, { zh: string; stars: string; sub: string }> = {
  CORE:        { zh: "必修核心", stars: "★★★", sub: "必须掌握 · 决定通过率" },
  RECOMMENDED: { zh: "推荐",     stars: "★★",  sub: "建议掌握 · 高分必备" },
  EXTRA:       { zh: "拓展",     stars: "★",   sub: "非必须 · 进阶提升" },
};

interface Props { examType: ExamType }

interface WordsResponse { words: WordDto[]; totalCount: number; pagination: PaginationDto }
interface ProgressResponse {
  progress: VocabProgressDto[];
  stats: VocabStats;
  wordlistTotals: WordlistTotals;
}

export default function VocabHub({ examType }: Props) {
  const examLabel = examType === "KET" ? "A2 Key" : "B1 Preliminary";
  const examLabelZh = examType === "KET" ? "KET" : "PET";

  const [stats, setStats] = useState<VocabStats | null>(null);
  const [wordlistTotals, setWordlistTotals] = useState<WordlistTotals | null>(null);
  const [progressByWord, setProgressByWord] = useState<Map<string, VocabProgressDto>>(new Map());
  const [words, setWords] = useState<WordDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [tierFilter, setTierFilter] = useState<WordTier | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Fetch progress + stats once.
  useEffect(() => {
    let aborted = false;
    fetch(`/api/vocab/progress?examType=${examType}`)
      .then((r) => r.json() as Promise<ProgressResponse>)
      .then((data) => {
        if (aborted) return;
        setStats(data.stats);
        setProgressByWord(new Map(data.progress.map((p) => [p.wordId, p])));
        setWordlistTotals(data.wordlistTotals);
      })
      .catch((err) => console.error("[vocab] progress fetch failed:", err));
    return () => { aborted = true; };
  }, [examType]);

  // Fetch words list when filters change.
  useEffect(() => {
    let aborted = false;
    setLoading(true);
    const qs = new URLSearchParams({ examType, page: String(page), pageSize: "50" });
    if (tierFilter !== "ALL") qs.set("tier", tierFilter);
    if (search.trim()) qs.set("search", search.trim());
    fetch(`/api/vocab/words?${qs}`)
      .then((r) => r.json() as Promise<WordsResponse>)
      .then((data) => {
        if (aborted) return;
        setWords(data.words);
        setTotalCount(data.totalCount);
        setLoading(false);
      })
      .catch((err) => { if (!aborted) { console.error("[vocab] words fetch failed:", err); setLoading(false); } });
    return () => { aborted = true; };
  }, [examType, page, tierFilter, search]);

  const overallPct = useMemo(() => {
    const mastered = stats?.byTier.CORE.mastered ?? 0;
    const total = wordlistTotals?.byTier.CORE ?? 0;
    return total === 0 ? 0 : Math.round((mastered / total) * 100);
  }, [stats, wordlistTotals]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <h1 className="mb-2 text-2xl font-semibold">{examLabelZh} 词汇 · {examLabel} Vocabulary</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Cambridge {examLabel} 官方词表（2025 修订）{wordlistTotals ? ` · 共 ${wordlistTotals.total} 词` : ""}
      </p>

      {/* Overall mastery card */}
      <div className="mb-6 rounded-lg border border-neutral-300 p-5">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-xs text-neutral-500">总体掌握度（必修核心词）</div>
            <div className="mt-1 text-2xl font-semibold">
              {stats?.byTier.CORE.mastered ?? "—"}{" "}
              <span className="text-base font-normal text-neutral-400">
                / {wordlistTotals?.byTier.CORE ?? "—"}
              </span>
            </div>
          </div>
          <div className="text-2xl font-semibold text-green-600">{overallPct}%</div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-200">
          <div className="h-full bg-amber-600" style={{ width: `${overallPct}%` }} />
        </div>
      </div>

      {/* Practice CTAs */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href={`/${examType.toLowerCase()}/vocab/listen?tier=CORE`}
          className="rounded-lg border border-blue-600 bg-white p-4 transition hover:bg-blue-50"
        >
          <div className="text-sm font-semibold text-blue-700">🔊 听写 · 必修</div>
          <div className="mt-1 text-xs text-neutral-500">{wordlistTotals?.byTier.CORE ?? "—"} 个核心词</div>
        </Link>
        <Link
          href={`/${examType.toLowerCase()}/vocab/spell?tier=CORE`}
          className="rounded-lg border border-blue-600 bg-white p-4 transition hover:bg-blue-50"
        >
          <div className="text-sm font-semibold text-blue-700">✏️ 拼写 · 必修</div>
          <div className="mt-1 text-xs text-neutral-500">填字母练习</div>
        </Link>
        <Link
          href={`/${examType.toLowerCase()}/vocab/listen`}
          className="rounded-lg border border-neutral-300 bg-white p-4 transition hover:border-neutral-900 hover:shadow-sm"
        >
          <div className="text-sm font-semibold">🔊 听写 · 混合</div>
          <div className="mt-1 text-xs text-neutral-500">所有词混合</div>
        </Link>
        <Link
          href={`/${examType.toLowerCase()}/vocab/spell`}
          className="rounded-lg border border-neutral-300 bg-white p-4 transition hover:border-neutral-900 hover:shadow-sm"
        >
          <div className="text-sm font-semibold">✏️ 拼写 · 混合</div>
          <div className="mt-1 text-xs text-neutral-500">所有词混合</div>
        </Link>
      </div>

      {/* Tier cards */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {(["CORE", "RECOMMENDED", "EXTRA"] as WordTier[]).map((t) => {
          const meta = TIER_LABELS[t];
          const mastered = stats?.byTier[t]?.mastered ?? 0;
          const total = wordlistTotals?.byTier[t] ?? 0;
          const pct = total === 0 ? 0 : Math.round((mastered / total) * 100);
          const isCore = t === "CORE";
          return (
            <div
              key={t}
              className={`rounded-lg border p-4 ${
                isCore ? "border-yellow-600 bg-yellow-50" : "border-neutral-300 bg-white"
              }`}
            >
              <div className={`text-xs font-semibold uppercase tracking-wide ${isCore ? "text-yellow-700" : "text-neutral-500"}`}>
                {meta.zh} {meta.stars}
              </div>
              <div className={`mt-1 text-lg font-semibold ${isCore ? "text-yellow-800" : "text-neutral-900"}`}>
                {mastered} / {total}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200">
                <div
                  className={`h-full ${pct >= 80 ? "bg-green-600" : pct >= 50 ? "bg-amber-600" : "bg-red-600"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-neutral-500">{meta.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Filter row */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
        {(["ALL", "CORE", "RECOMMENDED", "EXTRA"] as const).map((t) => {
          const counts = wordlistTotals
            ? t === "ALL"
              ? wordlistTotals.total
              : wordlistTotals.byTier[t as WordTier]
            : "";
          return (
            <button
              key={t}
              onClick={() => { setTierFilter(t); setPage(1); }}
              className={`rounded-full border px-3 py-1 text-xs ${
                tierFilter === t ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white text-neutral-700"
              }`}
            >
              {t === "ALL" ? "全部" : TIER_LABELS[t as WordTier].zh} {counts !== "" && <span className="ml-1 opacity-70">{counts}</span>}
            </button>
          );
        })}
        <input
          className="ml-auto min-w-[180px] flex-1 rounded border border-neutral-300 bg-white px-2 py-1 text-sm"
          placeholder="搜索单词或释义..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {/* Word table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
            <th className="px-3 py-2 text-left font-medium">单词</th>
            <th className="px-3 py-2 text-left font-medium">词性</th>
            <th className="px-3 py-2 text-left font-medium">释义</th>
            <th className="px-3 py-2 text-left font-medium">等级</th>
            <th className="px-3 py-2 text-left font-medium">熟练度</th>
            <th className="px-3 py-2 text-left font-medium">上次复习</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={6} className="py-6 text-center text-neutral-400">加载中...</td></tr>
          ) : words.length === 0 ? (
            <tr><td colSpan={6} className="py-6 text-center text-neutral-400">暂无单词</td></tr>
          ) : (
            words.map((w) => <WordRow key={w.id} word={w} progress={progressByWord.get(w.id) ?? null} />)
          )}
        </tbody>
      </table>

      {/* Pagination */}
      {totalCount > 50 && (
        <div className="mt-4 flex items-center justify-between text-sm text-neutral-500">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-neutral-300 px-3 py-1 disabled:opacity-30"
          >
            ← 上一页
          </button>
          <span>第 {page} 页 / 共 {Math.ceil(totalCount / 50)} 页 ({totalCount} 词)</span>
          <button
            disabled={page * 50 >= totalCount}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-neutral-300 px-3 py-1 disabled:opacity-30"
          >
            下一页 →
          </button>
        </div>
      )}
    </div>
  );
}
