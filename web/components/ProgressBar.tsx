"use client";

type Props = {
  progress: number;
  status: string;
  message?: string | null;
};

export function ProgressBar({ progress, status, message }: Props) {
  const pct = Math.min(100, Math.max(0, progress));

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold uppercase tracking-wide text-sky-700">
          {status}
        </span>
        <span className="tabular-nums text-zinc-600">{Math.round(pct)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
        <div
          className="h-full rounded-full bg-sky-600 transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      {message ? (
        <p className="text-sm text-red-700">{message}</p>
      ) : null}
    </div>
  );
}
