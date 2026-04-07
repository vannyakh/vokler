import { scheduleDownloadQueue } from "./download-queue-runner";
import { sameVideoPage } from "../shared/same-video-page";
import { isVoklerSupportedVideoPage } from "../shared/supported-video-pages";

const STORAGE_KEY = "voklerMediaUrls";
const SETTINGS_KEY = "voklerPopupSettings";
const MAX_URLS = 50;

export type MediaHit = {
  url: string;
  tabId: number;
  mimeType: string | undefined;
  timeStamp: number;
  initiator: string | undefined;
  /** Tab URL when the request completed (used to match SPA navigations). */
  pageUrl?: string;
};

function isVideoPageUrl(url: string): boolean {
  return isVoklerSupportedVideoPage(url);
}

function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 120) || "vokler-download";
}

function extFromUrl(url: string, mimeType?: string): string {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".webm")) return ".webm";
  if (path.endsWith(".mp4")) return ".mp4";
  if (path.endsWith(".m3u8")) return ".m3u8";
  if (path.endsWith(".mpd")) return ".mpd";
  const m = mimeType?.toLowerCase() ?? "";
  if (m.includes("webm")) return ".webm";
  if (m.includes("mpegurl") || path.includes(".m3u8")) return ".m3u8";
  if (m.includes("dash") || path.includes(".mpd")) return ".mpd";
  if (m.includes("mp4")) return ".mp4";
  return ".mp4";
}

async function shouldShowVideoBadge(): Promise<boolean> {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  const raw = data[SETTINGS_KEY] as { badgeCount?: boolean } | undefined;
  return raw?.badgeCount !== false;
}

async function isStreamAutoDetectOn(): Promise<boolean> {
  const data = await chrome.storage.local.get(SETTINGS_KEY);
  const raw = data[SETTINGS_KEY] as { autoDetect?: boolean } | undefined;
  return raw?.autoDetect !== false;
}

async function pushMediaHit(hit: MediaHit): Promise<void> {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const prev = (data[STORAGE_KEY] as MediaHit[] | undefined) ?? [];
  const next = [
    hit,
    ...prev.filter((x) => x.url !== hit.url || x.timeStamp !== hit.timeStamp),
  ].slice(0, MAX_URLS);
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
}

async function resolvePageUrlForTab(tabId: number): Promise<string | undefined> {
  try {
    const tab = await chrome.tabs.get(tabId);
    return tab.url;
  } catch {
    return undefined;
  }
}

function looksLikeStream(url: string, mimeType?: string): boolean {
  if (mimeType) {
    if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) {
      return true;
    }
    if (mimeType.includes("mpegurl") || mimeType.includes("dash")) {
      return true;
    }
  }
  const lower = url.split("?")[0].toLowerCase();
  return /\.(m3u8|mpd|mp4|webm|mkv|opus|m4a|aac)(\b|$)/.test(lower);
}

chrome.webRequest.onCompleted.addListener(
  async (details) => {
    if (details.tabId < 0 || !details.url) return;
    if (!(await isStreamAutoDetectOn())) return;
    const mime =
      details.responseHeaders?.find((h) => h.name.toLowerCase() === "content-type")
        ?.value ?? undefined;
    const streamish =
      details.type === "media" ||
      looksLikeStream(details.url, mime) ||
      (mime != null && (mime.includes("mpegurl") || mime.includes("dash")));
    if (!streamish) return;

    const pageUrl = await resolvePageUrlForTab(details.tabId);
    if (pageUrl && !isVoklerSupportedVideoPage(pageUrl)) {
      return;
    }

    await pushMediaHit({
      url: details.url,
      tabId: details.tabId,
      mimeType: mime,
      timeStamp: details.timeStamp,
      initiator: details.initiator,
      pageUrl,
    });
  },
  {
    urls: ["http://*/*", "https://*/*"],
    types: ["media", "xmlhttprequest", "other"],
  },
  ["responseHeaders"],
);

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== "complete" || !tab.url) return;
  void (async () => {
    if (!(await shouldShowVideoBadge())) {
      await chrome.action.setBadgeText({ text: "", tabId });
      return;
    }
    const isVideo = isVideoPageUrl(tab.url!);
    await chrome.action.setBadgeText({ text: isVideo ? "1" : "", tabId });
    if (isVideo) {
      await chrome.action.setBadgeBackgroundColor({ color: "#e8521a", tabId });
    }
  })();
});

chrome.runtime.onInstalled.addListener(() => {
  scheduleDownloadQueue();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleDownloadQueue();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "DOWNLOAD_STREAM") {
    const url = message.url as string | undefined;
    const pageTitle = message.pageTitle as string | undefined;
    const pageUrl = message.pageUrl as string | undefined;
    if (!url) {
      sendResponse({ ok: false, error: "Missing URL" });
      return false;
    }
    void (async () => {
      try {
        const base = sanitizeFilename(pageTitle ?? "video");
        const filename = `${base}${extFromUrl(url, message.mimeType as string | undefined)}`;
        await chrome.downloads.download({ url, filename, saveAs: false });
        const data = await chrome.storage.local.get(SETTINGS_KEY);
        const settings = data[SETTINGS_KEY] as { notifyOnComplete?: boolean } | undefined;
        if (settings?.notifyOnComplete) {
          chrome.notifications.create({
            type: "basic",
            iconUrl: chrome.runtime.getURL("icons/icon-48.png"),
            title: "Vokler — Download started",
            message: filename,
          });
        }
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
    return true;
  }
  if (message?.type === "OPEN_POPUP_HINT") {
    void chrome.action.openPopup().then(
      () => sendResponse({ ok: true }),
      () => sendResponse({ ok: false }),
    );
    return true;
  }
  if (message?.type === "GET_MEDIA_HITS") {
    chrome.storage.local
      .get(STORAGE_KEY)
      .then((data) => {
        sendResponse({ hits: (data[STORAGE_KEY] as MediaHit[]) ?? [] });
      })
      .catch(() => sendResponse({ hits: [] }));
    return true;
  }
  if (message?.type === "CLEAR_MEDIA_HITS") {
    chrome.storage.local.remove(STORAGE_KEY).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "GET_TAB_MEDIA_HITS") {
    const tabId = sender.tab?.id;
    if (tabId == null) {
      sendResponse({ hits: [] as MediaHit[] });
      return false;
    }
    chrome.storage.local
      .get(STORAGE_KEY)
      .then((data) => {
        const all = (data[STORAGE_KEY] as MediaHit[] | undefined) ?? [];
        const tabUrl = sender.tab?.url ?? "";
        const forTab = all.filter((h) => h.tabId === tabId);
        if (!tabUrl) {
          sendResponse({ hits: forTab });
          return;
        }
        sendResponse({
          hits: forTab.filter((h) => sameVideoPage(tabUrl, h.pageUrl)),
        });
      })
      .catch(() => sendResponse({ hits: [] as MediaHit[] }));
    return true;
  }
  if (message?.type === "QUEUE_KICK") {
    scheduleDownloadQueue();
    return false;
  }
  return false;
});
