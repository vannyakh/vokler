"use client";

import type { PreviewResponseDto } from "@/lib/api";
import { formatBytes } from "@/lib/formatBytes";

type Props = {
  preview: PreviewResponseDto;
  selectedFormatId: string;
  onSelectFormat: (formatId: string) => void;
  onDownload: () => void;
  downloading: boolean;
};

function codecLabel(v: string | null, a: string | null): string {
  const parts = [];
  if (v && v !== "none") parts.push(`V: ${v.split(".")[0]}`);
  if (a && a !== "none") parts.push(`A: ${a.split(".")[0]}`);
  return parts.join(" · ") || "—";
}

export function VideoInfoPanel({
  preview,
  selectedFormatId,
  onSelectFormat,
  onDownload,
  downloading,
}: Props) {
  const thumb = preview.thumbnail;

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row">
        {thumb ? (
          <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-zinc-100 sm:w-56">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote CDN thumbnails */}
            <img
              src={thumb}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-snug text-zinc-900">
            {preview.title ?? "Untitled"}
          </h2>
          <dl className="mt-3 grid gap-1 text-sm text-zinc-600 sm:grid-cols-2">
            <div>
              <dt className="text-zinc-500">Duration</dt>
              <dd className="font-medium text-zinc-900">
                {preview.duration_label ??
                  (preview.duration_seconds != null
                    ? `${preview.duration_seconds}s`
                    : "—")}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Channel</dt>
              <dd className="truncate font-medium text-zinc-900">
                {preview.uploader ?? "—"}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Download type / quality
        </h3>
        <p className="mb-2 text-xs text-zinc-600">
          Rows marked <span className="text-zinc-700">Audio only</span> or separate video codecs may
          need merging — if a download has no sound, choose another line or use{" "}
          <code className="rounded bg-zinc-100 px-0.5">original</code> from a client preset.
        </p>
        <div className="max-h-72 overflow-auto rounded-lg border border-zinc-200">
          <table className="w-full text-left text-sm text-zinc-700">
            <thead className="sticky top-0 bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="w-10 px-2 py-2" />
                <th className="px-2 py-2">Format</th>
                <th className="px-2 py-2">Resolution</th>
                <th className="hidden px-2 py-2 sm:table-cell">Ext</th>
                <th className="hidden px-2 py-2 md:table-cell">Codecs</th>
                <th className="px-2 py-2 text-right">Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {preview.formats.map((row) => (
                <tr
                  key={row.format_id}
                  className={
                    selectedFormatId === row.format_id
                      ? "bg-sky-50"
                      : "hover:bg-zinc-50"
                  }
                >
                  <td className="px-2 py-2 align-middle">
                    <input
                      type="radio"
                      name="format"
                      checked={selectedFormatId === row.format_id}
                      onChange={() => onSelectFormat(row.format_id)}
                      className="border-zinc-300 text-sky-600 focus:ring-sky-300"
                    />
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <span className="font-mono text-xs text-sky-700">
                      {row.format_id}
                    </span>
                    {row.format_note ? (
                      <span className="ml-2 text-xs text-zinc-500">{row.format_note}</span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 align-middle">{row.resolution}</td>
                  <td className="hidden px-2 py-2 align-middle sm:table-cell">
                    {row.ext || "—"}
                  </td>
                  <td className="hidden max-w-[180px] truncate px-2 py-2 align-middle md:table-cell">
                    {codecLabel(row.vcodec, row.acodec)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right align-middle text-zinc-900">
                    {formatBytes(row.filesize)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onDownload}
          disabled={downloading || !selectedFormatId}
          className="rounded-lg bg-sky-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-sky-500 disabled:opacity-50"
        >
          {downloading ? "Downloading…" : "Download"}
        </button>
        <p className="text-xs text-zinc-500">
          Uses yt-dlp format{" "}
          <code className="rounded bg-zinc-100 px-1 text-zinc-700">
            {selectedFormatId || "—"}
          </code>
        </p>
      </div>
    </div>
  );
}
