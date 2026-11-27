"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  Mic,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { formatTime } from "@/components/StatusBadges";
import type { StageSnapshot } from "@/lib/stage-events";

interface DashboardStats {
  totalRegistered: number;
  checkedInCount: number;
  notCheckedInCount: number;
  waitingCount: number;
  onStageCount: number;
  completedCount: number;
}

interface AuditLogItem {
  id: number;
  participantCode: string | null;
  action: string;
  actorName: string | null;
  detail: string | null;
  createdAt: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as {
          stats: DashboardStats;
          recentLogs: AuditLogItem[];
        };
        setStats(data.stats);
        setLogs(data.recentLogs);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();

    const eventSource = new EventSource("/api/stage/stream");
    eventSource.addEventListener("stage", (event) => {
      try {
        const parsed = JSON.parse(event.data) as StageSnapshot;
        if (parsed.stats) {
          setStats(parsed.stats);
          void fetchStats();
        }
      } catch {
        // Ignore parse errors
      }
    });

    return () => {
      eventSource.close();
    };
  }, [fetchStats]);

  const checkInRate =
    stats && stats.totalRegistered > 0
      ? Math.round((stats.checkedInCount / stats.totalRegistered) * 100)
      : 0;
  const stageDoneRate =
    stats && stats.totalRegistered > 0
      ? Math.round((stats.completedCount / stats.totalRegistered) * 100)
      : 0;

  return (
    <AppShell
      title="现场数据统计（Dashboard）"
      subtitle="实时监控毕业典礼入场签到及舞台流程进度"
    >
      {() => (
        <div className="space-y-6">
          {loading && !stats ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              正在加载统计数据…
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    label: "总登记人数",
                    value: stats.totalRegistered,
                    icon: Users,
                    color: "bg-slate-900 text-white",
                  },
                  {
                    label: "已签到人数",
                    value: stats.checkedInCount,
                    icon: UserCheck,
                    color: "bg-emerald-700 text-white",
                  },
                  {
                    label: "未签到人数",
                    value: stats.notCheckedInCount,
                    icon: UserX,
                    color: "bg-slate-200 text-slate-700",
                  },
                  {
                    label: "等候上台人数",
                    value: stats.waitingCount,
                    icon: Clock,
                    color: "bg-amber-500 text-slate-950",
                  },
                  {
                    label: "正在上台人数",
                    value: stats.onStageCount,
                    icon: Mic,
                    color: "bg-blue-700 text-white",
                  },
                  {
                    label: "已完成上台人数",
                    value: stats.completedCount,
                    icon: CheckCircle2,
                    color: "bg-emerald-600 text-white",
                  },
                ].map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.label}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
                    >
                      <div>
                        <div className="text-sm font-medium text-slate-500">
                          {card.label}
                        </div>
                        <div className="mt-1.5 text-3xl font-bold tracking-tight text-slate-900">
                          {card.value}
                        </div>
                      </div>
                      <span
                        className={`flex h-11 w-11 items-center justify-center rounded-xl ${card.color}`}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                    <span>入场签到进度</span>
                    <span className="font-mono font-semibold text-emerald-700">
                      {checkInRate}%（{stats.checkedInCount} /{" "}
                      {stats.totalRegistered}）
                    </span>
                  </div>
                  <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                      style={{ width: `${checkInRate}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                    <span>上台流程完成度</span>
                    <span className="font-mono font-semibold text-blue-800">
                      {stageDoneRate}%（{stats.completedCount} /{" "}
                      {stats.totalRegistered}）
                    </span>
                  </div>
                  <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-800 transition-all duration-300"
                      style={{ width: `${stageDoneRate}%` }}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Activity className="h-4 w-4 text-blue-800" />
              <h2 className="text-base font-semibold text-slate-900">
                最近操作审计记录
              </h2>
            </div>

            {logs.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                暂无操作记录
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {logs.map((log) => (
                  <li
                    key={log.id}
                    className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <span className="inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700 mr-2">
                        {log.action}
                      </span>
                      <span className="text-slate-800">
                        {log.detail ?? log.participantCode ?? "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 shrink-0">
                      <span>操作员：{log.actorName ?? "系统"}</span>
                      <span className="font-mono">
                        {formatTime(log.createdAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
