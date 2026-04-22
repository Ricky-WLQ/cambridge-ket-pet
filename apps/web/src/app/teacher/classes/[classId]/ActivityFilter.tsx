"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type Member = {
  userId: string;
  name: string;
};

export default function ActivityFilter({
  classId,
  members,
}: {
  classId: string;
  members: Member[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentStudent = params.get("student") ?? "ALL";
  const currentStatus = params.get("status") ?? "ALL";

  function update(key: "student" | "status", value: string) {
    const next = new URLSearchParams(params);
    if (value === "ALL") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    const qs = next.toString();
    startTransition(() => {
      router.push(
        qs
          ? `/teacher/classes/${classId}?${qs}`
          : `/teacher/classes/${classId}`,
      );
    });
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <select
        value={currentStudent}
        onChange={(e) => update("student", e.target.value)}
        disabled={isPending}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-neutral-900 focus:outline-none disabled:opacity-50"
      >
        <option value="ALL">全部学生</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.name}
          </option>
        ))}
      </select>

      <select
        value={currentStatus}
        onChange={(e) => update("status", e.target.value)}
        disabled={isPending}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm focus:border-neutral-900 focus:outline-none disabled:opacity-50"
      >
        <option value="ALL">全部状态</option>
        <option value="GRADED">已批改</option>
        <option value="IN_PROGRESS">进行中</option>
        <option value="SUBMITTED">已提交</option>
        <option value="ABANDONED">已放弃</option>
      </select>

      {(currentStudent !== "ALL" || currentStatus !== "ALL") && (
        <button
          type="button"
          onClick={() => {
            startTransition(() =>
              router.push(`/teacher/classes/${classId}`),
            );
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
