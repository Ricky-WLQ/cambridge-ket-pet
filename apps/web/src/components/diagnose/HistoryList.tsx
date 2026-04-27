/**
 * Past WeeklyDiagnose history list. Shown on the diagnose hub once the user
 * has at least one prior week's report. Each row is a link to the report
 * viewer at /diagnose/report/[testId].
 *
 * Server-renderable (no state) — caller fetches `/api/diagnose/history` and
 * passes `items` here. Pure list rendering keeps this side of the UI
 * predictable and reusable from the teacher view (T25 class scope) too.
 */
import Link from "next/link";

import { t } from "@/i18n/zh-CN";

type DiagnoseHistoryStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETE"
  | "REPORT_READY"
  | "REPORT_FAILED";

const STATUS_PILL: Record<
  DiagnoseHistoryStatus,
  { label: string; className: string }
> = {
  PENDING: {
    label: "待开始",
    className: "bg-neutral-100 text-neutral-600",
  },
  IN_PROGRESS: {
    label: "进行中",
    className: "bg-amber-100 text-amber-800",
  },
  COMPLETE: {
    label: "已完成",
    className: "bg-blue-100 text-blue-800",
  },
  REPORT_READY: {
    label: "报告就绪",
    className: "bg-green-100 text-green-800",
  },
  REPORT_FAILED: {
    label: "报告失败",
    className: "bg-red-100 text-red-700",
  },
};

interface HistoryItem {
  id: string;
  testId: string;
  weekStart: string;
  weekEnd: string;
  status: DiagnoseHistoryStatus;
  examType: "KET" | "PET";
  overallScore: number | null;
}

interface Props {
  items: HistoryItem[];
}

function scoreColor(pct: number): string {
  if (pct >= 70) return "text-green-700";
  if (pct >= 50) return "text-amber-700";
  return "text-red-700";
}

export default function HistoryList({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
        还没有历史诊断记录
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-3 text-base font-semibold text-neutral-900">
        {t.diagnose.historyTitle}
      </h2>
      <ul className="space-y-2">
        {items.map((item) => {
          const pill = STATUS_PILL[item.status];
          const canView =
            item.status === "REPORT_READY" || item.status === "COMPLETE";
          return (
            <li
              key={item.id}
              className="flex flex-col gap-2 rounded-md border border-neutral-200 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-xs font-medium text-white">
                  {item.examType}
                </span>
                <span className="text-sm font-medium text-neutral-800">
                  {t.diagnose.weekRange(item.weekStart, item.weekEnd)}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${pill.className}`}
                >
                  {pill.label}
                </span>
                {item.overallScore !== null && (
                  <span
                    className={`font-mono text-sm font-semibold ${scoreColor(item.overallScore)}`}
                  >
                    {item.overallScore}%
                  </span>
                )}
              </div>
              {canView && (
                <Link
                  href={`/diagnose/report/${item.testId}`}
                  className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100"
                >
                  查看报告 →
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
