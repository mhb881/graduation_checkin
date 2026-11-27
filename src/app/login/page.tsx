"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { GraduationCap, Lock, LogIn, Mail } from "lucide-react";
import { authClient } from "@/lib/auth-client";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
      });

      if (result.error) {
        setError(result.error.message || "邮箱或密码不正确");
        return;
      }

      const meRes = await fetch("/api/me", { cache: "no-store" });
      if (meRes.ok) {
        const me = (await meRes.json()) as {
          user: { role: "admin" | "staff" };
        };
        if (nextPath && nextPath.startsWith("/")) {
          router.replace(nextPath);
        } else {
          router.replace(me.user.role === "admin" ? "/admin" : "/entry");
        }
        return;
      }

      router.replace("/entry");
    } catch {
      setError("登录请求失败，请检查网络连接");
    } finally {
      setSubmitting(false);
    }
  }

  function fillAccount(demoEmail: string, demoPassword: string) {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError(null);
  }

  return (
    <div className="min-h-screen flex flex-col justify-center bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Link
            href="/"
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-900 text-white shadow-sm"
          >
            <GraduationCap className="h-6 w-6" />
          </Link>
          <h1 className="mt-4 text-xl font-bold text-slate-900">
            工作人员登录
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            登录后可进入管理后台、扫码签到或舞台控制端
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                邮箱
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@grad.edu"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                密码
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
            >
              <LogIn className="h-4 w-4" />
              {submitting ? "正在登录…" : "登录系统"}
            </button>
          </form>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-xs font-medium text-slate-500 mb-2">
              演示测试账号（点击快速填入）
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => fillAccount("admin@grad.edu", "Admin123!")}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                管理员
              </button>
              <button
                type="button"
                onClick={() => fillAccount("staff1@grad.edu", "Staff123!")}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                签到员 1
              </button>
              <button
                type="button"
                onClick={() => fillAccount("staff2@grad.edu", "Staff123!")}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                舞台组 2
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link
            href="/display"
            className="text-xs font-medium text-slate-500 hover:text-blue-800"
          >
            无需登录直接打开舞台大屏 →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-500">
          加载中…
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
