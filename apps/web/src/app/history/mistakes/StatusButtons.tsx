"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Status = "NEW" | "REVIEWED" | "MASTERED";

const TRANSITIONS: Array<{
  target: Status;
  label: string;
  showWhen: Status[];
  className: string;
}> = [
  {
    target: "REVIEWED",
    label: "标记为已复习",
    showWhen: ["NEW"],
    className: "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100",
  },
  {
    target: "MASTERED",
    label: "标记为已掌握",
    showWhen: ["NEW", "REVIEWED"],
    className: "border-green-300 bg-green-50 text-green-900 hover:bg-green-100",
  },
  {
    target: "NEW",
    label: "重置",
    showWhen: ["REVIEWED", "MASTERED"],
    className: "border-neutral-300 text-neutral-600 hover:bg-neutral-100",
  },
];

export default function StatusButtons({
  id,
  current,
}: {
  id: string;
  current: Status;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function setStatus(target: Status) {
    setError(null);
    try {
      const res = await fetch(`/api/mistakes/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: target }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "更新失败");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("网络错误");
    }
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      {error && <span className="text-red-600">{error}</span>}
      {TRANSITIONS.filter((t) => t.showWhen.includes(current)).map((t) => (
        <button
          key={t.target}
          type="button"
          disabled={isPending}
          onClick={() => setStatus(t.target)}
          className={`rounded-md border px-3 py-1 transition disabled:opacity-50 ${t.className}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
