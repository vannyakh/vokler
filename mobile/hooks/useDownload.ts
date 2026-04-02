import { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";

import type { DownloadFormat } from "@/components/FormatPicker";
import { api, getApiBaseUrl } from "@/lib/api";

export type JobDto = {
  id: string;
  url: string;
  platform: string | null;
  download_format: string;
  status: string;
  progress: number;
  error_message: string | null;
  result_path: string | null;
  created_at: string;
  updated_at: string;
};

const POLL_MS = 2000;

function toApiFormat(f: DownloadFormat): string {
  if (f.kind === "audio") {
    return f.qualityId === "480" ? "mp3_192" : "mp3_320";
  }
  if (f.qualityId === "1080") return "mp4_1080p";
  if (f.qualityId === "720") return "mp4_720p";
  if (f.qualityId === "480") return "mp4_480p";
  return "original";
}

function wsUrlForJob(jobId: string): string {
  const base = getApiBaseUrl().replace(/^http/, "ws").replace(/\/$/, "");
  return `${base}/ws/jobs/${jobId}`;
}

export function useDownload() {
  const [job, setJob] = useState<JobDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const stopWs = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  useEffect(() => () => stopWs(), [stopWs]);

  const pollJob = useCallback(async (jobId: string) => {
    const res = await api.get<JobDto>(`/jobs/${jobId}`);
    setJob(res.data);
    return ["completed", "failed"].includes(res.data.status);
  }, []);

  const attachWs = useCallback(
    (jobId: string) => {
      stopWs();
      try {
        const socket = new WebSocket(wsUrlForJob(jobId));
        wsRef.current = socket;
        socket.onmessage = (ev) => {
          try {
            const data = JSON.parse(String(ev.data)) as {
              progress?: number;
              status?: string;
            };
            setJob((j) =>
              j
                ? {
                    ...j,
                    progress: data.progress ?? j.progress,
                    status: data.status ?? j.status,
                  }
                : j,
            );
          } catch {
            /* ignore malformed messages */
          }
        };
      } catch {
        /* WebSocket not available */
      }
    },
    [stopWs],
  );

  const start = useCallback(
    async (url: string, format: DownloadFormat) => {
      const body = { url, format: toApiFormat(format) };
      setError(null);
      setBusy(true);
      stopWs();
      setJob(null);
      try {
        const res = await api.post<JobDto>("/download", body);
        setJob(res.data);
        const id = res.data.id;
        attachWs(id);

        let terminal = ["completed", "failed"].includes(res.data.status);
        while (!terminal) {
          await new Promise((r) => setTimeout(r, POLL_MS));
          try {
            terminal = await pollJob(id);
          } catch (pollErr) {
            const msg = isAxiosError(pollErr)
              ? pollErr.message
              : "Polling failed";
            setError(msg);
            break;
          }
        }
      } catch (e: unknown) {
        const msg = isAxiosError(e)
          ? typeof e.response?.data === "object"
            ? JSON.stringify(e.response?.data)
            : e.message
          : e instanceof Error
            ? e.message
            : "Request failed";
        setError(msg);
        setJob(null);
      } finally {
        setBusy(false);
        stopWs();
      }
    },
    [attachWs, pollJob, stopWs],
  );

  const reset = useCallback(() => {
    setError(null);
    setJob(null);
    stopWs();
  }, [stopWs]);

  return { job, busy, error, start, reset };
}
