export const DOWNLOAD_QUEUE_KEY = "voklerDownloadQueue";
export const MAX_DOWNLOAD_QUEUE_ITEMS = 32;

export type DownloadQueueStatus = "pending" | "running" | "completed" | "failed";

export type DownloadQueueItem = {
  localId: string;
  pageUrl: string;
  pageTitle: string;
  displayTitle: string;
  format: string;
  thumbnailUrl?: string | null;
  status: DownloadQueueStatus;
  apiJobId?: string;
  progress: number;
  error?: string | null;
  filename: string;
  createdAt: number;
  updatedAt: number;
};

export function extForFormatKey(format: string): string {
  const f = format.toLowerCase();
  if (f.startsWith("mp3")) return ".mp3";
  return ".mp4";
}

export function sanitizeVideoFilename(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 120) || "vokler-download";
}

export function compactQueueItems(items: DownloadQueueItem[]): DownloadQueueItem[] {
  const active = items.filter((i) => i.status === "pending" || i.status === "running");
  const done = items
    .filter((i) => i.status === "completed" || i.status === "failed")
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 14);
  active.sort((a, b) => a.createdAt - b.createdAt);
  return [...active, ...done].slice(0, MAX_DOWNLOAD_QUEUE_ITEMS);
}

/**
 * Pure enqueue step (persist from the popup via chrome.storage to avoid MV3 message-port drops).
 */
export function appendPendingDownload(
  existing: DownloadQueueItem[],
  input: {
    pageUrl: string;
    pageTitle: string;
    displayTitle: string;
    format: string;
    thumbnailUrl: string | null;
  },
):
  | { ok: true; next: DownloadQueueItem[]; localId: string }
  | { ok: false; error: string } {
  const url = input.pageUrl.trim();
  if (!url) return { ok: false, error: "Missing page URL" };

  const dup = existing.some(
    (i) => i.pageUrl === url && (i.status === "pending" || i.status === "running"),
  );
  if (dup) {
    return { ok: false, error: "This video is already in the queue or downloading." };
  }

  const localId = crypto.randomUUID();
  const fmt = input.format.trim() || "original";
  const baseName = sanitizeVideoFilename(input.displayTitle || input.pageTitle || "video");
  const item: DownloadQueueItem = {
    localId,
    pageUrl: url,
    pageTitle: input.pageTitle.slice(0, 400),
    displayTitle: (input.displayTitle || input.pageTitle).slice(0, 400),
    format: fmt,
    thumbnailUrl: input.thumbnailUrl ?? null,
    status: "pending",
    progress: 0,
    error: null,
    filename: `${baseName.slice(0, 120)}${extForFormatKey(fmt)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const next = compactQueueItems([...existing, item]);
  return { ok: true, next, localId };
}
