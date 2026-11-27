"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { GraduationCap, Maximize2, Minimize2, Sparkles } from "lucide-react";

interface PublicDisplayState {
  currentOnStage: {
    code: string;
    name: string;
    calledAt: string | null;
  } | null;
  nextInQueue: {
    code: string;
    name: string;
  } | null;
  waitingCount: number;
  completedCount: number;
  updatedAt: string;
}

export default function StageDisplayPage() {
  const [state, setState] = useState<PublicDisplayState | null>(null);
  const [connected, setConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch("/api/stage/state?scope=public", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as PublicDisplayState;
        setState(data);
      }
    } catch {
      // Ignore transient errors
    }
  }, []);

  useEffect(() => {
    let active = true;
    const syncInitial = async () => {
      try {
        const res = await fetch("/api/stage/state?scope=public", {
          cache: "no-store",
        });
        if (res.ok && active) {
          const data = (await res.json()) as PublicDisplayState;
          setState(data);
        }
      } catch {
        // Ignore transient errors
      }
    };
    void syncInitial();

    const eventSource = new EventSource("/api/stage/stream?scope=public");
    eventSource.onopen = () => setConnected(true);
    eventSource.onerror = () => setConnected(false);
    eventSource.addEventListener("stage", (event) => {
      try {
        const parsed = JSON.parse(event.data) as PublicDisplayState;
        setState(parsed);
        setConnected(true);
      } catch {
        // Ignore parse error
      }
    });

    // Lightweight fallback sync every 5 seconds in case of proxy/reconnect delay
    const fallbackTimer = setInterval(() => {
      void fetchSnapshot();
    }, 5_000);

    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);

    return () => {
      active = false;
      eventSource.close();
      clearInterval(fallbackTimer);
      document.removeEventListener("fullscreenchange", handleFsChange);
    };
  }, [fetchSnapshot]);

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore fullscreen denial
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white px-6 py-6 sm:px-12 sm:py-8">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300 ring-1 ring-amber-300/30">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div>
            <div className="text-sm font-semibold tracking-wide text-amber-200 sm:text-base">
              2026 届毕业典礼舞台大屏
            </div>
            <div className="flex items-center gap-2 text-xs text-blue-200/80">
              <span
                className={`h-2 w-2 rounded-full ${
                  connected ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
              <span>{connected ? "实时同步已连接" : "正在重连…"}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/stage"
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-blue-100 hover:bg-white/10"
          >
            舞台控台
          </Link>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" />
                退出全屏
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5" />
                全屏显示
              </>
            )}
          </button>
        </div>
      </header>

      <main className="my-auto flex flex-col items-center justify-center py-12 text-center">
        {state?.currentOnStage ? (
          <div className="max-w-4xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-4 py-1.5 text-sm font-semibold tracking-wider text-amber-300 ring-1 ring-amber-300/30">
              <Sparkles className="h-4 w-4" />
              正在上台 · ON STAGE
            </div>

            <h1 className="text-5xl font-bold tracking-tight text-white sm:text-7xl lg:text-8xl">
              {state.currentOnStage.name}
            </h1>

            <div className="inline-block rounded-2xl border border-white/15 bg-white/10 px-6 py-3 font-mono text-2xl font-semibold tracking-widest text-amber-300 sm:text-4xl">
              {state.currentOnStage.code}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-blue-200">
              舞台准备中
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
              等待工作人员呼叫下一位毕业生
            </h1>
            <p className="text-base text-blue-200/80 sm:text-lg">
              控台切换参与者后，大屏将自动实时刷新显示
            </p>
          </div>
        )}
      </main>

      <footer className="flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-5 text-sm text-blue-100/80 sm:flex-row">
        <div>
          {state?.nextInQueue ? (
            <span>
              下一位准备：
              <strong className="ml-1.5 text-white">
                {state.nextInQueue.name}
              </strong>
              <span className="ml-2 font-mono text-amber-300">
                {state.nextInQueue.code}
              </span>
            </span>
          ) : (
            <span>当前等候队列暂无下一位</span>
          )}
        </div>

        <div className="flex items-center gap-5 text-xs sm:text-sm">
          <span>
            等候上台：
            <strong className="ml-1 text-amber-300">
              {state?.waitingCount ?? 0}
            </strong>
          </span>
          <span>
            已完成上台：
            <strong className="ml-1 text-emerald-300">
              {state?.completedCount ?? 0}
            </strong>
          </span>
        </div>
      </footer>
    </div>
  );
}
