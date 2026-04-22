"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ActivateForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/teacher/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "激活失败");
        setLoading(false);
        return;
      }

      setSuccess(true);
      // Refresh server components so the header shows the new role
      router.refresh();
      setTimeout(() => {
        router.push("/");
      }, 1200);
    } catch {
      setError("网络错误，请重试");
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="rounded-md bg-green-50 p-4 text-sm text-green-700">
            ✓ 激活成功！你现在是教师身份
          </div>
          <p className="text-sm text-neutral-500">即将跳转首页…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">教师激活</h1>
          <p className="mt-2 text-sm text-neutral-500">
            输入激活码以获得教师权限
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="code" className="block text-sm font-medium">
              激活码
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              autoFocus
              className="w-full rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm tracking-wider focus:border-neutral-900 focus:outline-none"
              placeholder="TEACHER-XXXX-XXX"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.trim().length === 0}
            className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 disabled:opacity-50"
          >
            {loading ? "激活中…" : "激活"}
          </button>
        </form>

        <div className="text-center text-sm text-neutral-500">
          <Link href="/" className="text-neutral-700 hover:text-neutral-900">
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
