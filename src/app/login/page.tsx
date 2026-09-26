"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", { redirect: false, email, password });
    setLoading(false);
    if (res?.error) {
      setError("邮箱或密码不正确");
      return;
    }
    router.push("/me");
    router.refresh();
  }

  return (
    <main className="min-h-[70vh] flex flex-col items-center px-6 py-10">
      <h1 className="text-2xl font-bold text-emerald-700 mb-2">登录</h1>
      <p className="text-sm text-stone-500 mb-8">登录后可跨设备同步学习进度</p>
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <label className="block">
          <span className="text-sm text-stone-600">邮箱</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-stone-200 px-4 py-3 text-base focus:border-emerald-500 outline-none"
            autoComplete="email"
          />
        </label>
        <label className="block">
          <span className="text-sm text-stone-600">密码</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-stone-200 px-4 py-3 text-base focus:border-emerald-500 outline-none"
            autoComplete="current-password"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-emerald-600 py-3 text-white font-medium disabled:opacity-50"
        >
          {loading ? "登录中…" : "登录"}
        </button>
        <p className="text-center text-sm text-stone-500">
          还没有账号？{" "}
          <a href="/register" className="text-emerald-700 underline">
            注册
          </a>
        </p>
      </form>
    </main>
  );
}
