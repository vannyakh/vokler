"use client";

import { useEffect, useMemo, useState } from "react";

import type { PreviewResponseDto } from "@/lib/api";
import { formatBytes } from "@/lib/formatBytes";
import {
  availableBucketHeights,
  isAudioOnlyRow,
  parseHeightPx,
  QUALITY_BUCKETS,
  resolveFormatId,
  snapHeightToBucket,
  uniqueExts,
} from "@/lib/previewFormats";

type Props = {
  preview: PreviewResponseDto;
  selectedFormatId: string;
  onSelectFormat: (formatId: string) => void;
  onDownload: () => void;
  downloading: boolean;
  downloadLabel?: string;
};

const OUTPUT_EXTS = ["mp4", "webm", "mov", "mp3", "aac", "flac"] as const;

function pillBase(selected: boolean): string {
  return `rounded-lg border px-3.5 py-1.5 text-[12px] font-medium transition`;
}

export function VideoInfoPanel({
  preview,
  selectedFormatId,
  onSelectFormat,
  onDownload,
  downloading,
  downloadLabel,
}: Props) {
  const thumb = preview.thumbnail;
  const { formats, recommended_format } = preview;

  const [mediaKind, setMediaKind] = useState<"video" | "audio">("video");
  const [qualityHeight, setQualityHeight] = useState<number>(1080);
  const [ext, setExt] = useState<string>("mp4");

  // Initialize pills from recommended / first row when preview loads
  useEffect(() => {
    const row =
      formats.find((f) => f.format_id === recommended_format) ?? formats[0];
    if (!row) return;
    const kind = isAudioOnlyRow(row) ? "audio" : "video";
    setMediaKind(kind);
    setExt((row.ext || "mp4").toLowerCase());
    const h = parseHeightPx(row);
    setQualityHeight(h ? snapHeightToBucket(h) : 1080);
  }, [formats, recommended_format]);

  const extsAvailable = useMemo(
    () => uniqueExts(formats, mediaKind),
    [formats, mediaKind],
  );

  const extChoices = useMemo(() => {
    const ordered = OUTPUT_EXTS.filter((e) => extsAvailable.includes(e));
    const rest = extsAvailable.filter((e) => !OUTPUT_EXTS.includes(e as (typeof OUTPUT_EXTS)[number]));
    return [...ordered, ...rest];
  }, [extsAvailable]);

  const heightAvailable = useMemo(
    () => availableBucketHeights(formats, mediaKind, ext),
    [formats, mediaKind, ext],
  );

  const resolvedId = useMemo(
    () =>
      resolveFormatId(formats, {
        mediaKind,
        targetHeight: mediaKind === "audio" ? null : qualityHeight,
        ext,
        recommended_format,
      }),
    [formats, mediaKind, qualityHeight, ext, recommended_format],
  );

  useEffect(() => {
    if (resolvedId && resolvedId !== selectedFormatId) {
      onSelectFormat(resolvedId);
    }
  }, [resolvedId, selectedFormatId, onSelectFormat]);

  // If current ext not in list, snap to first choice
  useEffect(() => {
    if (extChoices.length && !extChoices.includes(ext)) {
      setExt(extChoices[0]);
    }
  }, [ext, extChoices]);

  // If quality bucket not available, snap to nearest available
  useEffect(() => {
    if (mediaKind === "audio") return;
    if (heightAvailable.size === 0) return;
    if (!heightAvailable.has(qualityHeight)) {
      const order = QUALITY_BUCKETS.map((b) => b.height);
      const found = order.find((h) => heightAvailable.has(h));
      if (found !== undefined) setQualityHeight(found);
    }
  }, [heightAvailable, qualityHeight, mediaKind]);

  const recommendedRow = formats.find((f) => f.format_id === recommended_format);
  const recommendedBucket =
    recommendedRow && parseHeightPx(recommendedRow) !== null
      ? snapHeightToBucket(parseHeightPx(recommendedRow)!)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-[var(--vok-radius-lg)] border p-6"
        style={{
          background: "var(--vok-surface)",
          borderColor: "var(--vok-border)",
        }}
      >
        <p
          className="mb-3 text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--vok-muted)" }}
        >
          Media details
        </p>
        <div className="flex flex-col gap-4 sm:flex-row">
          {thumb ? (
            <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-[10px] sm:w-56">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb} alt="" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div
              className="flex aspect-video w-full shrink-0 items-center justify-center rounded-[10px] sm:w-56"
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
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-snug">{preview.title ?? "Untitled"}</h2>
            <dl className="mt-3 grid gap-2 text-sm" style={{ color: "var(--vok-muted)" }}>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <dt className="font-medium">Duration</dt>
                <dd style={{ color: "var(--vok-text)" }}>
                  {preview.duration_label ??
                    (preview.duration_seconds != null ? `${preview.duration_seconds}s` : "—")}
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <dt className="font-medium">Channel</dt>
                <dd className="truncate" style={{ color: "var(--vok-text)" }}>
                  {preview.uploader ?? "—"}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div
        className="rounded-[var(--vok-radius-lg)] border p-6"
        style={{
          background: "var(--vok-surface)",
          borderColor: "var(--vok-border)",
        }}
      >
        <div className="mb-4 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-x-5">
          <div>
            <label
              className="mb-2 block text-[12px] font-medium"
              style={{ color: "var(--vok-muted)" }}
            >
              Format
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setMediaKind("video")}
                className={pillBase(mediaKind === "video")}
                style={
                  mediaKind === "video"
                    ? {
                        background: "rgba(108, 99, 255, 0.12)",
                        borderColor: "rgba(108, 99, 255, 0.35)",
                        color: "var(--vok-accent)",
                      }
                    : {
                        background: "var(--vok-surface3)",
                        borderColor: "var(--vok-border)",
                        color: "var(--vok-muted)",
                      }
                }
              >
                Video
              </button>
              <button
                type="button"
                onClick={() => setMediaKind("audio")}
                className={pillBase(mediaKind === "audio")}
                style={
                  mediaKind === "audio"
                    ? {
                        background: "rgba(108, 99, 255, 0.12)",
                        borderColor: "rgba(108, 99, 255, 0.35)",
                        color: "var(--vok-accent)",
                      }
                    : {
                        background: "var(--vok-surface3)",
                        borderColor: "var(--vok-border)",
                        color: "var(--vok-muted)",
                      }
                }
              >
                Audio only
              </button>
            </div>
          </div>
          <div
            style={{
              opacity: mediaKind === "audio" ? 0.45 : 1,
              pointerEvents: mediaKind === "audio" ? "none" : "auto",
            }}
          >
            <label
              className="mb-2 block text-[12px] font-medium"
              style={{ color: "var(--vok-muted)" }}
            >
              Quality
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUALITY_BUCKETS.map((b) => {
                const has = heightAvailable.size === 0 || heightAvailable.has(b.height);
                const selected = qualityHeight === b.height;
                return (
                  <button
                    key={b.height}
                    type="button"
                    disabled={!has}
                    onClick={() => setQualityHeight(b.height)}
                    className={`font-mono ${pillBase(selected)} ${!has ? "opacity-40" : ""}`}
                    style={
                      selected && has
                        ? {
                            background: "rgba(67, 232, 216, 0.1)",
                            borderColor: "rgba(67, 232, 216, 0.35)",
                            color: "var(--vok-accent3)",
                          }
                        : {
                            background: "var(--vok-surface3)",
                            borderColor: "var(--vok-border)",
                            color: "var(--vok-muted)",
                          }
                    }
                  >
                    {b.label}
                    {"best" in b && b.best && recommendedBucket === b.height ? (
                      <span
                        className="ml-1 rounded px-1 text-[9px] font-bold"
                        style={{ background: "var(--vok-green)", color: "#000" }}
                      >
                        BEST
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label
            className="mb-2 block text-[12px] font-medium"
            style={{ color: "var(--vok-muted)" }}
          >
            Output file type
          </label>
          <div className="flex flex-wrap gap-1.5">
            {extChoices.map((e) => {
              const selected = ext === e;
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => setExt(e)}
                  className={pillBase(selected)}
                  style={
                    selected
                      ? {
                          background: "var(--vok-pill)",
                          borderColor: "var(--vok-pill-border)",
                          color: "var(--vok-accent)",
                        }
                      : {
                          background: "var(--vok-surface3)",
                          borderColor: "var(--vok-border2)",
                          color: "var(--vok-muted)",
                        }
                  }
                >
                  {e.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>

        <p className="mt-3 font-mono text-[11px]" style={{ color: "var(--vok-muted)" }}>
          Selected yt-dlp format{" "}
          <span className="rounded px-1" style={{ background: "var(--vok-surface2)" }}>
            {selectedFormatId || resolvedId || "—"}
          </span>
          {formats.find((f) => f.format_id === (selectedFormatId || resolvedId)) ? (
            <span className="ml-2">
              ·{" "}
              {formatBytes(
                formats.find((f) => f.format_id === (selectedFormatId || resolvedId))?.filesize ??
                  null,
              )}
            </span>
          ) : null}
        </p>
      </div>

      <div
        className="rounded-[var(--vok-radius-lg)] border p-6"
        style={{
          background: "var(--vok-surface)",
          borderColor: "var(--vok-border)",
        }}
      >
        <p
          className="mb-3 text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--vok-muted)" }}
        >
          Advanced options
        </p>
        <p className="mb-4 text-[12px]" style={{ color: "var(--vok-muted2)" }}>
          These controls are not wired to the server yet; coming in a future release.
        </p>
        {(
          [
            ["Extract subtitles / captions", "Download .srt file alongside the video"],
            ["Embed metadata", "Title, artist, thumbnail baked into file"],
            ["Save thumbnail", "Download cover art as separate image"],
            ["Auto-split by chapter", "Separate file per YouTube chapter"],
            ["Rate limit (slow download)", "Avoid throttle detection on some platforms"],
          ] as const
        ).map(([title, desc], i) => (
          <div
            key={title}
            className="flex items-center justify-between gap-4 border-b py-2.5 last:border-b-0"
            style={{ borderColor: "var(--vok-border)" }}
          >
            <div>
              <div className="text-[13px] font-medium">{title}</div>
              <div className="text-[11px]" style={{ color: "var(--vok-muted)" }}>
                {desc}
              </div>
            </div>
            <label className="relative inline-flex h-5 w-9 shrink-0 cursor-not-allowed opacity-50">
              <input type="checkbox" disabled className="peer sr-only" defaultChecked={i === 1} />
              <span
                className="block h-full w-full rounded-full border transition peer-checked:bg-[var(--vok-accent)]"
                style={{
                  background: "var(--vok-surface3)",
                  borderColor: "var(--vok-border2)",
                }}
              />
            </label>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onDownload}
          disabled={downloading || !selectedFormatId}
          className="rounded-[var(--vok-radius)] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg, var(--vok-accent), #8b5cf6)",
          }}
        >
          {downloading ? "Downloading…" : (downloadLabel ?? "Download")}
        </button>
      </div>
    </div>
  );
}
