const STORAGE_KEY = "voklerMediaUrls";
const MAX_URLS = 50;

export type MediaHit = {
  url: string;
  tabId: number;
  mimeType: string | undefined;
  timeStamp: number;
  initiator: string | undefined;
};

async function pushMediaHit(hit: MediaHit): Promise<void> {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const prev = (data[STORAGE_KEY] as MediaHit[] | undefined) ?? [];
  const next = [
    hit,
    ...prev.filter((x) => x.url !== hit.url || x.timeStamp !== hit.timeStamp),
  ].slice(0, MAX_URLS);
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
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
    const mime =
      details.responseHeaders?.find((h) => h.name.toLowerCase() === "content-type")
        ?.value ?? undefined;
    const streamish =
      details.type === "media" ||
      looksLikeStream(details.url, mime) ||
      (mime != null && (mime.includes("mpegurl") || mime.includes("dash")));
    if (!streamish) return;

    await pushMediaHit({
      url: details.url,
      tabId: details.tabId,
      mimeType: mime,
      timeStamp: details.timeStamp,
      initiator: details.initiator,
    });
  },
  {
    urls: ["http://*/*", "https://*/*"],
    types: ["media", "xmlhttprequest", "other"],
  },
  ["responseHeaders"],
);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
  return false;
});
