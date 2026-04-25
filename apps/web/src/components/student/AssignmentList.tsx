import Link from "next/link";
import type { StudentAssignment } from "@/lib/assignments";

type Props = {
  examType: "KET" | "PET";
  assignments: StudentAssignment[];
};

const KIND_ZH: Record<string, string> = {
  READING: "阅读",
  WRITING: "写作",
  LISTENING: "听力",
};

function targetHref(a: StudentAssignment): string {
  const portal = a.examType === "KET" ? "ket" : "pet";
  const section =
    a.kind === "READING"
      ? "reading"
      : a.kind === "LISTENING"
        ? "listening"
        : "writing";
  const qs = a.part != null ? `?part=${a.part}` : "";
  return `/${portal}/${section}/new${qs}`;
}

export default function AssignmentList({ examType, assignments }: Props) {
  if (assignments.length === 0) return null;

  const pending = assignments.filter((a) => !a.completed);
  const done = assignments.filter((a) => a.completed);

  return (
    <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-blue-900">
          {examType} 作业
        </h2>
        <span className="text-xs text-blue-800/80">
          已完成 {done.length} / {assignments.length}
        </span>
      </div>

      {pending.length > 0 && (
        <ul className="space-y-2">
          {pending.map((a) => {
            const overdue = a.dueAt !== null && a.dueAt < new Date();
            const kindZh = KIND_ZH[a.kind] ?? a.kind;
            return (
              <li
                key={a.id}
                className="rounded-md border border-blue-200 bg-white p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{a.title}</span>
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                        {a.examType} {kindZh}
                        {a.part != null && ` Part ${a.part}`}
                      </span>
                      {a.minScore != null && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                          需 ≥ {a.minScore}%
                        </span>
                      )}
                      {a.dueAt && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            overdue
                              ? "bg-red-100 text-red-800"
                              : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          {overdue ? "已过期 " : "截止 "}
                          {a.dueAt.toLocaleDateString("zh-CN")}
                        </span>
                      )}
                    </div>
                    {a.description && (
                      <p className="mt-1 text-xs text-neutral-600">
                        {a.description}
                      </p>
                    )}
                    <div className="mt-1 text-xs text-neutral-400">
                      来自班级 {a.className}
                      {a.attemptsCount > 0 &&
                        a.bestScore !== null &&
                        ` · 已做过 ${a.attemptsCount} 次，最高 ${a.bestScore}%`}
                    </div>
                  </div>
                  <Link
                    href={targetHref(a)}
                    className="shrink-0 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
                  >
                    去完成 →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pending.length === 0 && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          🎉 当前所有作业都已完成。
        </div>
      )}

      {done.length > 0 && pending.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-blue-800/70 hover:text-blue-900">
            已完成 {done.length} 项（点击展开）
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-neutral-600">
            {done.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span>{a.title}</span>
                {a.bestScore !== null && (
                  <span className="font-mono text-neutral-400">
                    最高 {a.bestScore}%
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
