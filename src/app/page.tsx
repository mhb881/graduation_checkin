"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  GraduationCap,
  LogIn,
  Mic,
  Monitor,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import type { CurrentActor } from "@/components/AppShell";

export default function HomePage() {
  const [actor, setActor] = useState<CurrentActor | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/me", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json()) as { user: CurrentActor };
        return data.user;
      })
      .then((user) => {
        if (active) {
          setActor(user);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const cards = [
    {
      href: "/admin",
      title: "管理后台",
      desc: "管理毕业生资料、生成与打印专属二维码、筛选签到与上台状态。",
      roleHint: "仅管理员",
      icon: ShieldCheck,
      accent: "bg-blue-900 text-white",
    },
    {
      href: "/entry",
      title: "手机扫码签到",
      desc: "使用手机浏览器调用摄像头扫描二维码，核对信息后确认入场签到。",
      roleHint: "工作人员 / 管理员",
      icon: QrCode,
      accent: "bg-emerald-700 text-white",
    },
    {
      href: "/stage",
      title: "舞台管理控制",
      desc: "扫描已签到毕业生二维码加入等候队列，呼叫下一位并确认完成上台。",
      roleHint: "工作人员 / 管理员",
      icon: Mic,
      accent: "bg-amber-600 text-white",
    },
    {
      href: "/display",
      title: "舞台全屏大屏",
      desc: "独立全屏展示当前上台毕业生姓名与编号，工作人员切换后实时自动更新。",
      roleHint: "公开投影屏幕",
      icon: Monitor,
      accent: "bg-slate-900 text-white",
    },
    {
      href: "/dashboard",
      title: "现场数据统计",
      desc: "实时查看总登记、已签到、未签到、等候上台、正在上台及已完成人数。",
      roleHint: "工作人员 / 管理员",
      icon: BarChart3,
      accent: "bg-indigo-700 text-white",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-900 text-white">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-base font-bold text-slate-900 sm:text-lg">
                毕业典礼 QR Code 签到及舞台管理系统
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {loaded && actor ? (
              <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-700">
                <span className="font-medium">{actor.name}</span>
                <span className="rounded bg-white px-1.5 py-0.5 font-semibold text-blue-800">
                  {actor.role === "admin" ? "管理员" : "工作人员"}
                </span>
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
              >
                <LogIn className="h-4 w-4" />
                工作人员登录
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
            现场工作台入口
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            选择对应岗位页面开始工作；所有端数据通过 PostgreSQL 实时同步。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-blue-300 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.accent}`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      {card.roleHint}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-900 group-hover:text-blue-900">
                    {card.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    {card.desc}
                  </p>
                </div>

                <div className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-blue-800">
                  <span>进入页面</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
