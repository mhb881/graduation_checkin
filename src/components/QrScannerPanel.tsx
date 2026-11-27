"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, CameraOff, ImageUp, Keyboard, Search } from "lucide-react";

interface QrScannerPanelProps {
  onScan: (raw: string, mode: "qr" | "manual") => Promise<void> | void;
  disabled?: boolean;
  actionLabel?: string;
}

export function QrScannerPanel({
  onScan,
  disabled = false,
  actionLabel = "查询参与者",
}: QrScannerPanelProps) {
  const rawId = useId();
  const containerId = `qr-reader-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const scannerRef = useRef<{
    stop: () => Promise<void>;
    clear: () => void;
    scanFile: (file: File, showImage?: boolean) => Promise<string>;
  } | null>(null);
  const lastScanRef = useRef<{ text: string; time: number }>({
    text: "",
    time: 0,
  });

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function stopCamera() {
    const instance = scannerRef.current;
    scannerRef.current = null;
    setCameraActive(false);
    if (instance) {
      try {
        await instance.stop();
      } catch {
        // Ignore stop errors if already stopped
      }
      try {
        instance.clear();
      } catch {
        // Ignore clear errors
      }
    }
  }

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, []);

  async function handleStartCamera() {
    setCameraError(null);
    setCameraStarting(true);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      await stopCamera();

      const html5QrCode = new Html5Qrcode(containerId, { verbose: false });
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1,
        },
        (decodedText) => {
          const now = Date.now();
          if (
            decodedText === lastScanRef.current.text &&
            now - lastScanRef.current.time < 1800
          ) {
            return;
          }
          lastScanRef.current = { text: decodedText, time: now };
          void onScan(decodedText, "qr");
        },
        () => {
          // Ignore per-frame decode misses
        }
      );
      setCameraActive(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "无法开启手机摄像头";
      const needsHttps =
        typeof window !== "undefined" &&
        !window.isSecureContext &&
        window.location.hostname !== "localhost";

      setCameraError(
        needsHttps
          ? "当前浏览器处于非 HTTPS 局域网地址，手机浏览器安全策略不允许直接开启摄像头。请改用 HTTPS 访问，或使用下方图片识别 / 手动输入编号。"
          : `摄像头启动失败：${message}。可使用下方二维码图片识别或手动输入编号。`
      );
      await stopCamera();
    } finally {
      setCameraStarting(false);
    }
  }

  async function handleFileScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setCameraError(null);
    setSubmitting(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const tempScanner = new Html5Qrcode(`${containerId}-file`, {
        verbose: false,
      });
      const decoded = await tempScanner.scanFile(file, false);
      tempScanner.clear();
      await onScan(decoded, "qr");
    } catch {
      setCameraError("未能从上传的图片中识别到有效二维码，请重试或手动输入编号。");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = manualCode.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await onScan(trimmed, trimmed.startsWith("{") ? "qr" : "manual");
      setManualCode("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-blue-800" />
          <h2 className="text-sm font-semibold text-slate-900">
            二维码扫描与编号输入
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {cameraActive ? (
            <button
              type="button"
              onClick={() => void stopCamera()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <CameraOff className="h-3.5 w-3.5" />
              关闭摄像头
            </button>
          ) : (
            <button
              type="button"
              disabled={cameraStarting || disabled}
              onClick={() => void handleStartCamera()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              <Camera className="h-3.5 w-3.5" />
              {cameraStarting ? "正在启动…" : "开启摄像头扫码"}
            </button>
          )}

          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
            <ImageUp className="h-3.5 w-3.5" />
            <span>识别图片</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={disabled || submitting}
              onChange={(e) => void handleFileScan(e)}
            />
          </label>
        </div>
      </div>

      <div
        id={containerId}
        className={`overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-950/5 ${
          cameraActive ? "min-h-64" : "min-h-0"
        }`}
      />
      <div id={`${containerId}-file`} className="hidden" />

      {!cameraActive && !cameraError && (
        <p className="text-xs text-slate-500">
          点击「开启摄像头扫码」即可在手机浏览器中直接扫码；也可上传二维码图片或直接输入编号。
        </p>
      )}

      {cameraError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {cameraError}
        </div>
      )}

      <form onSubmit={(e) => void handleManualSubmit(e)} className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
          <Keyboard className="h-3.5 w-3.5 text-slate-500" />
          手动输入参与者唯一编号（或粘贴二维码 JSON）
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="例如 GRAD-2026-009"
            disabled={disabled || submitting}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
          <button
            type="submit"
            disabled={disabled || submitting || !manualCode.trim()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            {submitting ? "处理中…" : actionLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
