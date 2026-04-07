"use client";

import { useCallback, useEffect, useMemo } from "react";

import { LandingContent } from "@/components/LandingContent";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VideoInfoPanel } from "@/components/VideoInfoPanel";
import { useToast } from "@/components/ui/toast/Toast";
import { looksLikeHttpUrl, parseUrls } from "@/lib/download/urlHelpers";
import { useJobProgressWebSocket } from "@/lib/useWebSocket";
import { type JobDto, wsUrlForJob } from "@/lib/api";
import {
  autoPreviewAttemptKey,
  cancelAutoFetchDebounce,
  scheduleAutoFetchDebounce,
  selectAllUrls,
  useDownloadStore,
  type DownloadMode,
} from "@/stores/downloadStore";
import Image from "next/image";

const PLATFORMS: { label: string; dot: string }[] = [
  { label: "YouTube", dot: "#ff0000" },
  { label: "TikTok", dot: "#010101" },
  { label: "Instagram", dot: "#e1306c" },
  { label: "Twitter", dot: "#1da1f2" },
  { label: "Facebook", dot: "#1877f2" },
  { label: "Vimeo", dot: "#1ab7ea" },
  { label: "+ more", dot: "#555" },
];

function modeLabel(mode: DownloadMode): string {
  switch (mode) {
    case "single":
      return "Paste video URL";
    case "multi":
      return "Add multiple URLs";
    case "playlist":
      return "Paste playlist URL";
    case "profile":
      return "Paste profile / channel URL";
    default:
      return "Paste video URL";
  }
}

function modePlaceholder(mode: DownloadMode): string {
  switch (mode) {
    case "single":
      return "https://youtube.com/watch?v=…";
    case "multi":
      return "https://example.com/watch?v=…\nhttps://…";
    case "playlist":
      return "Playlist or mix: …/playlist?list=… or watch?v=…&list=…";
    case "profile":
      return "https://instagram.com/username or https://youtube.com/@channel";
    default:
      return "https://…";
  }
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-90 ${className ?? ""}`}
      aria-hidden
    />
  );
}

function TabIcon({
  name,
}: {
  name: "single" | "multi" | "playlist" | "profile";
}) {
  const stroke = "currentColor";
  if (name === "single") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        aria-hidden
      >
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M8 12h8M12 8v8" />
      </svg>
    );
  }
  if (name === "multi") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        aria-hidden
      >
        <path d="M4 6h16M4 12h10M4 18h13" />
      </svg>
    );
  }
  if (name === "playlist") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        aria-hidden
      >
        <rect x="2" y="4" width="20" height="4" rx="1" />
        <rect x="2" y="10" width="20" height="4" rx="1" />
        <rect x="2" y="16" width="20" height="4" rx="1" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

export default function HomePage() {
  const { addToast } = useToast();

  const mode = useDownloadStore((s) => s.mode);
  const url = useDownloadStore((s) => s.url);
  const preview = useDownloadStore((s) => s.preview);
  const selectedFormatId = useDownloadStore((s) => s.selectedFormatId);
  const loadingInfo = useDownloadStore((s) => s.loadingInfo);
  const archiveJob = useDownloadStore((s) => s.archiveJob);
  const singleJob = useDownloadStore((s) => s.singleJob);
  const activeJobId = useDownloadStore((s) => s.activeJobId);
  const sourceUrl = useDownloadStore((s) => s.sourceUrl);
  const downloading = useDownloadStore((s) => s.downloading);
  const autoPreviewBlockedKey = useDownloadStore(
    (s) => s.autoPreviewBlockedKey,
  );

  const setMode = useDownloadStore((s) => s.setMode);
  const onUrlInputChange = useDownloadStore((s) => s.onUrlInputChange);
  const setSelectedFormatId = useDownloadStore((s) => s.setSelectedFormatId);
  const clearArchiveJob = useDownloadStore((s) => s.clearArchiveJob);
  const clearPreviewSession = useDownloadStore((s) => s.clearPreviewSession);
  const fetchInfoManual = useDownloadStore((s) => s.fetchInfoManual);
  const runFetchPreview = useDownloadStore((s) => s.runFetchPreview);
  const runDownload = useDownloadStore((s) => s.runDownload);
  const pasteFromClipboardStore = useDownloadStore((s) => s.pasteFromClipboard);

  const allUrls = useMemo(
    () => selectAllUrls({ mode, url, sourceUrl }),
    [mode, url, sourceUrl],
  );

  const onWsProgress = useCallback(
    (data: { job_id?: string; progress?: number; status?: string }) => {
      const st = useDownloadStore.getState();
      const jid = data.job_id ?? st.activeJobId;
      if (!jid || st.mode !== "single") return;
      const patch: Partial<JobDto> = {
        ...(typeof data.progress === "number"
          ? { progress: data.progress }
          : {}),
        ...(typeof data.status === "string"
          ? { status: data.status as JobDto["status"] }
          : {}),
      };
      if (Object.keys(patch).length) st.patchSingleJobIfMatch(jid, patch);
    },
    [],
  );

  useJobProgressWebSocket(
    activeJobId,
    activeJobId ? wsUrlForJob(activeJobId) : null,
    onWsProgress,
  );

  useEffect(() => {
    if (mode === "multi") {
      cancelAutoFetchDebounce();
      return;
    }
    if (downloading || loadingInfo) {
      cancelAutoFetchDebounce();
      return;
    }
    const primary = url.trim();
    if (!primary || !looksLikeHttpUrl(primary)) {
      cancelAutoFetchDebounce();
      return;
    }
    if (autoPreviewAttemptKey(mode, primary) === autoPreviewBlockedKey) {
      cancelAutoFetchDebounce();
      return;
    }
    scheduleAutoFetchDebounce(
      primary,
      (p) => void runFetchPreview(p, addToast),
    );
    return () => cancelAutoFetchDebounce();
  }, [
    url,
    mode,
    downloading,
    loadingInfo,
    autoPreviewBlockedKey,
    runFetchPreview,
    addToast,
  ]);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) pasteFromClipboardStore(text);
    } catch {
      addToast("Clipboard access denied or empty", { type: "warning" });
    }
  }, [addToast, pasteFromClipboardStore]);

  return (
    <div className="mx-auto max-w-[780px] px-5 pb-16 pt-10">
      <div className="mb-12 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px]">
            <Image src="/vokler.png" alt="Vokler" width={160} height={160} />
          </div>
          <div className="font-sans text-[20px] font-bold tracking-tight">
            Vokler
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>

      <div className="mb-10 text-center">
        <h1 className="mb-2.5 text-[clamp(26px,5vw,38px)] font-semibold leading-[1.15] tracking-tight">
          Download from{" "}
          <span className="vok-hero-highlight">any platform,</span>
          <br />
          any format, instantly
        </h1>
        <p
          className="text-[14px] font-normal"
          style={{ color: "var(--vok-muted)" }}
        >
          YouTube · TikTok · Instagram · Twitter · Facebook · Vimeo · and more
        </p>
      </div>

      <div className="mb-10 flex flex-wrap justify-center gap-2">
        {PLATFORMS.map((p) => (
          <div
            key={p.label}
            className="flex cursor-default items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition"
            style={{
              background: "var(--vok-surface2)",
              borderColor: "var(--vok-border)",
              color: "var(--vok-muted)",
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: p.dot }}
            />
            {p.label}
          </div>
        ))}
      </div>

      <div
        id="vok-fetch-tool"
        className="mb-6 flex gap-1 rounded-[var(--vok-radius)] border p-1"
        style={{
          background: "var(--vok-surface2)",
          borderColor: "var(--vok-border)",
        }}
        role="tablist"
      >
        {(
          [
            ["single", "Single"],
            ["multi", "Multiple"],
            ["playlist", "Playlist"],
            ["profile", "Profile"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            disabled={downloading}
            aria-disabled={downloading}
            title={downloading ? "Finish the current download before switching mode" : undefined}
            onClick={() => setMode(key)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[9px] px-3 py-2 text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-55"
            style={
              mode === key
                ? { background: "var(--vok-accent)", color: "#fff" }
                : { color: "var(--vok-muted)", background: "transparent" }
            }
          >
            <span className="h-3.5 w-3.5 shrink-0 [&>svg]:h-full [&>svg]:w-full">
              <TabIcon name={key} />
            </span>
            {label}
          </button>
        ))}
      </div>

      {!preview ? (
        <div
          className="mb-4 rounded-[var(--vok-radius-lg)] border p-6 transition-opacity duration-200"
          style={{
            background: "var(--vok-surface)",
            borderColor: "var(--vok-border)",
            opacity: loadingInfo ? 0.92 : 1,
          }}
          aria-busy={loadingInfo}
          aria-live="polite"
        >
          <div
            className="mb-3 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--vok-muted)" }}
          >
            {modeLabel(mode)}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <div className="relative min-w-0 flex-1">
              {mode === "multi" ? (
                <textarea
                  placeholder={modePlaceholder(mode)}
                  value={url}
                  rows={5}
                  onChange={(e) => onUrlInputChange(e.target.value)}
                  disabled={downloading || loadingInfo}
                  className="min-h-[120px] w-full resize-y rounded-[var(--vok-radius)] py-3 pl-4 pr-12 text-[14px] leading-relaxed outline-none transition-[border-color] placeholder:text-[var(--vok-muted2)] disabled:opacity-50"
                  style={{
                    background: "var(--vok-surface2)",
                    border: "1px solid var(--vok-border2)",
                    color: "var(--vok-text)",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--vok-accent)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--vok-border2)";
                  }}
                />
              ) : (
                <input
                  type="url"
                  placeholder={modePlaceholder(mode)}
                  value={url}
                  onChange={(e) => onUrlInputChange(e.target.value)}
                  disabled={downloading || loadingInfo}
                  className="min-h-[46px] w-full rounded-[var(--vok-radius)] py-3 pl-4 pr-12 text-[14px] outline-none transition-[border-color] placeholder:text-[var(--vok-muted2)] disabled:opacity-50"
                  style={{
                    background: "var(--vok-surface2)",
                    border: "1px solid var(--vok-border2)",
                    color: "var(--vok-text)",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--vok-accent)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--vok-border2)";
                  }}
                />
              )}
              <button
                type="button"
                onClick={() => void pasteFromClipboard()}
                disabled={downloading || loadingInfo}
                className={
                  mode === "multi"
                    ? "absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-lg transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
                    : "absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
                }
                style={{
                  color: "var(--vok-muted)",
                  background: "var(--vok-surface3)",
                  border: "1px solid var(--vok-border)",
                }}
                aria-label="Paste from clipboard"
                title="Paste from clipboard"
              >
                <ClipboardIcon className="h-[18px] w-[18px]" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => fetchInfoManual(addToast)}
              disabled={
                downloading ||
                loadingInfo ||
                (mode === "multi" ? parseUrls(url).length === 0 : !url.trim())
              }
              className="flex min-h-[46px] shrink-0 items-center justify-center gap-2 self-start rounded-[var(--vok-radius)] px-5 text-[14px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50 sm:min-w-[7.5rem] sm:px-6"
              style={{
                background:
                  "linear-gradient(135deg, var(--vok-accent), #8b5cf6)",
              }}
            >
              {loadingInfo ? <Spinner /> : null}
              {loadingInfo ? "Fetching" : "Fetch"}
            </button>
          </div>
          {mode === "multi" ? (
            <p
              className="mt-2 text-[12px]"
              style={{ color: "var(--vok-muted)" }}
            >
              One URL per line. Fetch previews the first link. Download queues
              every line, then builds one ZIP.
            </p>
          ) : null}
          {/* {mode === "playlist" || mode === "profile" ? (
            <p
              className="mt-2 text-[12px]"
              style={{ color: "var(--vok-muted)" }}
            >
              Fetch loads metadata for the URL. Download expands the playlist,
              Mix (<code className="font-mono text-[11px]">list=RD…</code>
              ), or channel tab into individual videos (up to 100), then
              delivers one ZIP. Paste a watch link with{" "}
              <code className="font-mono text-[11px]">
                watch?v=…{"&"}list=…
              </code>{" "}
              if you like—playlist mode resolves the full mix from{" "}
              <code className="font-mono text-[11px]">list</code>.
            </p>
          ) : null} */}
        </div>
      ) : null}

      {preview ? (
        <>
          <VideoInfoPanel
            preview={preview}
            selectedFormatId={selectedFormatId}
            onSelectFormat={setSelectedFormatId}
            onDownload={() => void runDownload(addToast)}
            onChangeUrl={clearPreviewSession}
            downloading={downloading}
            downloadProgress={
              mode === "single" && singleJob
                ? singleJob.progress
                : mode !== "single" && archiveJob
                  ? archiveJob.progress
                  : null
            }
            downloadLabel={
              mode === "multi" && allUrls.length > 0
                ? `Download ZIP (${allUrls.length} links)`
                : mode === "playlist" || mode === "profile"
                  ? "Download ZIP (playlist / channel)"
                  : undefined
            }
            singleDownloadCompleted={
              mode === "single" &&
              !downloading &&
              (singleJob?.status ?? "").toLowerCase() === "completed"
            }
          />
        </>
      ) : null}

      {preview && mode !== "single" ? (
        <>
          <div className="mb-6 mt-10 flex items-center gap-2.5">
            <hr
              className="min-w-0 flex-1 border-0 border-t"
              style={{ borderColor: "var(--vok-border)" }}
            />
            <span
              className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--vok-muted)" }}
            >
              Bundle
            </span>
            <hr
              className="min-w-0 flex-1 border-0 border-t"
              style={{ borderColor: "var(--vok-border)" }}
            />
          </div>
          <div
            className="rounded-[var(--vok-radius)] border p-4"
            style={{
              background: "var(--vok-surface2)",
              borderColor: "var(--vok-border)",
            }}
          >
            <div
              className="mb-2 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--vok-muted)" }}
            >
              {archiveJob?.source_urls?.length
                ? `Videos in this ZIP (${archiveJob.source_urls.length})`
                : "URLs to include"}
            </div>
            <ul
              className="max-h-[220px] list-inside list-decimal space-y-1 overflow-y-auto break-all pl-1 text-[12px] leading-relaxed"
              style={{ color: "var(--vok-text)" }}
            >
              {(archiveJob?.source_urls?.length
                ? archiveJob.source_urls
                : allUrls
              ).map((u, i) => (
                <li key={`${i}-${u.slice(0, 120)}`}>{u}</li>
              ))}
            </ul>
            {archiveJob ? (
              <div
                className="mt-4 border-t pt-3"
                style={{ borderColor: "var(--vok-border)" }}
              >
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span style={{ color: "var(--vok-muted)" }}>
                    {archiveJob.status === "completed"
                      ? "ZIP built — check your downloads folder"
                      : archiveJob.status === "failed"
                        ? (archiveJob.error_message ?? "Archive failed")
                        : `Downloading ${Math.min(archiveJob.current_index + 1, archiveJob.total_items)} / ${archiveJob.total_items}`}
                  </span>
                  <span
                    className="font-mono font-semibold"
                    style={{ color: "var(--vok-accent)" }}
                  >
                    {Math.round(
                      Math.min(100, Math.max(0, archiveJob.progress)),
                    )}
                    %
                  </span>
                </div>
                <div
                  className="h-[3px] overflow-hidden rounded"
                  style={{ background: "var(--vok-surface3)" }}
                >
                  <div
                    className="h-full rounded transition-[width] duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(0, archiveJob.progress))}%`,
                      background:
                        "linear-gradient(90deg, var(--vok-accent), var(--vok-accent3))",
                    }}
                  />
                </div>
                {!downloading ? (
                  <button
                    type="button"
                    onClick={() => clearArchiveJob()}
                    className="mt-3 rounded-[var(--vok-radius)] border px-3 py-2 text-[12px] font-medium transition hover:opacity-90"
                    style={{
                      borderColor: "var(--vok-border2)",
                      color: "var(--vok-muted)",
                      background: "var(--vok-surface3)",
                    }}
                  >
                    Clear status
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      <LandingContent />
    </div>
  );
}
