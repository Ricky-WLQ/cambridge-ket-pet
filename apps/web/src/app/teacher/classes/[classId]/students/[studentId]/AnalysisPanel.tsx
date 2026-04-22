"use client";

import { useState } from "react";

type Analysis = {
  strengths: string[];
  weaknesses: string[];
  priority_actions: string[];
  narrative_zh: string;
};

type Props = {
  classId: string;
  studentId: string;
  studentName: string;
};

export default function AnalysisPanel({
  classId,
  studentId,
  studentName,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [focus, setFocus] = useState<"ALL" | "KET" | "PET">("ALL");

  async function run() {
    setError(null);
    setLoading(true);
    setAnalysis(null);
    try {
      const res = await fetch("/api/teacher/student-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          studentId,
          focusExamType: focus === "ALL" ? null : focus,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        analysis?: Analysis;
      };
      if (!res.ok || !data.analysis) {
        setError(data.error ?? "生成分析失败，请稍后重试");
        setLoading(false);
        return;
      }
      setAnalysis(data.analysis);
      setGeneratedAt(new Date());
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-purple-50/50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-indigo-900">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white"
              aria-hidden
            >
              AI
            </span>
            AI 教研分析
          </h3>
          <p className="mt-0.5 text-xs text-indigo-700/80">
            基于学生 {studentName} 的近期作答，综合考点分布与错题，由 AI 老师给出诊断建议
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-indigo-300">
            {(["ALL", "KET", "PET"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFocus(f)}
                disabled={loading}
                className={`px-2.5 py-1 text-xs font-medium transition ${
                  focus === f
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-indigo-700 hover:bg-indigo-50"
                } ${f !== "ALL" ? "border-l border-indigo-300" : ""}`}
              >
                {f === "ALL" ? "全部" : f}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading
              ? "分析中…（通常 15-30 秒）"
              : analysis
                ? "重新分析"
                : "生成分析"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && !analysis && (
        <div className="mt-4 space-y-2">
          <div className="h-4 w-2/5 animate-pulse rounded bg-indigo-100" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-indigo-100" />
          <div className="h-3 w-3/5 animate-pulse rounded bg-indigo-100" />
        </div>
      )}

      {!loading && !analysis && !error && (
        <div className="mt-4 text-sm text-indigo-800/70">
          点击右上方按钮开始生成。AI 会结合学生的成绩走势、写作四项能力平均、高频错误考点，给出四部分诊断：优势、薄弱点、重点练习方向、综合评语。
        </div>
      )}

      {analysis && (
        <div className="mt-5 space-y-5">
          <Section
            title="优势"
            items={analysis.strengths}
            accent="bg-green-100 text-green-900 border-green-200"
            badgeColor="bg-green-600"
          />
          <Section
            title="薄弱点"
            items={analysis.weaknesses}
            accent="bg-amber-100 text-amber-900 border-amber-200"
            badgeColor="bg-amber-600"
          />
          <Section
            title="重点练习方向"
            items={analysis.priority_actions}
            accent="bg-blue-100 text-blue-900 border-blue-200"
            badgeColor="bg-blue-600"
          />
          <div className="rounded-md border border-indigo-200 bg-white p-4">
            <div className="mb-2 text-sm font-semibold text-indigo-900">
              综合评语
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
              {analysis.narrative_zh}
            </p>
          </div>
          {generatedAt && (
            <div className="text-right text-[11px] text-indigo-700/60">
              生成于 {generatedAt.toLocaleString("zh-CN")} · 分析仅供参考，请结合你对学生的判断使用
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  items,
  accent,
  badgeColor,
}: {
  title: string;
  items: string[];
  accent: string;
  badgeColor: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={`rounded-md border p-4 ${accent}`}>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span
          className={`inline-block h-2 w-2 rounded-full ${badgeColor}`}
          aria-hidden
        />
        {title}
      </div>
      <ul className="space-y-1.5 text-sm leading-relaxed">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="shrink-0 text-neutral-400">{i + 1}.</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
