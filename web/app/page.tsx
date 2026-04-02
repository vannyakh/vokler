"use client";

import { useCallback, useState } from "react";

import { MediaUrlBar } from "@/components/MediaUrlBar";
import { ProgressBar } from "@/components/ProgressBar";
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

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<PreviewResponseDto | null>(null);
  const [selectedFormatId, setSelectedFormatId] = useState("");
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [job, setJob] = useState<JobDto | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const onWsProgress = useCallback(
    (data: { progress?: number; status?: string }) => {
      setJob((prev) =>
        prev
          ? {
              ...prev,
              progress: data.progress ?? prev.progress,
              status: data.status ?? prev.status,
            }
          : prev,
      );
    },
    [],
  );

  useJobProgressWebSocket(
    job?.id ?? null,
    job ? wsUrlForJob(job.id) : null,
    onWsProgress,
  );

  const fetchInfo = useCallback(async () => {
    setFormError(null);
    setPreview(null);
    setJob(null);
    setLoadingInfo(true);
    try {
      const data = await previewMedia(url);
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
  }, [url]);

  const runDownload = useCallback(async () => {
    if (!selectedFormatId || !url.trim()) return;
    setFormError(null);
    setDownloading(true);
    setJob(null);
    try {
      const created = await apiFetch<JobDto>("/download", {
        method: "POST",
        body: JSON.stringify({
          url: url.trim(),
          format: selectedFormatId,
        }),
      });
      setJob(created);

      let terminal = ["completed", "failed"].includes(created.status);
      while (!terminal) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const next = await apiFetch<JobDto>(`/jobs/${created.id}`);
        setJob(next);
        terminal = ["completed", "failed"].includes(next.status);
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }, [url, selectedFormatId]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          Vokler Download
        </h1>
        <p className="mt-2 text-zinc-600">
          Paste a link, fetch details (title, length, quality, size), pick a row, then
          download — similar to desktop download tools.
        </p>
      </div>

      <MediaUrlBar
        url={url}
        onUrlChange={(v) => {
          setUrl(v);
          setPreview(null);
          setJob(null);
          setFormError(null);
        }}
        onGetInfo={() => void fetchInfo()}
        loadingInfo={loadingInfo}
        disabled={downloading}
      />

      {formError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {formError}
        </p>
      ) : null}

      {preview ? (
        <VideoInfoPanel
          preview={preview}
          selectedFormatId={selectedFormatId}
          onSelectFormat={setSelectedFormatId}
          onDownload={() => void runDownload()}
          downloading={downloading}
        />
      ) : null}

      {job ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-zinc-700">Transfer</h3>
          <ProgressBar
            progress={job.progress}
            status={job.status}
            message={job.error_message}
          />
          {job.result_path ? (
            <p className="break-all text-xs text-zinc-500">{job.result_path}</p>
          ) : null}
        </div>
      ) : null}

      {loadingInfo ? (
        <p className="text-center text-xs text-zinc-600" aria-live="polite">
          Querying media metadata…
        </p>
      ) : null}
    </div>
  );
}
