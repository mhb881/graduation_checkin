"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Mail,
  RotateCcw,
  UserCheck,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { QrScannerPanel } from "@/components/QrScannerPanel";
import {
  CheckInBadge,
  formatTime,
  StageStatusBadge,
} from "@/components/StatusBadges";
import type { ParticipantDetail } from "@/lib/graduation-service";

interface LocalEntryLog {
  id: string;
  code: string;
  name: string;
  time: string;
  status: "success" | "conflict" | "error";
  message: string;
}

export default function EntryCounterPage() {
  const [selectedParticipant, setSelectedParticipant] =
    useState<ParticipantDetail | null>(null);
  const [lastRawInput, setLastRawInput] = useState<{
    raw: string;
    mode: "qr" | "manual";
  } | null>(null);
  const [banner, setBanner] = useState<{
    type: "success" | "warning" | "error";
    title: string;
    detail: string;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [recentLogs, setRecentLogs] = useState<LocalEntryLog[]>([]);

  function pushLog(entry: Omit<LocalEntryLog, "id" | "time">) {
    setRecentLogs((prev) => [
      {
        ...entry,
        id: `${Date.now()}-${Math.random()}`,
        time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
      },
      ...prev.slice(0, 9),
    ]);
  }

  async function handleLookup(raw: string, mode: "qr" | "manual") {
    setBanner(null);
    setLastRawInput({ raw, mode });

    try {
      const res = await fetch("/api/checkin/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw, mode }),
      });

      const data = (await res.json()) as {
        participant?: ParticipantDetail;
        error?: string;
        message?: string;
      };

      if (!res.ok || !data.participant) {
        setSelectedParticipant(null);
        const msg = data.message ?? "无效的二维码或参与者编号";
        setBanner({
          type: "error",
          title: "识别失败",
          detail: msg,
        });
        pushLog({
          code: mode === "manual" ? raw.toUpperCase() : "QR-INVALID",
          name: "—",
          status: "error",
          message: msg,
        });
        return;
      }

      setSelectedParticipant(data.participant);
      if (data.participant.checkedInAt) {
        setBanner({
          type: "warning",
          title: "该参与者已完成签到",
          detail: `签到时间：${formatTime(data.participant.checkedInAt)}，操作员：${
            data.participant.checkedInByName ?? "未知"
          }。系统已锁定，防止重复签到。`,
        });
      }
    } catch {
      setSelectedParticipant(null);
      setBanner({
        type: "error",
        title: "网络异常",
        detail: "无法连接服务器，请检查网络连接后重试",
      });
    }
  }

  async function handleConfirmCheckIn() {
    if (!selectedParticipant || !lastRawInput) return;
    setConfirming(true);
    setBanner(null);

    try {
      const res = await fetch("/api/checkin/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lastRawInput),
      });

      const data = (await res.json()) as {
        participant?: ParticipantDetail;
        error?: string;
        message?: string;
      };

      if (res.status === 409 && data.participant) {
        setSelectedParticipant(data.participant);
        const detailMsg = `${data.participant.name} 已由 ${
          data.participant.checkedInByName ?? "其他设备"
        } 于 ${formatTime(data.participant.checkedInAt)} 完成签到`;
        setBanner({
          type: "warning",
          title: "拦截重复签到",
          detail: detailMsg,
        });
        pushLog({
          code: data.participant.code,
          name: data.participant.name,
          status: "conflict",
          message: "重复签到已被拦截",
        });
        return;
      }

      if (!res.ok || !data.participant) {
        setBanner({
          type: "error",
          title: "签到失败",
          detail: data.message ?? "请重新扫描后再试",
        });
        return;
      }

      setSelectedParticipant(data.participant);
      setBanner({
        type: "success",
        title: "签到成功",
        detail: `${data.participant.name}（${data.participant.code}）已于 ${formatTime(
          data.participant.checkedInAt
        )} 完成签到，操作员：${data.participant.checkedInByName ?? "当前账号"}`,
      });
      pushLog({
        code: data.participant.code,
        name: data.participant.name,
        status: "success",
        message: "确认签到成功",
      });
    } catch {
      setBanner({
        type: "error",
        title: "网络异常",
        detail: "提交签到请求失败，请重试",
      });
    } finally {
      setConfirming(false);
    }
  }

  function handleReset() {
    setSelectedParticipant(null);
    setLastRawInput(null);
    setBanner(null);
  }

  return (
    <AppShell
      title="入场扫码签到（Entry Counter）"
      subtitle="扫描参与者二维码或手动输入编号，核对资料后确认完成签到"
    >
      {() => (
        <div className="mx-auto max-w-2xl space-y-4">
          <QrScannerPanel
            onScan={handleLookup}
            disabled={confirming}
            actionLabel="查询资料"
          />

          {banner && (
            <div
              className={`flex items-start gap-3 rounded-xl border p-4 ${
                banner.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                  : banner.type === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-950"
                  : "border-red-200 bg-red-50 text-red-950"
              }`}
            >
              {banner.type === "success" ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : banner.type === "warning" ? (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">{banner.title}</h3>
                <p className="mt-0.5 text-sm opacity-90">{banner.detail}</p>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-current/20 bg-white/70 px-2.5 py-1 text-xs font-medium hover:bg-white"
              >
                <RotateCcw className="h-3 w-3" />
                重置
              </button>
            </div>
          )}

          {selectedParticipant && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="font-mono text-xs font-semibold text-blue-800">
                    {selectedParticipant.code}
                  </span>
                  <h2 className="mt-0.5 text-2xl font-bold text-slate-900">
                    {selectedParticipant.name}
                  </h2>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                    <Mail className="h-4 w-4 text-slate-400" />
                    {selectedParticipant.email}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <CheckInBadge checkedInAt={selectedParticipant.checkedInAt} />
                  <StageStatusBadge status={selectedParticipant.stageStatus} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                <div>
                  <span className="block text-slate-400">签到时间</span>
                  <span className="mt-0.5 block font-medium text-slate-800">
                    {formatTime(selectedParticipant.checkedInAt)}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-400">签到操作员</span>
                  <span className="mt-0.5 block font-medium text-slate-800">
                    {selectedParticipant.checkedInByName ?? "—"}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  disabled={Boolean(selectedParticipant.checkedInAt) || confirming}
                  onClick={() => void handleConfirmCheckIn()}
                  className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-base font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                >
                  <UserCheck className="h-5 w-5" />
                  {selectedParticipant.checkedInAt
                    ? "已完成签到（禁止重复签到）"
                    : confirming
                    ? "正在确认…"
                    : "确认完成签到"}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  下一位
                </button>
              </div>
            </div>
          )}

          {recentLogs.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">
                本机最近扫码记录
              </h3>
              <ul className="divide-y divide-slate-100 text-sm">
                {recentLogs.map((log) => (
                  <li
                    key={log.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <div className="min-w-0">
                      <span className="font-mono text-xs text-slate-500 mr-2">
                        {log.code}
                      </span>
                      <span className="font-medium text-slate-900">
                        {log.name}
                      </span>
                      <p className="text-xs text-slate-500 truncate">
                        {log.message}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-xs text-slate-400">
                      {log.time}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
