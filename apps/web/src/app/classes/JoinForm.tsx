"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch("/api/classes/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: code.trim() }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        class?: { name: string };
      };

      if (!res.ok) {
        setError(data.error ?? "加入失败");
        setLoading(false);
        return;
      }

      setSuccess(`已加入 ${data.class?.name ?? "班级"}`);
      setCode("");
      setLoading(false);
      router.refresh();
    } catch {
      setError("网络错误，请重试");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border-2 border-ink/10 bg-white p-5 stitched-card">
      <div className="mb-3 text-sm font-extrabold">加入班级</div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="输入 8 位邀请码"
          maxLength={20}
          className="flex-1 rounded-2xl border-2 border-ink/15 bg-white px-4 py-3 font-mono text-sm tracking-wider focus:border-ink outline-none transition"
        />
        <button
          type="submit"
          disabled={loading || code.trim().length === 0}
          className="rounded-full bg-ink text-white font-extrabold px-5 py-2.5 text-sm hover:bg-ink/90 transition disabled:opacity-50"
        >
          {loading ? "加入中…" : "加入"}
        </button>
      </form>
      {error && (
        <div className="mt-3 rounded-xl border-2 border-red-200 bg-red-50 p-2 text-xs font-medium text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-3 rounded-xl border-2 border-green-200 bg-green-50 p-2 text-xs font-medium text-green-700">
          ✓ {success}
        </div>
      )}
    </div>
  );
}
