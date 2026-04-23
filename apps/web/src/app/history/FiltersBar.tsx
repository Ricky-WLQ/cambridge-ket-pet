"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type FilterKey = "examType" | "kind" | "mode" | "status";

const OPTIONS: Record<FilterKey, Array<{ value: string; label: string }>> = {
  examType: [
    { value: "ALL", label: "全部考试" },
    { value: "KET", label: "KET" },
    { value: "PET", label: "PET" },
  ],
  kind: [
    { value: "ALL", label: "全部题型" },
    { value: "READING", label: "阅读" },
    { value: "WRITING", label: "写作" },
    { value: "LISTENING", label: "听力" },
  ],
  mode: [
    { value: "ALL", label: "全部模式" },
    { value: "PRACTICE", label: "练习" },
    { value: "MOCK", label: "模拟" },
  ],
  status: [
    { value: "ALL", label: "全部状态" },
    { value: "IN_PROGRESS", label: "进行中" },
    { value: "SUBMITTED", label: "已提交" },
    { value: "GRADED", label: "已批改" },
    { value: "ABANDONED", label: "已放弃" },
  ],
};

export default function FiltersBar() {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function currentValue(key: FilterKey): string {
    const v = params.get(key);
    if (!v) return "ALL";
    return OPTIONS[key].some((o) => o.value === v) ? v : "ALL";
  }

  function handleChange(key: FilterKey, value: string) {
    const next = new URLSearchParams(params);
    if (value === "ALL") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `/history?${qs}` : "/history");
    });
  }

  const hasAnyFilter = (
    ["examType", "kind", "mode", "status"] as FilterKey[]
  ).some((k) => currentValue(k) !== "ALL");

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {(["examType", "kind", "mode", "status"] as FilterKey[]).map((key) => (
        <select
          key={key}
          value={currentValue(key)}
          onChange={(e) => handleChange(key, e.target.value)}
          disabled={isPending}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-neutral-900 focus:outline-none disabled:opacity-50"
        >
          {OPTIONS[key].map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}
      {hasAnyFilter && (
        <button
          type="button"
          onClick={() => {
            startTransition(() => router.push("/history"));
          }}
          disabled={isPending}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
        >
          清除筛选
        </button>
      )}
    </div>
  );
}
