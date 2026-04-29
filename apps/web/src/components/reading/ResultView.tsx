import { Mascot } from "@/components/Mascot";
import type { GradableQuestionType } from "@/lib/grading";

type ResultQuestion = {
  id: string;
  type: GradableQuestionType;
  prompt: string;
  options: string[] | null;
  answer: string;
  explanation_zh: string;
  exam_point_id: string;
  difficulty_point_id: string | null;
};

type WeakPointWithLabel = {
  id: string;
  errorCount: number;
  label: string;
  descriptionZh: string;
};

export type ResultViewProps = {
  examType: "KET" | "PET";
  part: number;
  mode: "PRACTICE" | "MOCK";
  rawScore: number;
  totalPossible: number;
  scaledScore: number;
  userAnswers: Record<string, string>;
  passage: string | null;
  questions: ResultQuestion[];
  weakPoints: {
    examPoints: WeakPointWithLabel[];
    difficultyPoints: WeakPointWithLabel[];
  };
};

function isLetterType(t: GradableQuestionType): boolean {
  return (
    t === "MCQ" ||
    t === "MCQ_CLOZE" ||
    t === "MATCHING" ||
    t === "GAPPED_TEXT"
  );
}

function isCorrect(q: ResultQuestion, userAnswer: string): boolean {
  const ua = userAnswer.trim();
  if (!ua) return false;
  if (isLetterType(q.type)) {
    return ua.toUpperCase() === q.answer.trim().toUpperCase();
  }
  const normalize = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[.,!?;:'"`()[\]{}\-_‘’“”]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  return normalize(userAnswer) === normalize(q.answer);
}

export default function ResultView({
  examType,
  part,
  mode,
  rawScore,
  totalPossible,
  scaledScore,
  userAnswers,
  passage,
  questions,
  weakPoints,
}: ResultViewProps) {
  // Defensive: legacy attempts can have payload.questions absent. Page-side
  // already defaults to []; this is belt-and-suspenders for any new caller.
  const safeQuestions = questions ?? [];
  const passRate = scaledScore;
  const scoreColor =
    passRate >= 70
      ? "text-green-700"
      : passRate >= 50
        ? "text-amber-700"
        : "text-red-700";

  const portal = examType === "KET" ? "ket" : "pet";
  return (
    <div className="mx-auto max-w-3xl w-full">
      {/* Compact mascot strip header. */}
      <div className="mb-5 flex items-center gap-3 px-1">
        <Mascot
          pose={passRate >= 70 ? "celebrating" : passRate >= 50 ? "thinking" : "confused"}
          portal={portal}
          width={56}
          height={56}
          decorative
        />
        <div className="flex-1">
          <h1 className="text-base font-extrabold leading-tight">
            {examType} 阅读 · Part {part}
          </h1>
          <p className="mt-0.5 text-xs font-medium text-ink/60">
            {mode === "MOCK" ? "模拟考试" : "练习模式"}
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="stat-card tile-lavender text-center stitched-card">
          <div className="text-[11px] font-extrabold uppercase tracking-widest text-ink/60">
            得分
          </div>
          <div className={`mt-1 text-3xl font-extrabold ${scoreColor}`}>
            {scaledScore}%
          </div>
        </div>
        <div className="stat-card tile-sky text-center stitched-card">
          <div className="text-[11px] font-extrabold uppercase tracking-widest text-ink/60">
            正确题数
          </div>
          <div className="mt-1 text-3xl font-extrabold">
            {rawScore}
            <span className="text-xl font-bold text-ink/40"> / {totalPossible}</span>
          </div>
        </div>
        <div className="stat-card tile-peach text-center stitched-card">
          <div className="text-[11px] font-extrabold uppercase tracking-widest text-ink/60">
            错题数
          </div>
          <div className="mt-1 text-3xl font-extrabold">
            {totalPossible - rawScore}
          </div>
        </div>
      </div>

      {/* Weak points */}
      {(weakPoints.examPoints.length > 0 ||
        weakPoints.difficultyPoints.length > 0) && (
        <div className="mb-6 rounded-2xl bg-mint-tint border-2 border-ink/10 p-4 stitched-card">
          <div className="mb-3 text-sm font-extrabold text-ink">
            薄弱点分析
          </div>
          {weakPoints.examPoints.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 text-xs font-extrabold text-ink/75">
                考点 (Exam Points)
              </div>
              <ul className="space-y-1">
                {weakPoints.examPoints.map((ep) => (
                  <li key={ep.id} className="text-sm text-ink/85">
                    <span className="font-mono text-xs text-ink/65">
                      {ep.id}
                    </span>{" "}
                    · {ep.descriptionZh || ep.label}{" "}
                    <span className="text-xs text-ink/65 font-bold">
                      （{ep.errorCount} 错）
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {weakPoints.difficultyPoints.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-extrabold text-ink/75">
                难点 (Difficulty Points)
              </div>
              <ul className="space-y-1">
                {weakPoints.difficultyPoints.map((dp) => (
                  <li key={dp.id} className="text-sm text-ink/85">
                    <span className="font-mono text-xs text-ink/65">
                      {dp.id}
                    </span>{" "}
                    · {dp.descriptionZh || dp.label}{" "}
                    <span className="text-xs text-ink/65 font-bold">
                      （{dp.errorCount} 错）
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Passage */}
      {passage && (
        <div className="mb-6 whitespace-pre-wrap rounded-2xl bg-mist border-2 border-ink/10 p-4 text-sm leading-relaxed stitched-card">
          {passage}
        </div>
      )}

      {/* Per-question breakdown */}
      <ol className="space-y-4">
        {safeQuestions.map((q, idx) => {
          const ua = userAnswers[q.id] ?? "";
          const blank = ua.trim().length === 0;
          const correct = isCorrect(q, ua);
          return (
            <li
              key={q.id}
              className={`rounded-2xl border-2 p-4 stitched-card ${
                correct
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-rose-200 bg-rose-50"
              }`}
            >
              <div className="mb-2 flex items-start gap-2.5">
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full px-1.5 text-xs font-extrabold text-white ${
                    correct ? "bg-emerald-600" : "bg-rose-600"
                  }`}
                >
                  {idx + 1}
                </span>
                <div className="flex-1 whitespace-pre-wrap text-sm font-bold">
                  {q.prompt}
                </div>
                {blank && (
                  <span
                    className="shrink-0 pill-tag bg-amber-100 text-amber-900 border-2 border-amber-300 !text-xs"
                    aria-label="本题未作答"
                  >
                    未作答
                  </span>
                )}
                <span
                  className={`text-xl font-extrabold ${
                    correct ? "text-emerald-600" : "text-rose-600"
                  }`}
                  aria-label={correct ? "正确" : "错误"}
                >
                  {correct ? "✓" : "✗"}
                </span>
              </div>

              {/* MCQ-family with options: show all options with highlights */}
              {(q.type === "MCQ" || q.type === "MCQ_CLOZE") && q.options && (
                <div className="mb-3 space-y-1">
                  {q.options.map((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const isUserChoice =
                      ua.trim().toUpperCase() === letter;
                    const isAnswer =
                      q.answer.trim().toUpperCase() === letter;
                    const classes = isAnswer
                      ? "border-emerald-500 bg-emerald-100 text-emerald-900"
                      : isUserChoice
                        ? "border-rose-500 bg-rose-100 text-rose-900"
                        : "border-ink/15 bg-white text-ink/85";
                    return (
                      <div
                        key={letter}
                        className={`rounded-xl border-2 px-3 py-1.5 text-sm ${classes}`}
                      >
                        <strong className="mr-2">{letter}.</strong>
                        {opt}
                        {isAnswer && (
                          <span className="ml-2 text-xs font-extrabold">
                            （正确答案）
                          </span>
                        )}
                        {isUserChoice && !isAnswer && (
                          <span className="ml-2 text-xs font-extrabold">
                            （你的作答）
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Non-MCQ types: show user answer + correct answer side by side */}
              {!((q.type === "MCQ" || q.type === "MCQ_CLOZE") && q.options) && (
                <div className="mb-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border-2 border-ink/15 bg-white px-3 py-2 text-sm">
                    <div className="text-xs text-ink/55 font-bold">你的作答</div>
                    <div
                      className={`mt-0.5 font-mono font-bold ${correct ? "text-emerald-700" : "text-rose-700"}`}
                    >
                      {ua || <span className="text-ink/40">（未作答）</span>}
                    </div>
                  </div>
                  <div className="rounded-xl border-2 border-emerald-300 bg-white px-3 py-2 text-sm">
                    <div className="text-xs text-ink/55 font-bold">正确答案</div>
                    <div className="mt-0.5 font-mono font-bold text-emerald-700">
                      {q.answer}
                    </div>
                  </div>
                </div>
              )}

              {/* Explanation */}
              <div className="rounded-xl bg-white/70 p-3 text-sm text-ink/85">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-ink/55">解析</div>
                <div className="mt-1 whitespace-pre-wrap leading-relaxed">
                  {q.explanation_zh}
                </div>
              </div>

              {/* Tags */}
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-ink/10 px-2 py-0.5 font-mono text-ink/75">
                  {q.exam_point_id}
                </span>
                {q.difficulty_point_id && (
                  <span className="rounded-full bg-ink/10 px-2 py-0.5 font-mono text-ink/75">
                    {q.difficulty_point_id}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
