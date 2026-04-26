"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ExamType } from "@prisma/client";
import { CategoryCard } from "./CategoryCard";
import type { GrammarTopicDto, GrammarProgressStats } from "@/lib/grammar/types";

interface Props { examType: ExamType }

interface TopicsResponse {
  topics: GrammarTopicDto[];
  byCategory: Record<string, GrammarTopicDto[]>;
}

interface MistakesResponse {
  counts: { NEW: number; REVIEWED: number; MASTERED: number; total: number };
}

export default function GrammarHub({ examType }: Props) {
  const examLabelZh = examType === "KET" ? "KET" : "PET";
  const examLabelEn = examType === "KET" ? "A2 Key" : "B1 Preliminary";

  const [topicsByCategory, setTopicsByCategory] = useState<Record<string, GrammarTopicDto[]>>({});
  const [stats, setStats] = useState<GrammarProgressStats | null>(null);
  const [mistakeCount, setMistakeCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let aborted = false;
    Promise.all([
      fetch(`/api/grammar/topics?examType=${examType}`).then((r) => r.json() as Promise<TopicsResponse>),
      fetch(`/api/grammar/progress?examType=${examType}`).then((r) => r.json() as Promise<GrammarProgressStats>),
      fetch(`/api/grammar/mistakes?examType=${examType}&pageSize=1`).then((r) => r.json() as Promise<MistakesResponse>),
    ])
      .then(([topicsData, progressData, mistakesData]) => {
        if (aborted) return;
        setTopicsByCategory(topicsData.byCategory);
        setStats(progressData);
        setMistakeCount(mistakesData.counts.total);
        setLoading(false);
      })
      .catch((err) => {
        if (!aborted) {
          console.error("[grammar/hub] fetch failed:", err);
          setLoading(false);
        }
      });
    return () => { aborted = true; };
  }, [examType]);

  const topicStatMap = useMemo(() => {
    const m = new Map<string, { attempted: number; accuracy: number }>();
    if (stats) {
      for (const t of stats.perTopic) m.set(t.topicId, { attempted: t.attempted, accuracy: t.accuracy });
    }
    return m;
  }, [stats]);

  const accuracyPct = stats ? Math.round(stats.accuracy * 100) : 0;
  const totalAttempted = stats?.totalAttempted ?? 0;
  const showWeakPointCta = (stats?.weakTopics?.length ?? 0) > 0;
  const firstWeakTopicId = stats?.weakTopics?.[0];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <h1 className="mb-2 text-2xl font-semibold">{examLabelZh} 语法 · {examLabelEn} Grammar</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Cambridge {examLabelEn} 官方语法清单 · {Object.values(topicsByCategory).flat().length} 个主题
      </p>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-300 bg-white p-4">
          <div className="text-xs text-neutral-500">总答题</div>
          <div className="mt-1 text-2xl font-semibold text-neutral-900">{loading ? "—" : totalAttempted}</div>
        </div>
        <div className="rounded-lg border border-neutral-300 bg-white p-4">
          <div className="text-xs text-neutral-500">总正确率</div>
          <div className={`mt-1 text-2xl font-semibold ${accuracyPct >= 80 ? "text-green-600" : accuracyPct >= 50 ? "text-amber-600" : "text-red-600"}`}>
            {loading ? "—" : `${accuracyPct}%`}
          </div>
        </div>
        <div className="rounded-lg border border-neutral-300 bg-white p-4">
          <div className="text-xs text-neutral-500">错题</div>
          <div className={`mt-1 text-2xl font-semibold ${mistakeCount > 0 ? "text-red-600" : "text-neutral-900"}`}>
            {loading ? "—" : mistakeCount}
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Link
          href={`/${examType.toLowerCase()}/grammar/quiz`}
          className="rounded-lg border border-blue-600 bg-white p-4 transition hover:bg-blue-50"
        >
          <div className="text-sm font-semibold text-blue-700">🎲 随机混合</div>
          <div className="mt-1 text-xs text-neutral-500">10 题 · 跨主题</div>
        </Link>
        {showWeakPointCta && firstWeakTopicId ? (
          <Link
            href={`/${examType.toLowerCase()}/grammar/quiz?topicId=${encodeURIComponent(firstWeakTopicId)}`}
            className="rounded-lg border border-amber-600 bg-white p-4 transition hover:bg-amber-50"
          >
            <div className="text-sm font-semibold text-amber-700">⚠ 薄弱点专练</div>
            <div className="mt-1 text-xs text-neutral-500">{stats!.weakTopics.length} 个主题低于 60%</div>
          </Link>
        ) : (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 opacity-60">
            <div className="text-sm font-semibold text-neutral-500">⚠ 薄弱点专练</div>
            <div className="mt-1 text-xs text-neutral-400">{loading ? "加载中..." : "暂无薄弱点（多答题以解锁）"}</div>
          </div>
        )}
        <Link
          href={`/${examType.toLowerCase()}/grammar/mistakes`}
          className="rounded-lg border border-neutral-300 bg-white p-4 transition hover:border-neutral-900 hover:shadow-sm"
        >
          <div className="text-sm font-semibold">📓 错题复习</div>
          <div className="mt-1 text-xs text-neutral-500">{loading ? "—" : `${mistakeCount} 道待复习`}</div>
        </Link>
      </div>

      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">分类</div>

      {loading ? (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
          加载中...
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(topicsByCategory).map(([category, topics]) => (
            <CategoryCard
              key={category}
              examType={examType}
              category={category}
              topics={topics.map((t) => {
                const stat = topicStatMap.get(t.topicId);
                return {
                  topicId: t.topicId,
                  labelZh: t.labelZh,
                  attempted: stat?.attempted ?? 0,
                  accuracy: stat?.accuracy ?? 0,
                };
              })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
