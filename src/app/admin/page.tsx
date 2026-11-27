"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Download,
  Edit3,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  CheckInBadge,
  formatTime,
  StageStatusBadge,
} from "@/components/StatusBadges";
import type { StageStatus } from "@/db/schema";
import type { ParticipantDetail } from "@/lib/graduation-service";

interface StatsSummary {
  totalRegistered: number;
  checkedInCount: number;
  notCheckedInCount: number;
  waitingCount: number;
  onStageCount: number;
  completedCount: number;
}

interface QrModalData {
  id: number;
  code: string;
  name: string;
  email: string;
  qrPayload: string;
  qrDataUrl: string;
}

export default function AdminPage() {
  const [participants, setParticipants] = useState<ParticipantDetail[]>([]);
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [checkInFilter, setCheckInFilter] = useState<
    "all" | "checked_in" | "not_checked_in"
  >("all");
  const [stageFilter, setStageFilter] = useState<"all" | StageStatus>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<ParticipantDetail | null>(
    null
  );
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [qrModal, setQrModal] = useState<QrModalData | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  const loadParticipants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (checkInFilter !== "all") params.set("checkInStatus", checkInFilter);
      if (stageFilter !== "all") params.set("stageStatus", stageFilter);

      const res = await fetch(`/api/participants?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const errData = (await res.json()) as { message?: string };
        setError(errData.message ?? "加载参与者列表失败");
        return;
      }
      const data = (await res.json()) as {
        participants: ParticipantDetail[];
        stats: StatsSummary;
      };
      setParticipants(data.participants);
      setStats(data.stats);
    } catch {
      setError("无法连接服务器，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [checkInFilter, searchQuery, stageFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadParticipants();
    }, 150);
    return () => clearTimeout(timer);
  }, [loadParticipants]);

  function openCreateModal() {
    setEditingTarget(null);
    setFormName("");
    setFormEmail("");
    setFormCode("");
    setFormError(null);
    setFormOpen(true);
  }

  function openEditModal(p: ParticipantDetail) {
    setEditingTarget(p);
    setFormName(p.name);
    setFormEmail(p.email);
    setFormCode(p.code);
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSaveParticipant(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    try {
      if (editingTarget) {
        const res = await fetch(`/api/participants/${editingTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            email: formEmail,
            code: formCode,
          }),
        });
        const data = (await res.json()) as { message?: string };
        if (!res.ok) {
          setFormError(data.message ?? "更新参与者资料失败");
          return;
        }
      } else {
        const res = await fetch("/api/participants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName,
            email: formEmail,
            ...(formCode.trim() ? { code: formCode.trim() } : {}),
          }),
        });
        const data = (await res.json()) as {
          message?: string;
          participant?: ParticipantDetail;
          qrDataUrl?: string;
        };
        if (!res.ok) {
          setFormError(data.message ?? "新增参与者失败");
          return;
        }
        if (data.participant && data.qrDataUrl) {
          setQrModal({
            id: data.participant.id,
            code: data.participant.code,
            name: data.participant.name,
            email: data.participant.email,
            qrPayload: data.participant.qrPayload,
            qrDataUrl: data.qrDataUrl,
          });
        }
      }

      setFormOpen(false);
      await loadParticipants();
    } catch {
      setFormError("请求失败，请检查网络连接");
    } finally {
      setSaving(false);
    }
  }

  async function openQrModal(p: ParticipantDetail) {
    setQrLoading(true);
    setCopiedPayload(false);
    try {
      const res = await fetch(`/api/participants/${p.id}/qr`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as QrModalData;
        setQrModal(data);
      }
    } finally {
      setQrLoading(false);
    }
  }

  async function handleCopyPayload(payload: string) {
    try {
      await navigator.clipboard.writeText(payload);
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  }

  return (
    <AppShell
      title="管理后台（参与者与二维码管理）"
      subtitle="新增或编辑毕业典礼参与者，生成专属二维码并实时查看签到与上台进度"
      requireAdminRole
    >
      {() => (
        <div className="space-y-5">
          {stats && (
            <div className="no-print grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: "总登记人数", value: stats.totalRegistered, tone: "text-slate-900" },
                { label: "已签到", value: stats.checkedInCount, tone: "text-emerald-700" },
                { label: "未签到", value: stats.notCheckedInCount, tone: "text-slate-600" },
                { label: "等候上台", value: stats.waitingCount, tone: "text-amber-700" },
                { label: "正在上台", value: stats.onStageCount, tone: "text-blue-700" },
                { label: "已完成上台", value: stats.completedCount, tone: "text-emerald-700" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs"
                >
                  <div className="text-xs font-medium text-slate-500">
                    {stat.label}
                  </div>
                  <div className={`mt-1 text-2xl font-bold ${stat.tone}`}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="no-print rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 flex-1">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索姓名、邮箱或编号…"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>

                <select
                  aria-label="签到状态筛选"
                  value={checkInFilter}
                  onChange={(e) =>
                    setCheckInFilter(
                      e.target.value as "all" | "checked_in" | "not_checked_in"
                    )
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  <option value="all">全部签到状态</option>
                  <option value="checked_in">仅看已签到</option>
                  <option value="not_checked_in">仅看未签到</option>
                </select>

                <select
                  aria-label="上台状态筛选"
                  value={stageFilter}
                  onChange={(e) =>
                    setStageFilter(e.target.value as "all" | StageStatus)
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  <option value="all">全部上台状态</option>
                  <option value="NOT_QUEUED">未入队</option>
                  <option value="WAITING">等候上台</option>
                  <option value="ON_STAGE">正在上台</option>
                  <option value="COMPLETED">已完成</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void loadParticipants()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  刷新
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Printer className="h-4 w-4" />
                  打印名单
                </button>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                >
                  <Plus className="h-4 w-4" />
                  新增参与者
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Desktop table */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">唯一编号</th>
                    <th className="px-4 py-3">姓名</th>
                    <th className="px-4 py-3">邮箱</th>
                    <th className="px-4 py-3">签到状态</th>
                    <th className="px-4 py-3">上台状态</th>
                    <th className="no-print px-4 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        正在加载参与者数据…
                      </td>
                    </tr>
                  ) : participants.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        没有符合条件的参与者记录
                      </td>
                    </tr>
                  ) : (
                    participants.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-900 whitespace-nowrap">
                          {p.code}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                          {p.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{p.email}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <div>
                              <CheckInBadge checkedInAt={p.checkedInAt} />
                            </div>
                            {p.checkedInAt && (
                              <span className="text-xs text-slate-500">
                                {formatTime(p.checkedInAt)} ·{" "}
                                {p.checkedInByName ?? "—"}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <div>
                              <StageStatusBadge status={p.stageStatus} />
                            </div>
                            {p.queuedAt && (
                              <span className="text-xs text-slate-500">
                                入队 {formatTime(p.queuedAt)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="no-print px-4 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              disabled={qrLoading}
                              onClick={() => void openQrModal(p)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <QrCode className="h-3.5 w-3.5 text-blue-800" />
                              二维码
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(p)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              编辑
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {loading ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                正在加载参与者数据…
              </div>
            ) : participants.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                没有符合条件的参与者记录
              </div>
            ) : (
              participants.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-semibold text-blue-900">
                        {p.code}
                      </span>
                      <h3 className="text-base font-semibold text-slate-900">
                        {p.name}
                      </h3>
                      <p className="text-xs text-slate-500 truncate">
                        {p.email}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <CheckInBadge checkedInAt={p.checkedInAt} />
                      <StageStatusBadge status={p.stageStatus} />
                    </div>
                  </div>

                  {p.checkedInAt && (
                    <div className="text-xs text-slate-500">
                      签到时间：{formatTime(p.checkedInAt)}（操作员：
                      {p.checkedInByName ?? "—"}）
                    </div>
                  )}

                  <div className="no-print flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={qrLoading}
                      onClick={() => void openQrModal(p)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700"
                    >
                      <QrCode className="h-3.5 w-3.5 text-blue-800" />
                      查看二维码
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(p)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      编辑资料
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add / Edit Modal */}
          {formOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h2 className="text-base font-semibold text-slate-900">
                    {editingTarget ? "编辑参与者资料" : "新增参与者"}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setFormOpen(false)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form
                  onSubmit={(e) => void handleSaveParticipant(e)}
                  className="mt-4 space-y-4"
                >
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      姓名 *
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="例如 张三"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      邮箱 *
                    </label>
                    <input
                      type="email"
                      required
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="san.zhang@grad.edu"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      唯一编号{editingTarget ? " *" : "（留空则自动生成）"}
                    </label>
                    <input
                      type="text"
                      required={Boolean(editingTarget)}
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                      placeholder="例如 GRAD-2026-017"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  {formError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {formError}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setFormOpen(false)}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
                    >
                      {saving ? "保存中…" : "保存"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* QR Modal */}
          {qrModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
              <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h2 className="text-base font-semibold text-slate-900">
                    专属入场及舞台二维码
                  </h2>
                  <button
                    type="button"
                    onClick={() => setQrModal(null)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="text-lg font-bold text-slate-900">
                    {qrModal.name}
                  </div>
                  <div className="font-mono text-sm font-semibold text-blue-900">
                    {qrModal.code}
                  </div>
                  <div className="text-xs text-slate-500">{qrModal.email}</div>

                  <div className="mx-auto mt-3 flex w-fit items-center justify-center rounded-xl border border-slate-200 bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrModal.qrDataUrl}
                      alt={`${qrModal.code} 二维码`}
                      className="h-56 w-56"
                    />
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <a
                    href={qrModal.qrDataUrl}
                    download={`${qrModal.code}.png`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-900 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                  >
                    <Download className="h-3.5 w-3.5" />
                    下载 PNG
                  </a>
                  <button
                    type="button"
                    onClick={() => void handleCopyPayload(qrModal.qrPayload)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {copiedPayload ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        已复制内容
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        复制签名内容
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
