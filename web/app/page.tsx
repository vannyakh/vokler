"use client";

import { useCallback, useMemo, useState } from "react";

import { HistoryTable } from "@/components/HistoryTable";
import { JobQueueCard } from "@/components/JobQueueCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { VideoInfoPanel } from "@/components/VideoInfoPanel";
import {
  apiFetch,
  type JobDto,
  type PreviewResponseDto,
  previewMedia,
  wsUrlForJob,
} from "@/lib/api";
import { useJobProgressWebSocket } from "@/lib/useWebSocket";

const POLL_MS = 2000;

/** Non-empty lines = URLs (one per line). */
function parseUrls(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

type DownloadMode = "single" | "multi" | "playlist" | "profile";

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
      return "https://youtube.com/playlist?list=…";
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

function TabIcon({ name }: { name: "single" | "multi" | "playlist" | "profile" }) {
  const stroke = "currentColor";
  if (name === "single") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M8 12h8M12 8v8" />
      </svg>
    );
  }
  if (name === "multi") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" aria-hidden>
        <path d="M4 6h16M4 12h10M4 18h13" />
      </svg>
    );
  }
  if (name === "playlist") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" aria-hidden>
        <rect x="2" y="4" width="20" height="4" rx="1" />
        <rect x="2" y="10" width="20" height="4" rx="1" />
        <rect x="2" y="16" width="20" height="4" rx="1" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

export default function HomePage() {
  const [mode, setMode] = useState<DownloadMode>("single");
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<PreviewResponseDto | null>(null);
  const [selectedFormatId, setSelectedFormatId] = useState("");
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [sessionJobs, setSessionJobs] = useState<JobDto[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const onWsProgress = useCallback(
    (data: { job_id?: string; progress?: number; status?: string }) => {
      const jid = data.job_id ?? activeJobId;
      if (!jid) return;
      setSessionJobs((prev) =>
        prev.map((j) =>
          j.id === jid
            ? {
                ...j,
                progress: data.progress ?? j.progress,
                status: data.status ?? j.status,
              }
            : j,
        ),
      );
    },
    [activeJobId],
  );

  useJobProgressWebSocket(
    activeJobId,
    activeJobId ? wsUrlForJob(activeJobId) : null,
    onWsProgress,
  );

  const allUrls = useMemo(() => {
    if (mode === "multi") return parseUrls(url);
    const one = url.trim();
    return one ? [one] : [];
  }, [url, mode]);

  const fetchInfo = useCallback(async () => {
    const primary = mode === "multi" ? parseUrls(url)[0] : url.trim();
    if (!primary) return;
    setFormError(null);
    setPreview(null);
    setSessionJobs([]);
    setActiveJobId(null);
    setLoadingInfo(true);
    try {
      const data = await previewMedia(primary);
      setPreview(data);
      const def =
        data.recommended_format &&
        data.formats.some((f) => f.format_id === data.recommended_format)
          ? data.recommended_format
          : data.formats[0]?.format_id ?? "";
      setSelectedFormatId(def);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not load video info");
    } finally {
      setLoadingInfo(false);
    }
  }, [url, mode]);

  const pollUntilTerminal = useCallback(async (jobId: string) => {
    let terminal = false;
    while (!terminal) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      const next = await apiFetch<JobDto>(`/jobs/${jobId}`);
      setSessionJobs((prev) => prev.map((j) => (j.id === jobId ? next : j)));
      terminal = ["completed", "failed"].includes(next.status);
    }
  }, []);

  const runDownload = useCallback(async () => {
    if (!selectedFormatId) return;
    const targets = mode === "multi" ? parseUrls(url) : [url.trim()].filter(Boolean);
    if (targets.length === 0) return;
    setFormError(null);
    setDownloading(true);
    try {
      for (const u of targets) {
        const created = await apiFetch<JobDto>("/download", {
          method: "POST",
          body: JSON.stringify({
            url: u,
            format: selectedFormatId,
          }),
        });
        setSessionJobs((prev) => [...prev, created]);
        setActiveJobId(created.id);
        await pollUntilTerminal(created.id);
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
      setActiveJobId(null);
    }
  }, [mode, url, selectedFormatId, pollUntilTerminal]);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(mode === "multi" ? text : text.trim());
        setPreview(null);
        setSessionJobs([]);
        setActiveJobId(null);
        setFormError(null);
      }
    } catch {
      setFormError("Clipboard access denied or empty");
    }
  }, [mode]);

  return (
    <div className="mx-auto max-w-[780px] px-5 pb-16 pt-10">
      <div className="mb-12 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-[10px]"
            style={{
              background: "linear-gradient(135deg, var(--vok-accent), var(--vok-accent2))",
            }}
          >
            <svg viewBox="0 0 28 28" fill="none" stroke="#fff" strokeWidth="2.5" aria-hidden>
              <path d="M12 2L12 17M7 12l5 5 5-5M3 23h22" />
            </svg>
          </div>
          <div>
            <div
              className="font-mono text-[15px] font-bold tracking-tight"
              style={{ fontFamily: "var(--font-space-mono), monospace" }}
            >
              Vokler
            </div>
            <div className="mt-px text-[11px]" style={{ color: "var(--vok-muted)" }}>
              social video downloader
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>

      <div className="mb-10 text-center">
        <h1 className="mb-2.5 text-[clamp(26px,5vw,38px)] font-semibold leading-[1.15] tracking-tight">
          Download from{" "}
          <span
            className="bg-gradient-to-r from-[var(--vok-accent)] to-[var(--vok-accent3)] bg-clip-text text-transparent"
          >
            any platform,
          </span>
          <br />
          any format, instantly
        </h1>
        <p className="text-[14px] font-normal" style={{ color: "var(--vok-muted)" }}>
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
            <span className="h-2 w-2 rounded-full" style={{ background: p.dot }} />
            {p.label}
          </div>
        ))}
      </div>

      <div
        className="mb-6 flex gap-1 rounded-[var(--vok-radius)] border p-1"
        style={{ background: "var(--vok-surface2)", borderColor: "var(--vok-border)" }}
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
            onClick={() => {
              setMode(key);
              setFormError(null);
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-[9px] px-3 py-2 text-[13px] font-medium transition"
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

      <div
        className="mb-4 rounded-[var(--vok-radius-lg)] border p-6"
        style={{ background: "var(--vok-surface)", borderColor: "var(--vok-border)" }}
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
                onChange={(e) => {
                  setUrl(e.target.value);
                  setPreview(null);
                  setSessionJobs([]);
                  setActiveJobId(null);
                  setFormError(null);
                }}
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
                onChange={(e) => {
                  setUrl(e.target.value);
                  setPreview(null);
                  setSessionJobs([]);
                  setActiveJobId(null);
                  setFormError(null);
                }}
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
            onClick={() => void fetchInfo()}
            disabled={
              downloading ||
              loadingInfo ||
              (mode === "multi" ? parseUrls(url).length === 0 : !url.trim())
            }
            className="min-h-[46px] shrink-0 self-start rounded-[var(--vok-radius)] px-5 text-[14px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50 sm:px-6"
            style={{ background: "linear-gradient(135deg, var(--vok-accent), #8b5cf6)" }}
          >
            {loadingInfo ? "Fetching…" : "Fetch"}
          </button>
        </div>
        {mode === "multi" ? (
          <p className="mt-2 text-[12px]" style={{ color: "var(--vok-muted)" }}>
            One URL per line. Fetch previews the first link; Download runs each line in order with
            the selected format.
          </p>
        ) : null}
      </div>

      {formError ? (
        <p
          className="mb-4 rounded-[var(--vok-radius)] border px-3 py-2 text-sm"
          style={{
            borderColor: "rgba(255,107,107,0.35)",
            background: "rgba(255,107,107,0.08)",
            color: "var(--vok-red)",
          }}
        >
          {formError}
        </p>
      ) : null}

      {preview ? (
        <>
          <VideoInfoPanel
            preview={preview}
            selectedFormatId={selectedFormatId}
            onSelectFormat={setSelectedFormatId}
            onDownload={() => void runDownload()}
            downloading={downloading}
            downloadLabel={
              mode === "multi" && allUrls.length > 1
                ? `Download ${allUrls.length} links`
                : undefined
            }
          />
        </>
      ) : null}

      {loadingInfo ? (
        <p className="mb-4 text-center text-xs" style={{ color: "var(--vok-muted)" }} aria-live="polite">
          Querying media metadata…
        </p>
      ) : null}

      {sessionJobs.length > 0 ? (
        <>
          <div className="mb-6 mt-10 flex items-center gap-2.5">
            <hr className="min-w-0 flex-1 border-0 border-t" style={{ borderColor: "var(--vok-border)" }} />
            <span
              className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--vok-muted)" }}
            >
              Queue
            </span>
            <hr className="min-w-0 flex-1 border-0 border-t" style={{ borderColor: "var(--vok-border)" }} />
          </div>
          <div className="flex flex-col gap-0">
            {sessionJobs.map((j) => (
              <JobQueueCard
                key={j.id}
                job={j}
                previewTitle={
                  allUrls[0] && j.url.trim() === allUrls[0].trim()
                    ? (preview?.title ?? null)
                    : null
                }
                onCopyLink={() => {
                  void navigator.clipboard.writeText(j.url);
                }}
                onRemove={() => {
                  setSessionJobs((prev) => prev.filter((x) => x.id !== j.id));
                  if (activeJobId === j.id) setActiveJobId(null);
                }}
              />
            ))}
          </div>
          <div
            className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4"
            style={{ borderColor: "var(--vok-border)" }}
          >
            <p className="text-[12px]" style={{ color: "var(--vok-muted)" }}>
              <span style={{ color: "var(--vok-accent)", fontWeight: 600 }}>{sessionJobs.length}</span>{" "}
              in queue ·{" "}
              <span style={{ color: "var(--vok-green)", fontWeight: 600 }}>
                {sessionJobs.filter((x) => x.status === "completed").length}
              </span>{" "}
              completed
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSessionJobs([]);
                  setActiveJobId(null);
                }}
                className="rounded-[var(--vok-radius)] border px-4 py-2.5 text-[13px] font-medium transition hover:opacity-90"
                style={{
                  borderColor: "var(--vok-border2)",
                  color: "var(--vok-muted)",
                  background: "var(--vok-surface3)",
                }}
              >
                Clear queue
              </button>
            </div>
          </div>
        </>
      ) : null}

      <div className="mb-6 mt-12 flex items-center gap-2.5">
        <hr className="min-w-0 flex-1 border-0 border-t" style={{ borderColor: "var(--vok-border)" }} />
        <span
          className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: "var(--vok-muted)" }}
        >
          History
        </span>
        <hr className="min-w-0 flex-1 border-0 border-t" style={{ borderColor: "var(--vok-border)" }} />
      </div>
      <HistoryTable />
    </div>
  );
}
