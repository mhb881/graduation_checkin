"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  GraduationCap,
  QrCode,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  CheckInBadge,
  formatTime,
  StageStatusBadge,
} from "@/components/StatusBadges";
import type { StageStatus } from "@/db/schema";

interface PassParticipant {
  code: string;
  name: string;
  email: string;
  checkedInAt: string | null;
  stageStatus: StageStatus;
  queuedAt: string | null;
  calledAt: string | null;
  completedAt: string | null;
  queuePosition: number | null;
}

interface PassResponse {
  participant: PassParticipant;
  qrPayload: string;
  qrDataUrl: string;
}

function PassLandingContent() {
  const searchParams = useSearchParams();
  const presetCode = searchParams.get("code") ?? "";

  const [identifier, setIdentifier] = useState(presetCode);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passData, setPassData] = useState<PassResponse | null>(null);

  const fetchPass = useCallback(
    async (targetIdentifier: string, targetEmail: string, silent = false) => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }

      try {
        const res = await fetch("/api/pass", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: targetIdentifier,
            email: targetEmail,
          }),
        });

        const data = (await res.json()) as PassResponse & { message?: string };
        if (!res.ok) {
          if (!silent) {
            setError(data.message ?? "领取入场券失败，请核对填写信息");
          }
          return;
        }
        setPassData(data);
      } catch {
        if (!silent) {
          setError("网络异常，请稍后重试");
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!passData) return;
    const timer = setInterval(() => {
      if (!document.hidden) {
        void fetchPass(passData.participant.code, passData.participant.email, true);
      }
    }, 3_000);
    return () => clearInterval(timer);
  }, [fetchPass, passData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetchPass(identifier, email, false);
  }

  function fillDemo(demoIdentifier: string, demoEmail: string) {
    setIdentifier(demoIdentifier);
    setEmail(demoEmail);
    setError(null);
  }

  const stepState = passData
    ? {
        claimed: true,
        checkedIn: Boolean(passData.participant.checkedInAt),
        queuedOrStage:
          passData.participant.stageStatus === "WAITING" ||
          passData.participant.stageStatus === "ON_STAGE" ||
          passData.participant.stageStatus === "COMPLETED",
        completed: passData.participant.stageStatus === "COMPLETED",
      }
    : null;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </Link>
          <Link
            href="/login"
            className="text-xs font-medium text-blue-800 hover:underline"
          >
            工作人员登录
          </Link>
        </div>

        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-900 text-white shadow-sm">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h1 className="mt-3 text-xl font-bold text-slate-900">
            毕业典礼电子入场券领取
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            验证个人资料后领取专属二维码，入场签到与舞台排队全程通用
          </p>
        </div>

        {!passData ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  姓名 或 唯一编号
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="例如 吴诗涵 或 GRAD-2026-009"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  登记邮箱
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="shihan.wu@grad.edu"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-900 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                <QrCode className="h-4 w-4" />
                {loading ? "正在核验并生成…" : "领取我的专属二维码"}
              </button>
            </form>

            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-xs font-medium text-slate-500 mb-2">
                现场演示快捷填入
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fillDemo("吴诗涵", "shihan.wu@grad.edu")}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  吴诗涵（按姓名）
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo("GRAD-2026-010", "jiacheng.xu@grad.edu")}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  GRAD-2026-010
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-gradient-to-r from-blue-950 to-blue-800 px-6 py-5 text-white">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-xs font-semibold text-amber-300">
                    {passData.participant.code}
                  </span>
                  <h2 className="mt-0.5 text-2xl font-bold">
                    {passData.participant.name}
                  </h2>
                  <p className="mt-0.5 text-xs text-blue-100">
                    {passData.participant.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void fetchPass(
                      passData.participant.code,
                      passData.participant.email,
                      false
                    )
                  }
                  aria-label="刷新状态"
                  className="rounded-lg bg-white/15 p-2 text-white hover:bg-white/25"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-6 text-center space-y-4">
              {passData.participant.stageStatus === "ON_STAGE" && (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  当前已呼叫到您，请立即上台！
                </div>
              )}

              {passData.participant.stageStatus === "WAITING" &&
                passData.participant.queuePosition !== null && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-900">
                    舞台候场队列中：您当前排在{" "}
                    <strong className="font-mono text-base text-blue-800">
                      第 {passData.participant.queuePosition} 位
                    </strong>
                  </div>
                )}

              {/* Forced white background + quiet zone so mobile cameras scan reliably even in dark mode */}
              <div className="mx-auto inline-flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={passData.qrDataUrl}
                  alt={`${passData.participant.code} 专属二维码`}
                  className="h-56 w-56 bg-white"
                />
                <span className="mt-2 font-mono text-sm font-bold tracking-wider text-slate-900">
                  {passData.participant.code}
                </span>
              </div>

              <p className="text-xs text-slate-500">
                请将此二维码展示给签到处或舞台组工作人员扫描；建议保存到相册备用
              </p>

              <div className="flex items-center justify-center gap-2">
                <CheckInBadge checkedInAt={passData.participant.checkedInAt} />
                <StageStatusBadge status={passData.participant.stageStatus} />
              </div>

              {stepState && (
                <div className="grid grid-cols-4 gap-1.5 rounded-xl bg-slate-50 p-3 text-[11px]">
                  {[
                    { label: "已领码", done: stepState.claimed },
                    { label: "已签到", done: stepState.checkedIn },
                    { label: "舞台候场", done: stepState.queuedOrStage },
                    { label: "已上台", done: stepState.completed },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className={`flex flex-col items-center gap-1 rounded-lg py-1.5 ${
                        s.done
                          ? "bg-emerald-50 text-emerald-800 font-semibold"
                          : "text-slate-400"
                      }`}
                    >
                      <CheckCircle2
                        className={`h-3.5 w-3.5 ${
                          s.done ? "text-emerald-600" : "text-slate-300"
                        }`}
                      />
                      <span>{s.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {passData.participant.checkedInAt && (
                <p className="text-xs text-emerald-700">
                  入场签到时间：{formatTime(passData.participant.checkedInAt)}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <a
                  href={passData.qrDataUrl}
                  download={`${passData.participant.code}.png`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-900 px-3 py-2.5 text-xs font-semibold text-white hover:bg-blue-800"
                >
                  <Download className="h-3.5 w-3.5" />
                  保存二维码
                </a>
                <button
                  type="button"
                  onClick={() => setPassData(null)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  切换其他人
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ParticipantPassPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-500">
          加载中…
        </div>
      }
    >
      <PassLandingContent />
    </Suspense>
  );
}
