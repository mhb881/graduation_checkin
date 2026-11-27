"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Monitor,
  Play,
  Users,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { QrScannerPanel } from "@/components/QrScannerPanel";
import { formatTime } from "@/components/StatusBadges";
import type { StageSnapshot } from "@/lib/stage-events";

export default function StageCounterPage() {
  const [snapshot, setSnapshot] = useState<StageSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "warning" | "error";
    message: string;
  } | null>(null);

  const fetchLatest = useCallback(async () => {
    try {
      const res = await fetch("/api/stage/state", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as StageSnapshot;
        if ("waitingQueue" in data) {
          setSnapshot(data);
        }
      }
    } catch {
      // Ignore transient fetch failures
    }
  }, []);

  useEffect(() => {
    let active = true;
    const syncInitial = async () => {
      try {
        const res = await fetch("/api/stage/state", { cache: "no-store" });
        if (res.ok && active) {
          const data = (await res.json()) as StageSnapshot;
          if ("waitingQueue" in data) {
            setSnapshot(data);
          }
        }
      } catch {
        // Ignore transient fetch failures
      }
    };
    void syncInitial();

    const eventSource = new EventSource("/api/stage/stream");
    eventSource.onopen = () => setConnected(true);
    eventSource.onerror = () => setConnected(false);
    eventSource.addEventListener("stage", (event) => {
      try {
        const parsed = JSON.parse(event.data) as StageSnapshot;
        if ("waitingQueue" in parsed) {
          setSnapshot(parsed);
          setConnected(true);
        }
      } catch {
        // Ignore malformed SSE payload
      }
    });

    const fallbackTimer = setInterval(() => {
      if (!document.hidden) {
        void fetchLatest();
      }
    }, 2_500);

    return () => {
      active = false;
      clearInterval(fallbackTimer);
      eventSource.close();
    };
  }, [fetchLatest]);

  async function handleJoinQueue(raw: string, mode: "qr" | "manual") {
    setFeedback(null);
    setBusyAction(true);

    try {
      const res = await fetch("/api/stage/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw, mode }),
      });

      const data = (await res.json()) as {
        message?: string;
        snapshot?: StageSnapshot;
      };

      if (!res.ok) {
        setFeedback({
          type: res.status === 409 ? "warning" : "error",
          message: data.message ?? "加入舞台队列失败",
        });
        return;
      }

      if (data.snapshot) {
        setSnapshot(data.snapshot);
      } else {
        await fetchLatest();
      }
      setFeedback({
        type: "success",
        message: data.message ?? "已成功加入舞台等候队列",
      });
    } catch {
      setFeedback({
        type: "error",
        message: "网络异常，请重试",
      });
    } finally {
      setBusyAction(false);
    }
  }

  async function handleCallNext() {
    setFeedback(null);
    setBusyAction(true);

    try {
      const res = await fetch("/api/stage/call-next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoCompleteCurrent: true,
          expectedCurrentId: snapshot?.currentOnStage?.id ?? null,
          expectedNextId: snapshot?.waitingQueue[0]?.id,
        }),
      });
      const data = (await res.json()) as {
        message?: string;
        snapshot?: StageSnapshot;
      };
      if (!res.ok) {
        if (res.status === 409) {
          await fetchLatest();
        }
        setFeedback({
          type: res.status === 409 ? "warning" : "error",
          message: data.message ?? "呼叫下一位失败",
        });
        return;
      }
      if (data.snapshot) {
        setSnapshot(data.snapshot);
      }
      setFeedback({
        type: "success",
        message: data.message ?? "已切换下一位参与者上台",
      });
    } catch {
      setFeedback({
        type: "error",
        message: "网络异常，呼叫下一位失败",
      });
    } finally {
      setBusyAction(false);
    }
  }

  async function handleCompleteCurrent() {
    setFeedback(null);
    setBusyAction(true);

    try {
      const res = await fetch("/api/stage/complete", {
        method: "POST",
      });
      const data = (await res.json()) as {
        message?: string;
        snapshot?: StageSnapshot;
      };
      if (!res.ok) {
        setFeedback({
          type: res.status === 409 ? "warning" : "error",
          message: data.message ?? "确认完成失败",
        });
        return;
      }
      if (data.snapshot) {
        setSnapshot(data.snapshot);
      }
      setFeedback({
        type: "success",
        message: data.message ?? "已确认完成上台流程",
      });
    } catch {
      setFeedback({
        type: "error",
        message: "网络异常，确认完成失败",
      });
    } finally {
      setBusyAction(false);
    }
  }

  return (
    <AppShell
      title="舞台管理控制（Stage Counter）"
      subtitle="扫描已签到参与者二维码加入等候队列，呼叫下一位并同步更新舞台大屏"
    >
      {() => (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-950 to-slate-900 p-5 text-white shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-200">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      connected ? "bg-emerald-400" : "bg-amber-400"
                    }`}
                  />
                  {connected ? "大屏实时同步中" : "正在重连同步"}
                </span>
                <Link
                  href="/display"
                  target="_blank"
                  className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/20"
                >
                  <Monitor className="h-3.5 w-3.5" />
                  打开大屏
                </Link>
              </div>

              <div className="mt-4">
                <span className="text-xs uppercase tracking-wider text-blue-300">
                  当前正在上台
                </span>
                {snapshot?.currentOnStage ? (
                  <div className="mt-1">
                    <div className="text-3xl font-bold tracking-tight">
                      {snapshot.currentOnStage.name}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-blue-200">
                      <span className="font-mono font-semibold text-amber-300">
                        {snapshot.currentOnStage.code}
                      </span>
                      <span>
                        上台时间：{formatTime(snapshot.currentOnStage.calledAt)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 rounded-lg bg-white/5 px-3 py-4 text-sm text-blue-200">
                    当前舞台空闲，可点击「呼叫下一位上台」
                  </div>
                )}
              </div>

              <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={
                    busyAction || (snapshot?.waitingQueue.length ?? 0) === 0
                  }
                  onClick={() => void handleCallNext()}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/50"
                >
                  <Play className="h-4 w-4" />
                  呼叫下一位上台
                </button>
                <button
                  type="button"
                  disabled={busyAction || !snapshot?.currentOnStage}
                  onClick={() => void handleCompleteCurrent()}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  确认完成上台
                </button>
              </div>

              <div className="mt-3 text-xs text-blue-200/90">
                {snapshot?.waitingQueue[0] ? (
                  <span>
                    下一位等候：
                    <strong className="ml-1 text-white">
                      {snapshot.waitingQueue[0].name}
                    </strong>
                    <span className="ml-1.5 font-mono text-amber-300">
                      {snapshot.waitingQueue[0].code}
                    </span>
                  </span>
                ) : (
                  <span>
                    等候队列为空，请先在下方扫描已签到参与者的二维码加入队列
                  </span>
                )}
              </div>
            </div>

            {feedback && (
              <div
                className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-sm ${
                  feedback.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : feedback.type === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-red-200 bg-red-50 text-red-900"
                }`}
              >
                {feedback.type === "success" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : feedback.type === "warning" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                )}
                <span>{feedback.message}</span>
              </div>
            )}

            <QrScannerPanel
              onScan={handleJoinQueue}
              disabled={busyAction}
              actionLabel="加入舞台队列"
            />
          </div>

          <div className="space-y-4 lg:col-span-7">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-800" />
                  <h2 className="text-base font-semibold text-slate-900">
                    等候上台队列（按加入时间排序）
                  </h2>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-600">
                  <span>
                    等候中：
                    <strong className="ml-1 text-amber-700">
                      {snapshot?.stats.waitingCount ?? 0}
                    </strong>
                  </span>
                  <span>
                    已完成：
                    <strong className="ml-1 text-emerald-700">
                      {snapshot?.stats.completedCount ?? 0}
                    </strong>
                  </span>
                </div>
              </div>

              {!snapshot || snapshot.waitingQueue.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  当前没有等候上台的参与者，请使用左侧扫码框扫描已签到参与者的二维码入队。
                </div>
              ) : (
                <ol className="divide-y divide-slate-100">
                  {snapshot.waitingQueue.map((item, idx) => (
                    <li
                      key={item.id}
                      className={`flex items-center justify-between gap-3 py-3 ${
                        idx === 0 ? "bg-amber-50/60 -mx-3 px-3 rounded-lg" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            idx === 0
                              ? "bg-amber-500 text-slate-950"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 truncate">
                              {item.name}
                            </span>
                            {idx === 0 && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900">
                                下一位
                                <ArrowRight className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 font-mono">
                            {item.code}
                          </div>
                        </div>
                      </div>

                      <div className="text-right text-xs text-slate-500 shrink-0">
                        <div className="flex items-center justify-end gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(item.queuedAt)}
                        </div>
                        <div className="mt-0.5">
                          操作员：{item.queuedByName ?? "—"}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {snapshot && snapshot.recentCompleted.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">
                  最近完成上台
                </h3>
                <div className="flex flex-wrap gap-2">
                  {snapshot.recentCompleted.map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-900"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="font-medium">{item.name}</span>
                      <span className="font-mono text-emerald-700">
                        {item.code}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
