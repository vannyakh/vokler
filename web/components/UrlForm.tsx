"use client";

type Props = {
  url: string;
  onUrlChange: (v: string) => void;
  onSubmit: () => void;
  busy?: boolean;
};

export function UrlForm({ url, onUrlChange, onSubmit, busy }: Props) {
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="url" className="text-sm font-medium text-zinc-400">
          Media URL
        </label>
        <input
          id="url"
          type="url"
          required
          placeholder="https://…"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          disabled={busy}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-sky-500 disabled:opacity-50"
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-sky-600 px-4 py-3 font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
      >
        {busy ? "Working…" : "Start download"}
      </button>
    </form>
  );
}
