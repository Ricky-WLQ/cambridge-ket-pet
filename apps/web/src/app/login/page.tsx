"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

import { Mascot } from "@/components/Mascot";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("邮箱或密码错误");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 stitched-card border-2 border-ink/10 space-y-5">
        <div className="text-center">
          <Mascot
            pose="waving"
            portal="ket"
            width={88}
            height={88}
            decorative
            className="mx-auto"
          />
          <h1 className="mt-1 text-2xl font-extrabold leading-tight">
            登录
          </h1>
          <p className="mt-1 text-sm font-medium text-ink/65">
            欢迎回到剑桥 KET / PET 备考
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              autoComplete="current-password"
              className="w-full rounded-xl border-2 border-ink/15 bg-white px-3.5 py-2.5 text-sm font-medium focus:border-ink outline-none transition"
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
            {loading ? "登录中…" : "登录"}
          </button>
        </form>

        <div className="text-center text-sm font-medium text-ink/60">
          还没有账号？{" "}
          <Link
            href="/signup"
            className="font-bold text-ink hover:underline"
          >
            注册
          </Link>
        </div>
      </div>
    </div>
  );
}
