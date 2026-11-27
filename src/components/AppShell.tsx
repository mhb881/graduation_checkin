"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  GraduationCap,
  LogOut,
  Menu,
  Mic,
  Monitor,
  QrCode,
  ShieldCheck,
  X,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";

export interface CurrentActor {
  id: string;
  name: string;
  email: string;
  role: "admin" | "staff";
}

interface AppShellProps {
  title: string;
  subtitle?: string;
  children: (actor: CurrentActor) => React.ReactNode;
  requireAdminRole?: boolean;
}

export function AppShell({
  title,
  subtitle,
  children,
  requireAdminRole = false,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [actor, setActor] = useState<CurrentActor | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadMe() {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (!res.ok) {
          if (active) {
            router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          }
          return;
        }
        const data = (await res.json()) as { user: CurrentActor };
        if (active) {
          setActor(data.user);
        }
      } catch {
        if (active) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void loadMe();
    return () => {
      active = false;
    };
  }, [pathname, router]);

  async function handleSignOut() {
    await authClient.signOut();
    router.replace("/login");
  }

  const navItems = [
    ...(actor?.role === "admin"
      ? [{ href: "/admin", label: "管理后台", icon: ShieldCheck }]
      : []),
    { href: "/entry", label: "扫码签到", icon: QrCode },
    { href: "/stage", label: "舞台控制", icon: Mic },
    { href: "/dashboard", label: "数据统计", icon: BarChart3 },
    { href: "/display", label: "舞台大屏", icon: Monitor },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-500">正在验证登录状态…</div>
      </div>
    );
  }

  if (!actor) {
    return null;
  }

  const isForbidden = requireAdminRole && actor.role !== "admin";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="flex items-center gap-2 text-slate-900 font-semibold shrink-0"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-900 text-white">
                <GraduationCap className="h-4 w-4" />
              </span>
              <span className="hidden sm:inline text-sm tracking-tight">
                毕业典礼现场系统
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1 ml-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
                      active
                        ? "bg-blue-50 text-blue-800"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-2 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
              <span className="font-medium truncate max-w-36">{actor.name}</span>
              <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-semibold text-blue-800">
                {actor.role === "admin" ? "管理员" : "工作人员"}
              </span>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">退出</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="切换导航菜单"
              className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700"
            >
              {mobileMenuOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600 pb-2 border-b border-slate-100">
              <span>当前账号：{actor.name}</span>
              <span className="font-semibold text-blue-800">
                {actor.role === "admin" ? "管理员" : "工作人员"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${
                      active
                        ? "bg-blue-50 text-blue-800"
                        : "bg-slate-50 text-slate-700"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 sm:py-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
          )}
        </div>

        {isForbidden ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
            <h2 className="text-base font-semibold">需要管理员权限</h2>
            <p className="mt-1 text-sm text-amber-800">
              当前账号为普通工作人员（staff），仅可操作扫码签到、舞台管理及查看统计数据。
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/entry"
                className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
              >
                前往扫码签到
              </Link>
              <Link
                href="/stage"
                className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
              >
                前往舞台控制
              </Link>
            </div>
          </div>
        ) : (
          children(actor)
        )}
      </main>
    </div>
  );
}
