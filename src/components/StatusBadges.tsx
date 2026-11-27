import type { StageStatus } from "@/db/schema";

export function CheckInBadge({ checkedInAt }: { checkedInAt: string | null }) {
  if (checkedInAt) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
        已签到
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/15">
      未签到
    </span>
  );
}

const STAGE_LABEL_MAP: Record<
  StageStatus,
  { label: string; className: string }
> = {
  NOT_QUEUED: {
    label: "未入队",
    className: "bg-slate-100 text-slate-600 ring-slate-500/15",
  },
  WAITING: {
    label: "等候上台",
    className: "bg-amber-50 text-amber-800 ring-amber-600/20",
  },
  ON_STAGE: {
    label: "正在上台",
    className: "bg-blue-50 text-blue-700 ring-blue-600/20",
  },
  COMPLETED: {
    label: "已完成",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  },
};

export function StageStatusBadge({ status }: { status: StageStatus }) {
  const cfg = STAGE_LABEL_MAP[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
