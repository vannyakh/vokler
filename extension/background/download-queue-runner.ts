import {
  bundledFrontendAppKey,
  headersJsonWithAppKey,
  headersWithAppKey,
} from "../shared/api-auth";
import {
  compactQueueItems,
  DOWNLOAD_QUEUE_KEY,
  type DownloadQueueItem,
  sanitizeVideoFilename,
} from "../shared/download-queue";

const SETTINGS_KEY = "voklerPopupSettings";
const DEFAULT_API_BASE = "http://127.0.0.1:8000";

async function readSettingsBase(): Promise<string> {
  const d = await chrome.storage.local.get(SETTINGS_KEY);
  const raw = d[SETTINGS_KEY] as { apiBaseUrl?: string } | undefined;
  const u = (raw?.apiBaseUrl ?? DEFAULT_API_BASE).trim().replace(/\/$/, "");
  return u || DEFAULT_API_BASE;
}

async function readSettingsAppKey(): Promise<string | undefined> {
  const d = await chrome.storage.local.get(SETTINGS_KEY);
  const raw = d[SETTINGS_KEY] as { frontendAppKey?: string } | undefined;
  const fromStorage = raw?.frontendAppKey?.trim();
  if (fromStorage) return fromStorage;
  return bundledFrontendAppKey();
}

async function apiReadError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) return JSON.stringify(j.detail);
  } catch {
    /* ignore */
  }
  return text || `${res.status} ${res.statusText}`;
}

async function loadQueue(): Promise<DownloadQueueItem[]> {
  const d = await chrome.storage.local.get(DOWNLOAD_QUEUE_KEY);
  const q = d[DOWNLOAD_QUEUE_KEY];
  return Array.isArray(q) ? q : [];
}

async function saveFullQueue(items: DownloadQueueItem[]): Promise<void> {
  await chrome.storage.local.set({ [DOWNLOAD_QUEUE_KEY]: compactQueueItems(items) });
}

async function replaceItem(updated: DownloadQueueItem): Promise<void> {
  const q = await loadQueue();
  const idx = q.findIndex((x) => x.localId === updated.localId);
  if (idx < 0) return;
  const next = [...q];
  next[idx] = { ...updated, updatedAt: Date.now() };
  await saveFullQueue(next);
}

async function saveJobFile(
  base: string,
  appKey: string | undefined,
  jobId: string,
  filename: string,
): Promise<void> {
  const linkRes = await fetch(
    `${base}/files/${encodeURIComponent(jobId.trim())}/download-link`,
    { headers: headersWithAppKey(appKey) },
  );
  if (!linkRes.ok) throw new Error(await apiReadError(linkRes));
  const link = (await linkRes.json()) as { mode: string; url: string };
  const safeName = sanitizeVideoFilename(filename);

  const downloadUrl = (url: string): Promise<void> =>
    new Promise((resolve, reject) => {
      chrome.downloads.download({ url, filename: safeName, saveAs: false }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });

  if (link.mode === "redirect") {
    await downloadUrl(link.url);
    return;
  }
  const fileUrl = link.url.startsWith("http") ? link.url : `${base}${link.url}`;
  const fr = await fetch(fileUrl, { headers: headersWithAppKey(appKey) });
  if (!fr.ok) throw new Error(await apiReadError(fr));
  const blob = await fr.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    await downloadUrl(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

let runnerLock = false;

/** Sequential processor: finishes current job (even if user navigates away) before starting the next. */
export async function runDownloadQueue(): Promise<void> {
  if (runnerLock) return;
  runnerLock = true;
  try {
    for (;;) {
      const q = await loadQueue();
      const work =
        q.find((i) => i.status === "running") ?? q.find((i) => i.status === "pending");
      if (!work) break;

      const base = await readSettingsBase();
      const appKey = await readSettingsAppKey();

      if (work.status === "pending") {
        try {
          const res = await fetch(`${base}/download`, {
            method: "POST",
            headers: headersJsonWithAppKey(appKey),
            body: JSON.stringify({ url: work.pageUrl, format: work.format }),
          });
          if (!res.ok) {
            work.status = "failed";
            work.error = await apiReadError(res);
            await replaceItem(work);
            continue;
          }
          const job = (await res.json()) as { id: string; progress?: number };
          work.status = "running";
          work.apiJobId = job.id;
          work.progress = typeof job.progress === "number" ? job.progress : 0;
          work.error = null;
          await replaceItem(work);
          continue;
        } catch (e) {
          work.status = "failed";
          work.error = e instanceof Error ? e.message : String(e);
          await replaceItem(work);
          continue;
        }
      }

      if (work.status === "running" && work.apiJobId) {
        try {
          const res = await fetch(`${base}/jobs/${encodeURIComponent(work.apiJobId)}`, {
            headers: headersWithAppKey(appKey),
          });
          if (!res.ok) {
            work.status = "failed";
            work.error = await apiReadError(res);
            await replaceItem(work);
            continue;
          }
          const job = (await res.json()) as {
            status: string;
            progress?: number;
            error_message?: string | null;
          };
          work.progress = typeof job.progress === "number" ? job.progress : work.progress;
          await replaceItem(work);

          const st = String(job.status).toLowerCase();
          if (st === "failed") {
            work.status = "failed";
            work.error = job.error_message ?? "Download failed";
            await replaceItem(work);
            continue;
          }
          if (st === "completed") {
            try {
              await saveJobFile(base, appKey, work.apiJobId, work.filename);
              work.status = "completed";
              work.progress = 100;
              work.error = null;
            } catch (e) {
              work.status = "failed";
              work.error = e instanceof Error ? e.message : String(e);
            }
            await replaceItem(work);

            const data = await chrome.storage.local.get(SETTINGS_KEY);
            const stt = data[SETTINGS_KEY] as { notifyOnComplete?: boolean } | undefined;
            if (stt?.notifyOnComplete === true && work.status === "completed") {
              chrome.notifications.create({
                type: "basic",
                iconUrl: chrome.runtime.getURL("icons/icon-48.png"),
                title: "Vokler — Download ready",
                message: work.displayTitle.slice(0, 96),
              });
            }
            continue;
          }

          await new Promise((r) => setTimeout(r, 650));
          continue;
        } catch (e) {
          work.status = "failed";
          work.error = e instanceof Error ? e.message : String(e);
          await replaceItem(work);
          continue;
        }
      }
    }
  } finally {
    runnerLock = false;
  }
}

export function scheduleDownloadQueue(): void {
  void runDownloadQueue();
}
