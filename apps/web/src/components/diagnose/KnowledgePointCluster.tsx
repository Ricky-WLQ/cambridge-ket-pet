"use client";

/**
 * Renders one knowledge-point cluster in the diagnose report.
 *
 * Shape (per the v2 plan, mirrors pretco-app's 8-category report):
 *  - severity badge (red/amber/neutral)
 *  - knowledge point title + category chip
 *  - mini-lesson body
 *  - rule callout
 *  - expandable example sentences (<details>)
 *  - expandable per-question whyWrong details (<details>)
 *
 * `<details>` is a native disclosure widget — accessible by default and works
 * without any client JS for the open/close behavior. The "use client" directive
 * is here only to allow this component to nest inside other client components
 * without triggering a server-vs-client boundary mismatch in `DiagnoseReport`.
 *
 * Style: same neutral palette as `AnalysisPanel.tsx`, keyed to severity.
 */
import type {
  KnowledgePointCategory,
  KnowledgePointGroup,
  KnowledgePointSeverity,
} from "@/lib/diagnose/types";

const SEVERITY_STYLE: Record<
  KnowledgePointSeverity,
  { border: string; bg: string; pill: string; label: string }
> = {
  critical: {
    border: "border-rose-300",
    bg: "bg-rose-50/40",
    pill: "bg-rose-600 text-white",
    label: "严重",
  },
  moderate: {
    border: "border-amber-300",
    bg: "bg-amber-50/40",
    pill: "bg-amber-600 text-white",
    label: "中等",
  },
  minor: {
    border: "border-ink/20",
    bg: "bg-white",
    pill: "bg-ink/65 text-white",
    label: "轻微",
  },
};

const CATEGORY_ZH: Record<KnowledgePointCategory, string> = {
  grammar: "语法",
  collocation: "搭配",
  vocabulary: "词汇",
  sentence_pattern: "句型",
  reading_skill: "阅读技巧",
  listening_skill: "听力技巧",
  cambridge_strategy: "考试策略",
  writing_skill: "写作技巧",
};

const SECTION_ZH: Record<string, string> = {
  READING: "阅读",
  LISTENING: "听力",
  WRITING: "写作",
  SPEAKING: "口语",
  VOCAB: "词汇",
  GRAMMAR: "语法",
};

interface Props {
  group: KnowledgePointGroup;
}

export default function KnowledgePointCluster({ group }: Props) {
  const sev = SEVERITY_STYLE[group.severity];
  const categoryLabel = CATEGORY_ZH[group.category] ?? group.category;

  return (
    <article
      className={`rounded-2xl border-2 p-4 stitched-card ${sev.border} ${sev.bg}`}
    >
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${sev.pill}`}
        >
          {sev.label}
        </span>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-ink/75 ring-1 ring-inset ring-ink/15">
          {categoryLabel}
        </span>
        <h3 className="text-xl font-extrabold text-ink/90">
          {group.knowledgePoint}
        </h3>
        <span className="text-xs font-bold text-ink/55">
          ({group.questions.length} 题)
        </span>
      </header>

      {group.miniLesson && (
        <p className="mb-3 text-sm leading-relaxed text-ink/85">
          {group.miniLesson}
        </p>
      )}

      {group.rule && (
        <div className="mb-3 rounded-xl border-2 border-sky-soft bg-sky-tint p-3 text-sm italic text-sky-900">
          <span className="mr-1 font-extrabold not-italic">规则：</span>
          {group.rule}
        </div>
      )}

      {group.exampleSentences.length > 0 && (
        <details className="mb-2 rounded-xl border-2 border-ink/10 bg-white p-3 text-sm">
          <summary className="cursor-pointer text-xs font-extrabold text-ink/70 hover:text-ink">
            例句 ({group.exampleSentences.length})
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-ink/80">
            {group.exampleSentences.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </details>
      )}

      {group.questions.length > 0 && (
        <details className="rounded-xl border-2 border-ink/10 bg-white p-3 text-sm">
          <summary className="cursor-pointer text-xs font-extrabold text-ink/70 hover:text-ink">
            为什么错 ({group.questions.length})
          </summary>
          <ol className="mt-2 space-y-3">
            {group.questions.map((q, i) => (
              <li key={i} className="border-l-2 border-ink/15 pl-3">
                <div className="mb-1 flex items-center gap-2 text-[11px] text-ink/55">
                  <span className="rounded bg-ink/5 px-1.5 py-0.5 font-bold text-ink/75">
                    {SECTION_ZH[q.section] ?? q.section}
                  </span>
                </div>
                <p className="mb-1 text-ink/85">
                  <span className="text-ink/55">题目：</span>
                  {q.questionText}
                </p>
                <p className="mb-1 text-xs text-ink/75">
                  <span className="text-rose-600">你选：</span>
                  {q.userAnswer || "(未作答)"}
                  <span className="ml-3 text-emerald-700">正确：</span>
                  {q.correctAnswer}
                </p>
                <p className="text-xs leading-relaxed text-ink/75">
                  <span className="font-extrabold text-ink/90">解析：</span>
                  {q.whyWrong}
                </p>
              </li>
            ))}
          </ol>
        </details>
      )}
    </article>
  );
}
