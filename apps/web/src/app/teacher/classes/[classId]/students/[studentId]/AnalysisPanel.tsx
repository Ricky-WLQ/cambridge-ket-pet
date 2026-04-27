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
    <div
      className="rounded-3xl border-2 border-ink/10 p-6 stitched-card"
      style={{
        background: "linear-gradient(135deg, #ede7ff 0%, #e4efff 100%)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-extrabold text-ink">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs font-extrabold text-white"
              aria-hidden
            >
              AI
            </span>
            AI 教研分析
          </h3>
          <p className="mt-0.5 text-xs font-medium text-ink/70">
            基于学生 {studentName} 的近期作答，综合考点分布与错题，由 AI 老师给出诊断建议
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-full border-2 border-ink/15">
            {(["ALL", "KET", "PET"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFocus(f)}
                disabled={loading}
                className={`px-2.5 py-1 text-xs font-bold transition ${
                  focus === f
                    ? "bg-ink text-white"
                    : "bg-white text-ink hover:bg-ink/5"
                } ${f !== "ALL" ? "border-l-2 border-ink/15" : ""}`}
              >
                {f === "ALL" ? "全部" : f}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="rounded-full bg-ink px-3 py-1.5 text-sm font-extrabold text-white transition hover:bg-ink/90 disabled:opacity-60"
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
        <div className="mt-4 rounded-xl border-2 border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {loading && !analysis && (
        <div className="mt-4 space-y-2">
          <div className="h-4 w-2/5 animate-pulse rounded bg-ink/10" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-ink/10" />
          <div className="h-3 w-3/5 animate-pulse rounded bg-ink/10" />
        </div>
      )}

      {!loading && !analysis && !error && (
        <div className="mt-4 text-sm font-medium text-ink/75">
          点击右上方按钮开始生成。AI 会结合学生的成绩走势、写作四项能力平均、高频错误考点，给出四部分诊断：优势、薄弱点、重点练习方向、综合评语。
        </div>
      )}

      {analysis && (
        <div className="mt-5 space-y-5">
          <Section
            title="优势"
            items={analysis.strengths}
            accent="bg-mint-tint border-2 border-ink/10"
            badgeColor="bg-green-600"
          />
          <Section
            title="薄弱点"
            items={analysis.weaknesses}
            accent="bg-butter-tint border-2 border-ink/10"
            badgeColor="bg-amber-600"
          />
          <Section
            title="重点练习方向"
            items={analysis.priority_actions}
            accent="bg-sky-tint border-2 border-ink/10"
            badgeColor="bg-blue-600"
          />
          <div className="rounded-2xl border-2 border-ink/10 bg-white p-4 stitched-card">
            <div className="mb-2 text-sm font-extrabold text-ink">综合评语</div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/85">
              {analysis.narrative_zh}
            </p>
          </div>
          {generatedAt && (
            <div className="text-right text-[11px] font-medium text-ink/55">
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
    <div className={`rounded-2xl p-4 ${accent}`}>
      <div className="mb-2 flex items-center gap-2 text-sm font-extrabold text-ink">
        <span
          className={`inline-block h-2 w-2 rounded-full ${badgeColor}`}
          aria-hidden
        />
        {title}
      </div>
      <ul className="space-y-1.5 text-sm leading-relaxed">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="shrink-0 text-ink/40">{i + 1}.</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
