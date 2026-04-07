"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PreviewResponseDto } from "@/lib/api";
import { buildDownloadMenuEntries, type DownloadMenuCategory } from "@/lib/previewFormats";

type Props = {
  preview: PreviewResponseDto;
  selectedFormatId: string;
  onSelectFormat: (formatId: string) => void;
  onDownload: () => void;
  /** Clear preview and go back to URL input. */
  onChangeUrl?: () => void;
  downloading: boolean;
  downloadLabel?: string;
  /** 0–100 while server is preparing the file (single-download flow). */
  downloadProgress?: number | null;
  /**
   * Single-tab only: job finished and file flow ran — show “Completed” + redownload
   * (``onChangeUrl``) instead of Download / format dropdown.
   */
  singleDownloadCompleted?: boolean;
};

const CATEGORY_LABEL: Record<DownloadMenuCategory, string> = {
  video_audio: "Video with sound",
  audio: "Audio only",
  video_only: "Video only (no sound)",
};

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

function MuteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`${className ?? ""} transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function VideoInfoPanel({
  preview,
  selectedFormatId,
  onSelectFormat,
  onDownload,
  onChangeUrl,
  downloading,
  downloadLabel,
  downloadProgress,
  singleDownloadCompleted = false,
}: Props) {
  const thumb = preview.thumbnail;
  const { formats, recommended_format } = preview;
  const bundleItems = preview.bundle_items;
  const showBundleRows = bundleItems != null && bundleItems.length > 0;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpenEffective = menuOpen && !singleDownloadCompleted;
  const menuRef = useRef<HTMLDivElement>(null);

  const menu = useMemo(
    () => buildDownloadMenuEntries(formats, recommended_format ?? null),
    [formats, recommended_format],
  );

  useEffect(() => {
    if (menu.length === 0) return;
    const ids = new Set(menu.map((m) => m.format_id));
    if (!selectedFormatId || !ids.has(selectedFormatId)) {
      const rec = menu.find((m) => m.isRecommended) ?? menu[0];
      if (rec) onSelectFormat(rec.format_id);
    }
  }, [menu, selectedFormatId, onSelectFormat]);

  useEffect(() => {
    function onDoc(ev: MouseEvent) {
      if (!menuRef.current?.contains(ev.target as Node)) setMenuOpen(false);
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const selectedEntry = useMemo(
    () => menu.find((m) => m.format_id === selectedFormatId) ?? menu[0] ?? null,
    [menu, selectedFormatId],
  );

  const grouped = useMemo(() => {
    type Cat = DownloadMenuCategory;
    const order: Cat[] = ["video_audio", "audio", "video_only"];
    const map = new Map<Cat, typeof menu>();
    for (const cat of order) map.set(cat, []);
    for (const item of menu) {
      map.get(item.category)?.push(item);
    }
    return order.map((catOr) => ({ category: catOr, items: map.get(catOr) ?? [] }));
  }, [menu]);

  const pickFormat = useCallback(
    (formatId: string) => {
      onSelectFormat(formatId);
      setMenuOpen(false);
    },
    [onSelectFormat],
  );

  return (
    <div
      className="vok-video-panel rounded-[var(--vok-radius-lg)] border"
      style={{
        background: "var(--vok-surface)",
        borderColor: "var(--vok-border)",
      }}
    >
      <div className="p-5 sm:p-6">
        {onChangeUrl ? (
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={onChangeUrl}
              disabled={downloading}
              className="text-[12px] font-medium underline-offset-2 transition hover:underline disabled:opacity-50"
              style={{ color: "var(--vok-muted)" }}
            >
              Change URL
            </button>
          </div>
        ) : null}
        {showBundleRows ? (
          <div className="space-y-3">
            <div>
              <h2 className="text-[16px] font-semibold leading-snug sm:text-lg">
                {preview.bundle_title ?? preview.title ?? "Playlist"}
              </h2>
              <p className="mt-0.5 text-[13px]" style={{ color: "var(--vok-muted)" }}>
                {bundleItems.length} video{bundleItems.length !== 1 ? "s" : ""}
                {preview.uploader ? ` · ${preview.uploader}` : ""}
              </p>
            </div>
            <ul
              className="max-h-[min(52vh,440px)] divide-y overflow-y-auto rounded-[var(--vok-radius)] border"
              style={{
                borderColor: "var(--vok-border)",
                background: "var(--vok-surface2)",
              }}
              role="list"
              aria-label="Videos in this bundle"
            >
              {bundleItems.map((item, i) => (
                <li key={`${item.url.slice(0, 120)}-${i}`} className="flex items-stretch gap-3 px-3 py-2.5 sm:px-4">
                  <span
                    className="w-6 shrink-0 pt-1 text-center text-[11px] font-mono tabular-nums"
                    style={{ color: "var(--vok-muted)" }}
                  >
                    {i + 1}
                  </span>
                  <div
                    className="relative h-[52px] w-[92px] shrink-0 overflow-hidden rounded-[8px]"
                    style={{
                      background: "var(--vok-surface3)",
                      border: "1px solid var(--vok-border)",
                    }}
                  >
                    {item.thumbnail ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={item.thumbnail} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <PlayIcon className="h-5 w-5 opacity-35" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 py-0.5">
                    <p className="text-[13px] font-medium leading-snug break-words line-clamp-2">{item.title}</p>
                    {item.duration_label ? (
                      <p className="mt-1 text-[11px]" style={{ color: "var(--vok-muted)" }}>
                        {item.duration_label}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-stretch sm:gap-6">
            {thumb ? (
              <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-[10px] sm:w-44 sm:max-w-[40%]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumb} alt="" className="h-full w-full object-cover" />
              </div>
            ) : (
              <div
                className="flex aspect-video w-full shrink-0 items-center justify-center rounded-[10px] sm:w-44 sm:max-w-[40%]"
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
                  className="h-8 w-8 opacity-40"
                  aria-hidden
                >
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
              <h2 className="text-[16px] font-semibold leading-snug sm:text-lg">{preview.title ?? "Untitled"}</h2>
              <p className="text-[13px]" style={{ color: "var(--vok-muted)" }}>
                {preview.duration_label ??
                  (preview.duration_seconds != null ? `${preview.duration_seconds}s` : null)}
                {preview.duration_label || preview.duration_seconds != null ? " · " : null}
                {preview.uploader ?? "Unknown channel"}
              </p>
            </div>
          </div>
        )}
      </div>

      <div
        className="border-t px-5 py-4 sm:px-6"
        style={{ borderColor: "var(--vok-border)", background: "var(--vok-surface2)" }}
      >
        <div ref={menuRef} className="relative flex flex-col gap-3 sm:flex-row sm:items-stretch">
          {singleDownloadCompleted ? (
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
              <div
                className="flex min-h-[48px] flex-1 items-center gap-2 rounded-[var(--vok-radius)] border px-4 text-[14px] font-semibold"
                style={{
                  background: "rgba(57, 217, 138, 0.12)",
                  borderColor: "rgba(57, 217, 138, 0.35)",
                  color: "var(--vok-green)",
                }}
                role="status"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5 shrink-0" aria-hidden>
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Completed
              </div>
              <button
                type="button"
                onClick={() => onChangeUrl?.()}
                className="flex min-h-[48px] shrink-0 items-center justify-center rounded-[var(--vok-radius)] border px-5 text-[14px] font-semibold transition hover:opacity-90 sm:min-w-[10.5rem]"
                style={{
                  borderColor: "var(--vok-border2)",
                  background: "var(--vok-surface)",
                  color: "var(--vok-text)",
                }}
              >
                Redownload video
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void onDownload()}
                disabled={downloading || !selectedFormatId || menu.length === 0}
                className="flex min-h-[48px] shrink-0 items-center justify-center rounded-[var(--vok-radius)] px-6 text-[15px] font-bold text-white shadow-md transition hover:brightness-105 disabled:opacity-50 sm:min-w-[9.5rem]"
                style={{
                  background: "var(--vok-green)",
                  boxShadow: "0 4px 14px rgba(57, 217, 138, 0.35)",
                }}
              >
                {downloading
                  ? downloadProgress != null
                    ? `${Math.round(Math.min(100, Math.max(0, downloadProgress)))}%`
                    : "…"
                  : (downloadLabel ?? "Download")}
              </button>

              <div className="relative min-w-0 flex-1">
                <button
                  type="button"
                  disabled={menu.length === 0 || downloading}
                  onClick={() => setMenuOpen((o) => !o)}
                  className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-[var(--vok-radius)] border px-4 text-left text-[14px] font-medium transition hover:opacity-95 disabled:opacity-50"
                  style={{
                    background: "var(--vok-surface)",
                    borderColor: "var(--vok-border2)",
                    color: "var(--vok-text)",
                  }}
                  aria-expanded={menuOpenEffective}
                  aria-haspopup="listbox"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {selectedEntry?.category === "video_only" ? (
                      <MuteIcon className="h-4 w-4 shrink-0 text-red-400" />
                    ) : selectedEntry?.isRecommended ? (
                      <PlayIcon className="h-4 w-4 shrink-0 text-sky-400" />
                    ) : null}
                    <span className="truncate">
                      {selectedEntry ? selectedEntry.title : "Choose format"}
                      {selectedEntry?.hint ? (
                        <span className="font-normal" style={{ color: "var(--vok-muted)" }}>
                          {" "}
                          — {selectedEntry.hint}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <ChevronIcon open={menuOpenEffective} className="h-5 w-5 shrink-0 opacity-70" />
                </button>

                {menuOpenEffective && menu.length > 0 ? (
                  <div
                    className="absolute bottom-full left-0 right-0 z-50 mb-2 max-h-[min(70vh,420px)] overflow-y-auto rounded-[var(--vok-radius)] border py-1 shadow-xl sm:bottom-auto sm:top-full sm:mt-2 sm:mb-0"
                    style={{
                      background: "var(--vok-surface)",
                      borderColor: "var(--vok-border2)",
                      boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
                    }}
                    role="listbox"
                    aria-label="Download format"
                  >
                    {grouped.map(({ category, items }) =>
                      items.length === 0 ? null : (
                        <div key={category}>
                          <div
                            className="sticky top-0 px-3 py-2 text-[10px] font-bold uppercase tracking-wider"
                            style={{
                              color: "var(--vok-muted)",
                              background: "var(--vok-surface)",
                              borderBottom: "1px solid var(--vok-border)",
                            }}
                          >
                            {CATEGORY_LABEL[category]}
                          </div>
                          {items.map((entry) => {
                            const selected = entry.format_id === selectedFormatId;
                            return (
                              <button
                                key={entry.format_id}
                                type="button"
                                role="option"
                                aria-selected={selected}
                                onClick={() => pickFormat(entry.format_id)}
                                className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left text-[13px] transition"
                                style={{
                                  background: selected ? "var(--vok-row-hover)" : "transparent",
                                  color: "var(--vok-text)",
                                }}
                              >
                                <span className="mt-0.5 shrink-0">
                                  {entry.category === "video_only" ? (
                                    <MuteIcon className="h-4 w-4 text-red-400" />
                                  ) : entry.isRecommended ? (
                                    <PlayIcon className="h-4 w-4 text-sky-400" />
                                  ) : (
                                    <span className="inline-block h-4 w-4" aria-hidden />
                                  )}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="font-medium" style={{ color: "var(--vok-green)" }}>
                                    {entry.title}
                                  </span>
                                  {entry.hint ? (
                                    <span className="mt-0.5 block text-[11px]" style={{ color: "var(--vok-muted)" }}>
                                      {entry.hint}
                                    </span>
                                  ) : null}
                                </span>
                                {entry.isRecommended ? (
                                  <span
                                    className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                                    style={{ background: "var(--vok-accent)", color: "#fff" }}
                                  >
                                    Best
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      ),
                    )}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>

        {downloading && downloadProgress != null && downloadProgress >= 0 ? (
          <div
            className="mt-3 h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: "var(--vok-surface3)" }}
            role="progressbar"
            aria-valuenow={Math.round(downloadProgress)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{
                width: `${Math.min(100, Math.max(0, downloadProgress))}%`,
                background: "var(--vok-green)",
              }}
            />
          </div>
        ) : null}

        {!singleDownloadCompleted ? (
          <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "var(--vok-muted2)" }}>
            Pick a format from the list, then tap Download. Video-only streams have no sound — good for editing
            or merging elsewhere.
          </p>
        ) : (
          <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "var(--vok-muted2)" }}>
            Redownload video clears this clip and returns you to the link box, same as Change URL.
          </p>
        )}
      </div>
    </div>
  );
}
