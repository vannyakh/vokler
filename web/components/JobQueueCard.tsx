"use client";

import type { JobDto } from "@/lib/api";

type Props = {
  job: JobDto;
  previewTitle?: string | null;
  /** Show Copy link / Remove (session queue). */
  showActions?: boolean;
  onCopyLink?: () => void;
  onRemove?: () => void;
};

function statusStyle(
  status: string,
  progress: number,
): { label: string; className: string } {
  const s = status.toLowerCase();
  if (s === "completed") {
    return {
      label: "Done",
      className: "bg-[rgba(57,217,138,0.1)] text-[var(--vok-green)]",
    };
  }
  if (s === "failed") {
    return {
      label: "Error",
      className: "bg-[rgba(255,107,107,0.1)] text-[var(--vok-red)]",
    };
  }
  if (s === "running" || s === "pending") {
    return {
      label: `${Math.round(Math.min(100, Math.max(0, progress)))}%`,
      className: "bg-[rgba(255,209,102,0.1)] text-[var(--vok-yellow)]",
    };
  }
  return {
    label: status,
    className: "bg-[var(--vok-status-bg)] text-[var(--vok-muted)]",
  };
}

export function JobQueueCard({
  job,
  previewTitle,
  showActions = true,
  onCopyLink,
  onRemove,
}: Props) {
  const pct = Math.min(100, Math.max(0, job.progress));
  const { label, className } = statusStyle(job.status, job.progress);
  const title = previewTitle?.trim() || job.url;
  const subParts = [
    job.platform ?? "Media",
    job.download_format,
    job.status === "running" || job.status === "pending" ? "Fetching…" : null,
  ].filter(Boolean);

  return (
    <div
      className="mb-2 rounded-[var(--vok-radius)] p-4"
      style={{
        background: "var(--vok-surface2)",
        border: "1px solid var(--vok-border)",
      }}
    >
      <div className="mb-2.5 flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg"
          style={{
            background: "linear-gradient(135deg, var(--vok-surface3), var(--vok-surface2))",
            border: "1px solid var(--vok-border)",
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-[18px] w-[18px] opacity-40"
            aria-hidden
          >
            <polygon points="5,3 19,12 5,21" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">{title}</div>
          <div className="mt-0.5 text-[11px]" style={{ color: "var(--vok-muted)" }}>
            {subParts.join(" · ")}
          </div>
        </div>
        <div className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${className}`}>
          {label}
        </div>
      </div>
      <div
        className="h-[3px] overflow-hidden rounded"
        style={{ background: "var(--vok-surface3)" }}
      >
        <div
          className={`h-full rounded transition-[width] duration-300 ${
            job.status === "running" ? "animate-vok-pulse" : ""
          }`}
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, var(--vok-accent), var(--vok-accent3))",
          }}
        />
      </div>
      {job.error_message ? (
        <p className="mt-2 text-sm" style={{ color: "var(--vok-red)" }}>
          {job.error_message}
        </p>
      ) : null}
      {job.result_path ? (
        <p className="mt-2 break-all font-mono text-[11px]" style={{ color: "var(--vok-muted)" }}>
          {job.result_path}
        </p>
      ) : null}
      {showActions ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={onCopyLink}
            className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition hover:opacity-90"
            style={{
              background: "var(--vok-surface3)",
              borderColor: "var(--vok-border)",
              color: "var(--vok-muted)",
            }}
          >
            Copy link
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition hover:opacity-90"
            style={{
              background: "var(--vok-surface3)",
              borderColor: "var(--vok-border)",
              color: "var(--vok-muted)",
            }}
          >
            Remove
          </button>
        </div>
      ) : null}
    </div>
  );
}
