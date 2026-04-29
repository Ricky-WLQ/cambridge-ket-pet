import { Mascot } from "@/components/Mascot";

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

  const portal = examType === "KET" ? "ket" : "pet";
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-5 flex items-center gap-3 px-1">
        <Mascot
          pose={scaledScore >= 70 ? "celebrating" : scaledScore >= 50 ? "thinking" : "confused"}
          portal={portal}
          width={56}
          height={56}
          decorative
        />
        <div className="flex-1">
          <h1 className="text-base font-extrabold leading-tight">
            {examType} 写作 · Part {part}
          </h1>
          <p className="mt-0.5 text-xs font-medium text-ink/60">
            {mode === "MOCK" ? "模拟考试" : "练习模式"}
          </p>
        </div>
      </div>

      <div className="stitched-card rounded-2xl bg-butter-tint p-6 text-center border-2 border-ink/10">
        <div className="text-xs font-bold uppercase tracking-widest text-ink/60">
          总分
        </div>
        <div className={`mt-1 text-5xl font-extrabold ${colorClass}`}>
          {totalBand}
          <span className="text-2xl text-ink/30"> / 20</span>
        </div>
        <div className="mt-1 text-base text-ink/70 font-bold">{scaledScore}%</div>
      </div>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {CRITERIA.map((c) => {
          const s = stored.scores?.[c.key] ?? 0;
          const pct = Math.round((s / 5) * 100);
          const barColor =
            pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-rose-500";
          return (
            <div
              key={c.key}
              className="rounded-xl border-2 border-ink/10 bg-white p-3 text-center"
            >
              <div className="text-xs font-bold text-ink/60">{c.labelEn}</div>
              <div className="text-[10px] text-ink/40">{c.labelZh}</div>
              <div className="mt-1 text-2xl font-extrabold">
                {s}
                <span className="text-sm text-ink/30"> / 5</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
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
        <div className="mt-6 rounded-xl tile-sky border-2 border-ink/10 p-4">
          <div className="mb-2 text-sm font-extrabold text-ink">评语</div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/85">
            {stored.feedback_zh}
          </p>
        </div>
      )}

      {stored.specific_suggestions_zh &&
        stored.specific_suggestions_zh.length > 0 && (
          <div className="mt-4 rounded-xl tile-butter border-2 border-ink/10 p-4">
            <div className="mb-2 text-sm font-extrabold text-ink">
              改进建议
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink/85">
              {stored.specific_suggestions_zh.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}

      <div className="mt-8 rounded-xl bg-white border-2 border-ink/10 p-4 stitched-card">
        <div className="mb-2 flex items-center gap-2 text-sm font-extrabold text-ink">
          题目
          {chosenOption && (
            <span className="pill-tag bg-ink/10 text-ink !text-xs">
              选项 {chosenOption}
            </span>
          )}
        </div>
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink/85">
          {activePrompt ? activePrompt.prompt : payload.prompt}
        </div>
        {(() => {
          const cps = activePrompt?.content_points ?? payload.content_points;
          return cps && cps.length > 0 ? (
            <ul className="list-disc pl-5 mt-3 text-sm text-ink/80 space-y-1">
              {cps.map((cp, i) => (
                <li key={i}>{cp}</li>
              ))}
            </ul>
          ) : null;
        })()}
      </div>

      <div className="mt-4 rounded-xl bg-white border-2 border-ink/10 p-4 stitched-card">
        <div className="mb-2 text-sm font-extrabold text-ink">学生作文</div>
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-ink/90">
          {userAnswers.response ?? ""}
        </div>
        <div className="mt-3 text-xs text-ink/50 font-bold">
          字数：
          {(userAnswers.response ?? "").trim().split(/\s+/).filter(Boolean).length}
        </div>
      </div>
    </div>
  );
}
