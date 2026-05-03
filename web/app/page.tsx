"use client";

import { useCallback, useEffect } from "react";

import { VideoInfoPanel } from "@/components/VideoInfoPanel";
import { useToast } from "@/components/ui/toast/Toast";
import { looksLikeHttpUrl } from "@/lib/download/urlHelpers";
import { useJobProgressWebSocket } from "@/lib/useWebSocket";
import { type JobDto, wsUrlForJob } from "@/lib/api";
import {
  autoPreviewAttemptKey,
  cancelAutoFetchDebounce,
  scheduleAutoFetchDebounce,
  useDownloadStore,
} from "@/stores/downloadStore";

const PLATFORMS: { label: string; dot: string }[] = [
  { label: "YouTube", dot: "#ff0000" },
  { label: "TikTok", dot: "#010101" },
  { label: "Instagram", dot: "#e1306c" },
  { label: "Twitter", dot: "#1da1f2" },
  { label: "Facebook", dot: "#1877f2" },
  { label: "Vimeo", dot: "#1ab7ea" },
  { label: "+ more", dot: "#555" },
];

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

/** Fetch / preview — magnifying glass, icon-only control beside the URL field. */
function FetchIcon({ className }: { className?: string }) {
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
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export default function HomePage() {
  const { addToast } = useToast();

  const url = useDownloadStore((s) => s.url);
  const preview = useDownloadStore((s) => s.preview);
  const selectedFormatId = useDownloadStore((s) => s.selectedFormatId);
  const loadingInfo = useDownloadStore((s) => s.loadingInfo);
  const singleJob = useDownloadStore((s) => s.singleJob);
  const activeJobId = useDownloadStore((s) => s.activeJobId);
  const downloading = useDownloadStore((s) => s.downloading);
  const autoPreviewBlockedKey = useDownloadStore((s) => s.autoPreviewBlockedKey);

  const onUrlInputChange = useDownloadStore((s) => s.onUrlInputChange);
  const setSelectedFormatId = useDownloadStore((s) => s.setSelectedFormatId);
  const clearPreviewSession = useDownloadStore((s) => s.clearPreviewSession);
  const fetchInfoManual = useDownloadStore((s) => s.fetchInfoManual);
  const runFetchPreview = useDownloadStore((s) => s.runFetchPreview);
  const runDownload = useDownloadStore((s) => s.runDownload);
  const pasteFromClipboardStore = useDownloadStore((s) => s.pasteFromClipboard);

  const onWsProgress = useCallback(
    (data: { job_id?: string; progress?: number; status?: string }) => {
      const st = useDownloadStore.getState();
      const jid = data.job_id ?? st.activeJobId;
      if (!jid) return;
      const patch: Partial<JobDto> = {
        ...(typeof data.progress === "number" ? { progress: data.progress } : {}),
        ...(typeof data.status === "string" ? { status: data.status as JobDto["status"] } : {}),
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
    if (downloading || loadingInfo) {
      cancelAutoFetchDebounce();
      return;
    }
    const primary = url.trim();
    if (!primary || !looksLikeHttpUrl(primary)) {
      cancelAutoFetchDebounce();
      return;
    }
    if (autoPreviewAttemptKey("single", primary) === autoPreviewBlockedKey) {
      cancelAutoFetchDebounce();
      return;
    }
    scheduleAutoFetchDebounce(primary, (p) => void runFetchPreview(p, addToast));
    return () => cancelAutoFetchDebounce();
  }, [url, downloading, loadingInfo, autoPreviewBlockedKey, runFetchPreview, addToast]);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) pasteFromClipboardStore(text);
    } catch {
      addToast("Clipboard access denied or empty", { type: "warning" });
    }
  }, [addToast, pasteFromClipboardStore]);

  return (
    <div className="mx-auto max-w-[780px] px-5 pb-16">
      <div className="mb-10 text-center">
        <h1 className="mb-2.5 font-mono text-[clamp(22px,4.2vw,34px)] font-semibold leading-[1.2] tracking-tight">
          Download from{" "}
          <span className="bg-gradient-to-r from-[var(--vok-accent)] to-[var(--vok-accent3)] bg-clip-text text-transparent">
            any platform,
          </span>
          <br />
          any format, instantly
        </h1>
        <p className="font-mono text-[13px] font-normal sm:text-[14px]" style={{ color: "var(--vok-muted)" }}>
          YouTube · TikTok · Instagram · Twitter · Facebook · Vimeo · and more
        </p>
      </div>

      {/* Platform badges */}
      <div className="mb-10 flex flex-wrap justify-center gap-2">
        {PLATFORMS.map((p) => (
          <div
            key={p.label}
            className="flex cursor-default items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium"
            style={{
              background: "var(--vok-surface2)",
              borderColor: "var(--vok-border)",
              color: "var(--vok-muted)",
            }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: p.dot }} />
            {p.label}
          </div>
        ))}
      </div>

      {/* URL input row */}
      {!preview ? (
        <div
          className="mb-4 flex flex-row items-stretch gap-2"
          style={{ opacity: loadingInfo ? 0.92 : 1, transition: "opacity 200ms" }}
          aria-busy={loadingInfo}
          aria-live="polite"
        >
          <div className="relative min-w-0 flex-1">
            <input
              type="url"
              placeholder="https://youtube.com/watch?v=…"
              value={url}
              onChange={(e) => onUrlInputChange(e.target.value)}
              disabled={downloading || loadingInfo}
              className="min-h-[46px] w-full min-w-0 rounded-[var(--vok-radius)] py-3 pl-4 pr-12 text-[14px] outline-none transition-[border-color] placeholder:text-[var(--vok-muted2)] disabled:opacity-50"
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
            <button
              type="button"
              onClick={() => void pasteFromClipboard()}
              disabled={downloading || loadingInfo}
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
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
            disabled={downloading || loadingInfo || !url.trim()}
            className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[var(--vok-radius)] text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, var(--vok-accent), #8b5cf6)" }}
            aria-label={loadingInfo ? "Fetching video info" : "Fetch video info"}
            title={loadingInfo ? "Fetching…" : "Fetch video info"}
          >
            {loadingInfo ? <Spinner className="h-5 w-5" /> : <FetchIcon className="h-5 w-5" />}
          </button>
        </div>
      ) : null}

      {/* Video info + download panel */}
      {preview ? (
        <VideoInfoPanel
          preview={preview}
          selectedFormatId={selectedFormatId}
          onSelectFormat={setSelectedFormatId}
          onDownload={() => void runDownload(addToast)}
          onChangeUrl={clearPreviewSession}
          downloading={downloading}
          downloadProgress={singleJob ? singleJob.progress : null}
          singleDownloadCompleted={
            !downloading && (singleJob?.status ?? "").toLowerCase() === "completed"
          }
          singleJob={
            !downloading && (singleJob?.status ?? "").toLowerCase() === "completed"
              ? singleJob
              : null
          }
        />
      ) : null}
    </div>
  );
}
