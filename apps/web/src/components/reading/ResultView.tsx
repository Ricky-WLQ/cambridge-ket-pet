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
  const passRate = scaledScore;
  const scoreColor =
    passRate >= 70
      ? "text-green-700"
      : passRate >= 50
        ? "text-amber-700"
        : "text-red-700";

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {/* Header + summary */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold">
          {examType} 阅读 · Part {part} · 成绩
        </h1>
        <p className="text-sm text-neutral-500">
          {mode === "MOCK" ? "模拟考试" : "练习模式"}
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-md border border-neutral-200 p-4 text-center">
          <div className="text-xs uppercase tracking-wider text-neutral-500">
            得分
          </div>
          <div className={`mt-1 text-3xl font-bold ${scoreColor}`}>
            {scaledScore}%
          </div>
        </div>
        <div className="rounded-md border border-neutral-200 p-4 text-center">
          <div className="text-xs uppercase tracking-wider text-neutral-500">
            正确题数
          </div>
          <div className="mt-1 text-3xl font-semibold">
            {rawScore}
            <span className="text-xl text-neutral-400"> / {totalPossible}</span>
          </div>
        </div>
        <div className="rounded-md border border-neutral-200 p-4 text-center">
          <div className="text-xs uppercase tracking-wider text-neutral-500">
            错题数
          </div>
          <div className="mt-1 text-3xl font-semibold">
            {totalPossible - rawScore}
          </div>
        </div>
      </div>

      {/* Weak points */}
      {(weakPoints.examPoints.length > 0 ||
        weakPoints.difficultyPoints.length > 0) && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4">
          <div className="mb-3 text-sm font-medium text-amber-900">
            薄弱点分析
          </div>
          {weakPoints.examPoints.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 text-xs font-medium text-amber-800">
                考点 (Exam Points)
              </div>
              <ul className="space-y-1">
                {weakPoints.examPoints.map((ep) => (
                  <li key={ep.id} className="text-sm">
                    <span className="font-mono text-xs text-amber-700">
                      {ep.id}
                    </span>{" "}
                    · {ep.descriptionZh || ep.label}{" "}
                    <span className="text-xs text-amber-700">
                      （{ep.errorCount} 错）
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {weakPoints.difficultyPoints.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-medium text-amber-800">
                难点 (Difficulty Points)
              </div>
              <ul className="space-y-1">
                {weakPoints.difficultyPoints.map((dp) => (
                  <li key={dp.id} className="text-sm">
                    <span className="font-mono text-xs text-amber-700">
                      {dp.id}
                    </span>{" "}
                    · {dp.descriptionZh || dp.label}{" "}
                    <span className="text-xs text-amber-700">
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
        <div className="mb-6 whitespace-pre-wrap rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-relaxed">
          {passage}
        </div>
      )}

      {/* Per-question breakdown */}
      <ol className="space-y-4">
        {questions.map((q, idx) => {
          const ua = userAnswers[q.id] ?? "";
          const blank = ua.trim().length === 0;
          const correct = isCorrect(q, ua);
          return (
            <li
              key={q.id}
              className={`rounded-md border p-4 ${
                correct
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
              }`}
            >
              <div className="mb-2 flex items-start gap-2">
                <span
                  className={`inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-medium text-white ${
                    correct ? "bg-green-600" : "bg-red-600"
                  }`}
                >
                  {idx + 1}
                </span>
                <div className="flex-1 whitespace-pre-wrap text-sm">
                  {q.prompt}
                </div>
                {blank && (
                  <span
                    className="shrink-0 rounded-full bg-orange-200 px-2 py-0.5 text-xs font-medium text-orange-900"
                    aria-label="本题未作答"
                  >
                    未作答
                  </span>
                )}
                <span
                  className={`text-lg ${
                    correct ? "text-green-600" : "text-red-600"
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
                      ? "border-green-500 bg-green-100 text-green-900"
                      : isUserChoice
                        ? "border-red-500 bg-red-100 text-red-900"
                        : "border-neutral-200 bg-white text-neutral-700";
                    return (
                      <div
                        key={letter}
                        className={`rounded-md border px-3 py-1.5 text-sm ${classes}`}
                      >
                        <strong className="mr-2">{letter}.</strong>
                        {opt}
                        {isAnswer && (
                          <span className="ml-2 text-xs font-medium">
                            （正确答案）
                          </span>
                        )}
                        {isUserChoice && !isAnswer && (
                          <span className="ml-2 text-xs font-medium">
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
                  <div className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm">
                    <div className="text-xs text-neutral-500">你的作答</div>
                    <div
                      className={`mt-0.5 font-mono ${correct ? "text-green-700" : "text-red-700"}`}
                    >
                      {ua || <span className="text-neutral-400">（未作答）</span>}
                    </div>
                  </div>
                  <div className="rounded-md border border-green-300 bg-white px-3 py-2 text-sm">
                    <div className="text-xs text-neutral-500">正确答案</div>
                    <div className="mt-0.5 font-mono text-green-700">
                      {q.answer}
                    </div>
                  </div>
                </div>
              )}

              {/* Explanation */}
              <div className="rounded-md bg-white/60 p-3 text-sm text-neutral-800">
                <div className="text-xs font-medium text-neutral-500">解析</div>
                <div className="mt-1 whitespace-pre-wrap leading-relaxed">
                  {q.explanation_zh}
                </div>
              </div>

              {/* Tags */}
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-neutral-200 px-2 py-0.5 font-mono text-neutral-700">
                  {q.exam_point_id}
                </span>
                {q.difficulty_point_id && (
                  <span className="rounded-full bg-neutral-200 px-2 py-0.5 font-mono text-neutral-700">
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
