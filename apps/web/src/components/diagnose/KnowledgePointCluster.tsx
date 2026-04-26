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
    border: "border-red-300",
    bg: "bg-red-50/40",
    pill: "bg-red-600 text-white",
    label: "严重",
  },
  moderate: {
    border: "border-amber-300",
    bg: "bg-amber-50/40",
    pill: "bg-amber-600 text-white",
    label: "中等",
  },
  minor: {
    border: "border-neutral-300",
    bg: "bg-white",
    pill: "bg-neutral-600 text-white",
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
      className={`rounded-md border p-4 ${sev.border} ${sev.bg}`}
    >
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${sev.pill}`}
        >
          {sev.label}
        </span>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-neutral-700 ring-1 ring-inset ring-neutral-300">
          {categoryLabel}
        </span>
        <h3 className="text-sm font-semibold text-neutral-900">
          {group.knowledgePoint}
        </h3>
        <span className="text-xs text-neutral-500">
          ({group.questions.length} 题)
        </span>
      </header>

      {group.miniLesson && (
        <p className="mb-3 text-sm leading-relaxed text-neutral-800">
          {group.miniLesson}
        </p>
      )}

      {group.rule && (
        <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <span className="mr-1 font-semibold">规则：</span>
          {group.rule}
        </div>
      )}

      {group.exampleSentences.length > 0 && (
        <details className="mb-2 rounded-md border border-neutral-200 bg-white p-3 text-sm">
          <summary className="cursor-pointer text-xs font-medium text-neutral-700 hover:text-neutral-900">
            例句 ({group.exampleSentences.length})
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-neutral-800">
            {group.exampleSentences.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </details>
      )}

      {group.questions.length > 0 && (
        <details className="rounded-md border border-neutral-200 bg-white p-3 text-sm">
          <summary className="cursor-pointer text-xs font-medium text-neutral-700 hover:text-neutral-900">
            为什么错 ({group.questions.length})
          </summary>
          <ol className="mt-2 space-y-3">
            {group.questions.map((q, i) => (
              <li key={i} className="border-l-2 border-neutral-200 pl-3">
                <div className="mb-1 flex items-center gap-2 text-[11px] text-neutral-500">
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-700">
                    {SECTION_ZH[q.section] ?? q.section}
                  </span>
                </div>
                <p className="mb-1 text-neutral-800">
                  <span className="text-neutral-500">题目：</span>
                  {q.questionText}
                </p>
                <p className="mb-1 text-xs text-neutral-700">
                  <span className="text-red-600">你选：</span>
                  {q.userAnswer || "(未作答)"}
                  <span className="ml-3 text-green-700">正确：</span>
                  {q.correctAnswer}
                </p>
                <p className="text-xs leading-relaxed text-neutral-700">
                  <span className="font-medium text-neutral-900">解析：</span>
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
