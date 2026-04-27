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
        <div className="w-full max-w-sm rounded-3xl bg-white p-7 stitched-card border-2 border-ink/10 space-y-4 text-center">
          <div className="rounded-xl bg-mint-tint border-2 border-ink/10 p-4 text-sm font-bold text-ink">
            ✓ 激活成功！你现在是教师身份
          </div>
          <p className="text-sm font-medium text-ink/65">即将跳转首页…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 stitched-card border-2 border-ink/10 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold leading-[1.05] tracking-tight">
            <span className="marker-yellow-thick">教师激活</span>
          </h1>
          <p className="mt-2.5 text-sm font-medium text-ink/65">
            输入激活码以获得教师权限
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="code" className="block text-sm font-bold">
              激活码
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              autoFocus
              className="w-full rounded-xl border-2 border-ink/15 bg-white px-3.5 py-2.5 font-mono text-sm tracking-wider focus:border-ink outline-none transition"
              placeholder="TEACHER-XXXX-XXX"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border-2 border-red-200 p-3 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.trim().length === 0}
            className="w-full rounded-full bg-ink text-white text-sm font-extrabold py-3 hover:bg-ink/90 transition disabled:opacity-50"
          >
            {loading ? "激活中…" : "激活"}
          </button>
        </form>

        <div className="text-center text-sm font-medium text-ink/60">
          <Link href="/" className="font-bold text-ink hover:underline">
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
