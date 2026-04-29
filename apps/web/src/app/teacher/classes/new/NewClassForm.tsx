"use client";

import { useState } from "react";
import Link from "next/link";

type Created = { id: string; name: string; inviteCode: string };

export default function NewClassForm() {
  const [name, setName] = useState("");
  const [examFocus, setExamFocus] = useState<"" | "KET" | "PET">("");
  const [created, setCreated] = useState<Created | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/teacher/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          ...(examFocus ? { examFocus } : {}),
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "创建失败");
        setLoading(false);
        return;
      }

      const data = (await res.json()) as { class: Created };
      setCreated(data.class);
      setLoading(false);
    } catch {
      setError("网络错误，请重试");
      setLoading(false);
    }
  }

  if (created) {
    return (
      <div className="page-section flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-4 text-center text-sm font-bold text-green-700">
            ✓ 班级 <strong>{created.name}</strong> 创建成功
          </div>
          <div className="space-y-2 rounded-2xl bg-white border-2 border-ink/10 p-4 text-center stitched-card">
            <div className="text-sm font-bold text-ink/60">邀请码</div>
            <div className="font-mono text-2xl font-extrabold tracking-widest">
              {created.inviteCode}
            </div>
            <div className="text-xs text-ink/50">分享此邀请码给你的学生</div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/teacher/classes"
              className="flex-1 rounded-full border-2 border-ink/15 bg-white px-4 py-2 text-center text-sm font-bold hover:bg-ink/5 transition"
            >
              查看全部班级
            </Link>
            <button
              type="button"
              onClick={() => {
                setCreated(null);
                setName("");
                setExamFocus("");
              }}
              className="flex-1 rounded-full bg-ink px-4 py-2 text-sm font-extrabold text-white hover:bg-ink/90 transition"
            >
              再创建一个
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-section flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-5">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold leading-tight">
            创建班级
          </h1>
          <p className="mt-1 text-sm font-medium text-ink/65">
            创建后，邀请码可用于学生加入
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="name" className="block text-sm font-bold">
              班级名称
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              autoFocus
              className="w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-base font-medium focus:border-ink outline-none transition"
              placeholder="例如：2026 春季 KET"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="examFocus" className="block text-sm font-bold">
              考试重点（可选）
            </label>
            <select
              id="examFocus"
              value={examFocus}
              onChange={(e) =>
                setExamFocus(e.target.value as "" | "KET" | "PET")
              }
              className="w-full rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 text-base font-medium focus:border-ink outline-none transition"
            >
              <option value="">不限（KET / PET 均可）</option>
              <option value="KET">KET</option>
              <option value="PET">PET</option>
            </select>
          </div>

          {error && (
            <div className="rounded-xl border-2 border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || name.trim().length === 0}
            className="w-full rounded-full bg-ink px-4 py-3 text-base font-extrabold text-white hover:bg-ink/90 transition disabled:opacity-50"
          >
            {loading ? "创建中…" : "创建班级"}
          </button>
        </form>

        <div className="text-center text-sm">
          <Link
            href="/teacher/classes"
            className="font-bold text-ink/60 hover:text-ink transition"
          >
            ← 返回班级列表
          </Link>
        </div>
      </div>
    </div>
  );
}
