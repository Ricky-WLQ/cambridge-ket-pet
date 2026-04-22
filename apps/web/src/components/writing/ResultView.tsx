type Scores = {
  content: number;
  communicative: number;
  organisation: number;
  language: number;
};

type StoredWritingResult = {
  scores: Scores;
  feedback_zh: string;
  specific_suggestions_zh: string[];
};

type WritingPayload = {
  prompt: string;
  content_points: string[];
  scene_descriptions?: string[];
  options?: Array<{ label: string; prompt: string; content_points: string[] }>;
};

export type WritingResultViewProps = {
  examType: "KET" | "PET";
  part: number;
  mode: "PRACTICE" | "MOCK";
  totalBand: number;
  scaledScore: number;
  payload: WritingPayload;
  stored: StoredWritingResult;
  userAnswers: Record<string, string>;
};

const CRITERIA: Array<{
  key: keyof Scores;
  labelZh: string;
  labelEn: string;
}> = [
  { key: "content", labelZh: "内容", labelEn: "Content" },
  { key: "communicative", labelZh: "沟通效果", labelEn: "Communicative" },
  { key: "organisation", labelZh: "结构", labelEn: "Organisation" },
  { key: "language", labelZh: "语言", labelEn: "Language" },
];

export default function WritingResultView({
  examType,
  part,
  mode,
  totalBand,
  scaledScore,
  payload,
  stored,
  userAnswers,
}: WritingResultViewProps) {
  const colorClass =
    scaledScore >= 70
      ? "text-green-700"
      : scaledScore >= 50
        ? "text-amber-700"
        : "text-red-700";

  const chosenOption = userAnswers.chosenOption;
  const activePrompt =
    chosenOption && payload.options
      ? payload.options.find((o) => o.label === chosenOption)
      : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <h1 className="text-xl font-semibold">
        {examType} 写作 · Part {part} · 成绩
      </h1>
      <p className="text-sm text-neutral-500">
        {mode === "MOCK" ? "模拟考试" : "练习模式"}
      </p>

      <div className="mt-6 rounded-md border border-neutral-300 p-6 text-center">
        <div className="text-xs uppercase tracking-wider text-neutral-500">
          总分
        </div>
        <div className={`mt-1 text-4xl font-bold ${colorClass}`}>
          {totalBand}
          <span className="text-xl text-neutral-400"> / 20</span>
        </div>
        <div className="mt-1 text-lg text-neutral-600">{scaledScore}%</div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {CRITERIA.map((c) => {
          const s = stored.scores?.[c.key] ?? 0;
          const pct = Math.round((s / 5) * 100);
          const barColor =
            pct >= 70 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
          return (
            <div
              key={c.key}
              className="rounded-md border border-neutral-200 p-4 text-center"
            >
              <div className="text-xs text-neutral-500">{c.labelEn}</div>
              <div className="text-[11px] text-neutral-400">{c.labelZh}</div>
              <div className="mt-1 text-2xl font-bold">
                {s}
                <span className="text-sm text-neutral-400"> / 5</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={`h-full ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {stored.feedback_zh && (
        <div className="mt-6 rounded-md border border-blue-200 bg-blue-50 p-4">
          <div className="mb-2 text-sm font-medium text-blue-900">评语</div>
          <p className="whitespace-pre-wrap text-sm text-blue-900">
            {stored.feedback_zh}
          </p>
        </div>
      )}

      {stored.specific_suggestions_zh &&
        stored.specific_suggestions_zh.length > 0 && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4">
            <div className="mb-2 text-sm font-medium text-amber-900">
              改进建议
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
              {stored.specific_suggestions_zh.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}

      <div className="mt-8 rounded-md border border-neutral-200 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          题目
          {chosenOption && (
            <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-normal text-neutral-700">
              选项 {chosenOption}
            </span>
          )}
        </div>
        <div className="whitespace-pre-wrap text-sm text-neutral-700">
          {activePrompt ? activePrompt.prompt : payload.prompt}
        </div>
        {(() => {
          const cps = activePrompt?.content_points ?? payload.content_points;
          return cps && cps.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-700">
              {cps.map((cp, i) => (
                <li key={i}>{cp}</li>
              ))}
            </ul>
          ) : null;
        })()}
      </div>

      <div className="mt-4 rounded-md border border-neutral-200 p-4">
        <div className="mb-2 text-sm font-medium">学生作文</div>
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
          {userAnswers.response ?? ""}
        </div>
        <div className="mt-2 text-xs text-neutral-400">
          字数：
          {(userAnswers.response ?? "").trim().split(/\s+/).filter(Boolean).length}
        </div>
      </div>
    </div>
  );
}
