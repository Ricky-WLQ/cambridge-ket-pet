"use client";

import { useState } from "react";
import { createAssignmentAction } from "@/lib/assignmentActions";

type ExamType = "KET" | "PET";
type Kind = "READING" | "WRITING";

const PARTS: Record<ExamType, Record<Kind, number[]>> = {
  KET: { READING: [1, 2, 3, 4, 5], WRITING: [6, 7] },
  PET: { READING: [1, 2, 3, 4, 5, 6], WRITING: [1, 2] },
};

const KIND_LABEL: Record<Kind, string> = {
  READING: "阅读",
  WRITING: "写作",
};

export default function NewAssignmentForm({
  classId,
  defaultExamType,
}: {
  classId: string;
  defaultExamType: ExamType;
}) {
  const [examType, setExamType] = useState<ExamType>(defaultExamType);
  const [kind, setKind] = useState<Kind>("READING");
  const [part, setPart] = useState<string>("ANY");
  const [submitting, setSubmitting] = useState(false);

  const parts = PARTS[examType][kind];

  return (
    <form
      action={async (fd) => {
        setSubmitting(true);
        try {
          await createAssignmentAction(fd);
        } catch (e) {
          setSubmitting(false);
          alert(e instanceof Error ? e.message : "创建作业失败");
        }
      }}
      className="space-y-4"
    >
      <input type="hidden" name="classId" value={classId} />

      <div>
        <label className="mb-1 block text-sm font-medium">标题</label>
        <input
          name="title"
          type="text"
          required
          maxLength={80}
          placeholder="例如：本周 KET Reading Part 3 练习"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          说明（可选）
        </label>
        <textarea
          name="description"
          rows={3}
          maxLength={500}
          placeholder="给学生的简短说明、提示或鼓励"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">科目</label>
          <div className="flex gap-2">
            {(["KET", "PET"] as const).map((et) => (
              <button
                key={et}
                type="button"
                onClick={() => {
                  setExamType(et);
                  setPart("ANY");
                }}
                className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${
                  examType === et
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 bg-white hover:border-neutral-900"
                }`}
              >
                {et}
              </button>
            ))}
          </div>
          <input type="hidden" name="examType" value={examType} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">题型</label>
          <div className="flex gap-2">
            {(["READING", "WRITING"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setKind(k);
                  setPart("ANY");
                }}
                className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${
                  kind === k
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 bg-white hover:border-neutral-900"
                }`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <input type="hidden" name="kind" value={kind} />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          Part（可选 — 留「任意」则该题型任意 Part 均计入）
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPart("ANY")}
            className={`rounded-md border px-3 py-1.5 text-sm transition ${
              part === "ANY"
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 bg-white hover:border-neutral-900"
            }`}
          >
            任意
          </button>
          {parts.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPart(String(p))}
              className={`rounded-md border px-3 py-1.5 text-sm transition ${
                part === String(p)
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 bg-white hover:border-neutral-900"
              }`}
            >
              Part {p}
            </button>
          ))}
        </div>
        <input type="hidden" name="part" value={part} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">
            最低及格分（可选，0-100）
          </label>
          <input
            name="minScore"
            type="number"
            min={0}
            max={100}
            step={1}
            placeholder="例如：70"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
          />
          <p className="mt-1 text-xs text-neutral-500">
            留空则任何已批改答卷均视为完成
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            截止时间（可选）
          </label>
          <input
            name="dueAt"
            type="datetime-local"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {submitting ? "保存中…" : "保存作业"}
        </button>
      </div>
    </form>
  );
}
