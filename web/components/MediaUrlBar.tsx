"use client";

type Props = {
  url: string;
  onUrlChange: (v: string) => void;
  onGetInfo: () => void;
  loadingInfo: boolean;
  disabled?: boolean;
};

export function MediaUrlBar({
  url,
  onUrlChange,
  onGetInfo,
  loadingInfo,
  disabled,
}: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <label htmlFor="media-url" className="text-sm font-medium text-zinc-700">
          Video / stream URL
        </label>
        <input
          id="media-url"
          type="url"
          required
          placeholder="https://…"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          disabled={disabled || loadingInfo}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-900 outline-none placeholder:text-zinc-400 shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 disabled:opacity-50"
        />
      </div>
      <button
        type="button"
        onClick={onGetInfo}
        disabled={disabled || loadingInfo || !url.trim()}
        className="shrink-0 rounded-lg bg-sky-600 px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-sky-500 disabled:opacity-50"
      >
        {loadingInfo ? "Loading info…" : "Get video info"}
      </button>
    </div>
  );
}
