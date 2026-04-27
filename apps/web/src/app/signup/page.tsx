"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: name.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "注册失败");
        setLoading(false);
        return;
      }

      const signInRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInRes?.error) {
        setError("注册成功，但自动登录失败，请手动登录。");
        setLoading(false);
        router.push("/login");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("网络错误，请重试");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 stitched-card border-2 border-ink/10 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold leading-[1.05] tracking-tight">
            <span className="marker-yellow-thick">注册账号</span>
          </h1>
          <p className="mt-2.5 text-sm font-medium text-ink/65">
            开始你的剑桥 KET / PET 备考之旅
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="name" className="block text-sm font-bold">
              姓名（可选）
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border-2 border-ink/15 bg-white px-3.5 py-2.5 text-sm font-medium focus:border-ink outline-none transition"
              placeholder="你的名字"
              maxLength={100}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-bold">
              邮箱
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-xl border-2 border-ink/15 bg-white px-3.5 py-2.5 text-sm font-medium focus:border-ink outline-none transition"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-bold">
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-xl border-2 border-ink/15 bg-white px-3.5 py-2.5 text-sm font-medium focus:border-ink outline-none transition"
              placeholder="至少 8 位"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border-2 border-red-200 p-3 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-ink text-white text-sm font-extrabold py-3 hover:bg-ink/90 transition disabled:opacity-50"
          >
            {loading ? "注册中…" : "注册"}
          </button>
        </form>

        <div className="text-center text-sm font-medium text-ink/60">
          已有账号？{" "}
          <Link
            href="/login"
            className="font-bold text-ink hover:underline"
          >
            登录
          </Link>
        </div>
      </div>
    </div>
  );
}
