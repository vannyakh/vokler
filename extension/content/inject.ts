import { isVoklerSupportedVideoPage } from "../shared/supported-video-pages";

const BAR_ID = "vokler-player-inject";
const STYLE_ID = "vokler-player-inject-styles";
const DISMISS_PREFIX = "vokler-inject-dismiss:";

type MediaHit = {
  url: string;
  tabId: number;
  mimeType: string | undefined;
  timeStamp: number;
  initiator: string | undefined;
  pageUrl?: string;
};

type PlatformConfig = {
  name: string;
  mountSelector: string;
  titleSelector: string | null;
};

const PLATFORMS: Record<string, PlatformConfig> = {
  "youtube.com": {
    name: "YouTube",
    mountSelector: "#movie_player",
    titleSelector:
      'meta[property="og:title"], h1.ytd-watch-metadata yt-formatted-string, ytd-watch-metadata h1 yt-formatted-string',
  },
  "youtu.be": {
    name: "YouTube",
    mountSelector: "video, ytd-player, #movie_player",
    titleSelector: 'meta[property="og:title"], meta[name="title"]',
  },
  "instagram.com": {
    name: "Instagram",
    mountSelector: "article video",
    titleSelector: "h1._aacl, span._ap3a",
  },
  "tiktok.com": {
    name: "TikTok",
    mountSelector: '[data-e2e="browse-video-container"], [data-e2e="video-player"]',
    titleSelector: '[data-e2e="browse-video-desc"], [data-e2e="video-desc"]',
  },
  "twitter.com": {
    name: "X",
    mountSelector: '[data-testid="videoPlayer"]',
    titleSelector: '[data-testid="tweetText"]',
  },
  "x.com": {
    name: "X",
    mountSelector: '[data-testid="videoPlayer"]',
    titleSelector: '[data-testid="tweetText"]',
  },
  "facebook.com": {
    name: "Facebook",
    mountSelector: '[data-pagelet="VideoPlayer"] video, [role="presentation"] video',
    titleSelector: '[data-ad-preview="message"]',
  },
  "vimeo.com": {
    name: "Vimeo",
    mountSelector: ".vp-video-wrapper, .vp-player",
    titleSelector: "h1",
  },
};

const ACCENT = "#e8521a";
const ACCENT_HOVER = "#ff6b35";

function getPlatformKey(): string | null {
  const host = location.hostname.replace(/^www\./, "");
  for (const k of Object.keys(PLATFORMS)) {
    if (host === k || host.endsWith(`.${k}`)) {
      return k;
    }
  }
  return null;
}

function getYouTubeTitleFromDom(): string | null {
  const og =
    document.querySelector('meta[property="og:title"]')?.getAttribute("content")?.trim() ||
    document.querySelector('meta[name="title"]')?.getAttribute("content")?.trim();
  if (og) return og;
  const h1 = document.querySelector(
    "h1.ytd-watch-metadata yt-formatted-string, ytd-watch-metadata h1 yt-formatted-string, #title h1",
  );
  const h1t = h1?.textContent?.trim();
  if (h1t) return h1t;
  return null;
}

function getVideoTitle(): string {
  const host = location.hostname.replace(/^www\./, "");
  if (host.includes("youtube.com") || host === "youtu.be") {
    const yt = getYouTubeTitleFromDom();
    if (yt) return yt;
  }
  const key = getPlatformKey();
  const sel = key ? PLATFORMS[key]?.titleSelector : null;
  if (sel) {
    const parts = sel.split(",").map((s) => s.trim());
    for (const p of parts) {
      const el = document.querySelector(p);
      const metaContent =
        p.startsWith("meta") && el
          ? (el as HTMLMetaElement).content?.trim()
          : el?.textContent?.trim();
      const t = metaContent || el?.textContent?.trim();
      if (t) return t;
    }
  }
  return document.title.replace(/\s*-\s*YouTube\s*$/i, "").trim() || document.title;
}

function pageIdentityKey(): string {
  try {
    const u = new URL(location.href);
    const hostNorm = u.hostname.replace(/^www\./, "");
    if (hostNorm === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return `yt:v:${id}`;
      return `yt:${u.pathname}${u.search}`;
    }
    if (hostNorm.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `yt:v:${v}`;
      if (u.pathname.startsWith("/shorts/")) {
        const seg = u.pathname.split("/").filter(Boolean);
        return `yt:shorts:${seg[1] ?? u.pathname}`;
      }
      return `yt:${u.pathname}${u.search}`;
    }
    return u.href;
  } catch {
    return location.href;
  }
}

function streamLabel(hit: MediaHit): { main: string; sub: string } {
  const u = hit.url.toLowerCase();
  const m = hit.mimeType ?? "";
  if (m.includes("mpegurl") || u.includes(".m3u8")) {
    return { main: "HLS", sub: "Playlist" };
  }
  if (m.includes("dash") || u.includes(".mpd")) {
    return { main: "DASH", sub: "Manifest" };
  }
  if (m.startsWith("audio/")) {
    return { main: "Audio", sub: m.split("/")[1]?.split(";")[0]?.slice(0, 8) ?? "stream" };
  }
  if (u.includes(".webm") || m.includes("webm")) {
    return { main: "WEBM", sub: "Direct" };
  }
  if (u.includes(".mp4") || m.includes("mp4")) {
    return { main: "MP4", sub: "Direct" };
  }
  return { main: "Stream", sub: shorten(hit.url, 28) };
}

function shorten(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function findMountEl(): { el: HTMLElement; mode: "in-player" | "fixed" } | null {
  const key = getPlatformKey();
  if (key) {
    const cfg = PLATFORMS[key];
    const found = document.querySelector(cfg.mountSelector);
    if (found) {
      let node: Element = found;
      if (node.tagName === "VIDEO") {
        const wrap = node.parentElement;
        if (wrap && wrap !== document.body) {
          node = wrap;
        }
      }
      const el = node as HTMLElement;
      const pos = window.getComputedStyle(el).position;
      if (pos === "static") {
        el.style.position = "relative";
      }
      return { el, mode: "in-player" };
    }
  }

  return null;
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
#${BAR_ID} {
  all: initial;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  padding: 0 16px;
  height: 52px;
  background: rgba(15, 15, 15, 0.92);
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 60;
  gap: 0;
}
#${BAR_ID} *, #${BAR_ID} *::before, #${BAR_ID} *::after { box-sizing: border-box; }
#${BAR_ID}.vokler-inject--fixed {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 2147483646;
}
#${BAR_ID}.vokler-inject--in-player {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
}
.vokler-inj-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.vokler-inj-logo-dot {
  width: 22px;
  height: 22px;
  background: ${ACCENT};
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.vokler-inj-logo-dot svg {
  width: 11px;
  height: 11px;
  stroke: #fff;
  fill: none;
  stroke-width: 2.5;
  stroke-linecap: round;
}
.vokler-inj-detected { flex: 1; min-width: 0; }
.vokler-inj-title {
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: min(200px, 42vw);
}
.vokler-inj-sub {
  font-size: 10px;
  color: #aaa;
  font-family: ui-monospace, "Cascadia Code", monospace;
  margin-top: 1px;
}
.vokler-inj-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.vokler-q-pill {
  position: relative;
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 7px;
  height: 32px;
  cursor: pointer;
  user-select: none;
  overflow: visible;
}
.vokler-q-selected {
  padding: 0 10px;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  font-family: ui-monospace, monospace;
  display: flex;
  align-items: center;
  gap: 5px;
  height: 100%;
}
.vokler-q-arrow {
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0 7px;
  height: 100%;
  display: flex;
  align-items: center;
}
.vokler-q-arrow svg { width: 10px; height: 10px; }
.vokler-q-dropdown {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  background: #1e1e1e;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  width: 220px;
  max-height: 280px;
  overflow-y: auto;
  z-index: 100;
  display: none;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
}
.vokler-q-dropdown.vokler-open { display: block; animation: voklerDropUp 0.15s ease; }
@keyframes voklerDropUp {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}
.vokler-q-header {
  padding: 10px 13px 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}
.vokler-q-header-t { font-size: 11px; font-weight: 700; color: #fff; }
.vokler-q-header-s { font-size: 10px; color: #777; font-family: monospace; margin-top: 2px; }
.vokler-q-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 13px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  transition: background 0.1s;
}
.vokler-q-item:last-child { border-bottom: none; }
.vokler-q-item:hover { background: rgba(255, 255, 255, 0.05); }
.vokler-q-item.vokler-sel { background: rgba(232, 82, 26, 0.1); }
.vokler-q-item.vokler-sel .vokler-q-res { color: ${ACCENT}; }
.vokler-q-res {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  font-family: ui-monospace, monospace;
  width: 52px;
}
.vokler-q-meta { font-size: 10px; color: #666; font-family: monospace; max-width: 90px; overflow: hidden; text-overflow: ellipsis; }
.vokler-q-footer {
  padding: 9px 13px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  display: flex;
  gap: 6px;
}
.vokler-q-foot-btn {
  flex: 1;
  height: 28px;
  border: none;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
}
.vokler-q-audio {
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #ccc;
}
.vokler-q-audio:hover { background: rgba(255, 255, 255, 0.12); color: #fff; }
.vokler-q-dl {
  background: ${ACCENT};
  color: #fff;
}
.vokler-q-dl:hover { background: ${ACCENT_HOVER}; }
.vokler-dl-main {
  height: 32px;
  background: ${ACCENT};
  border: none;
  border-radius: 7px;
  padding: 0 14px;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  font-family: inherit;
  transition: background 0.15s;
}
.vokler-dl-main:hover:not(:disabled) { background: ${ACCENT_HOVER}; }
.vokler-dl-main:disabled { opacity: 0.6; cursor: not-allowed; }
.vokler-dl-main svg { width: 13px; height: 13px; stroke: #fff; fill: none; stroke-width: 2.5; stroke-linecap: round; }
.vokler-dl-main.vokler-done { background: #1e7a45; }
.vokler-dl-main.vokler-busy { background: #c44010; }
.vokler-inj-close {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  opacity: 0.5;
}
.vokler-inj-close:hover { opacity: 1; }
.vokler-inj-close svg { width: 13px; height: 13px; stroke: #fff; fill: none; stroke-width: 2; stroke-linecap: round; }
.vokler-inj-toast {
  position: fixed;
  bottom: 62px;
  left: 50%;
  transform: translateX(-50%);
  background: #1e7a45;
  border: 1px solid rgba(46, 204, 113, 0.3);
  border-radius: 8px;
  padding: 8px 16px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 7px;
  z-index: 2147483647;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  font-family: system-ui, sans-serif;
}
.vokler-inj-toast.vokler-show { opacity: 1; }
.vokler-inj-toast svg { width: 14px; height: 14px; stroke: #fff; fill: none; stroke-width: 2.5; stroke-linecap: round; }
`;
  document.head.appendChild(style);
}

async function fetchTabHits(): Promise<MediaHit[]> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_TAB_MEDIA_HITS" }, (res) => {
      if (chrome.runtime.lastError) {
        resolve([]);
        return;
      }
      resolve((res?.hits as MediaHit[]) ?? []);
    });
  });
}

function uniqueHits(hits: MediaHit[]): MediaHit[] {
  const seen = new Set<string>();
  const out: MediaHit[] = [];
  for (const h of hits) {
    if (seen.has(h.url)) continue;
    seen.add(h.url);
    out.push(h);
    if (out.length >= 8) break;
  }
  return out;
}

function pickAudioHit(hits: MediaHit[]): MediaHit | null {
  const audio = hits.find((h) => h.mimeType?.startsWith("audio/"));
  return audio ?? hits[0] ?? null;
}

let navUnsub: (() => void) | null = null;
let storageListener:
  | ((changes: Record<string, chrome.storage.StorageChange>, area: string) => void)
  | null = null;
let mountAttempt = 0;
const MAX_MOUNT_ATTEMPTS = 12;

function removeStorageListener(): void {
  if (storageListener) {
    chrome.storage.onChanged.removeListener(storageListener);
    storageListener = null;
  }
}

function teardownBar(): void {
  document.getElementById(BAR_ID)?.remove();
  document.getElementById("vokler-inj-toast")?.remove();
}

function renderBar(hits: MediaHit[], mount: { el: HTMLElement; mode: "in-player" | "fixed" }): void {
  teardownBar();
  injectStyles();

  const list = uniqueHits(hits);
  const platformName = getPlatformKey() ? PLATFORMS[getPlatformKey()!]?.name ?? "Page" : "Page";
  const title = getVideoTitle();
  const primary = list[0] ?? null;
  const subNoHits = `${platformName} · waiting for stream…`;
  const subWithHits = primary
    ? `${platformName} · ${streamLabel(primary).main} · ${streamLabel(primary).sub}`
    : subNoHits;

  const bar = document.createElement("div");
  bar.id = BAR_ID;
  bar.setAttribute("data-vokler", "inject");
  bar.className =
    mount.mode === "fixed" ? "vokler-inject--fixed" : "vokler-inject--in-player";

  const dropdownItems =
    list.length === 0
      ? `<div class="vokler-q-item"><span class="vokler-q-res">—</span><span class="vokler-q-meta">Play the video</span></div>`
      : list
          .map((h, i) => {
            const { main, sub } = streamLabel(h);
            return `<div class="vokler-q-item${i === 0 ? " vokler-sel" : ""}" data-url="${escapeHtml(h.url)}">
            <span class="vokler-q-res">${escapeHtml(main)}</span>
            <span class="vokler-q-meta">${escapeHtml(sub)}</span>
          </div>`;
          })
          .join("");

  const qLabel = primary ? streamLabel(primary).main : "—";

  bar.innerHTML = `
    <div class="vokler-inj-left">
      <div class="vokler-inj-logo-dot" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 19h16"/></svg>
      </div>
      <div class="vokler-inj-detected">
        <div class="vokler-inj-title" id="vokler-inj-title">${escapeHtml(title)}</div>
        <div class="vokler-inj-sub" id="vokler-inj-sub">${escapeHtml(list.length ? subWithHits : subNoHits)}</div>
      </div>
    </div>
    <div class="vokler-inj-right">
      <div class="vokler-q-pill" id="vokler-q-pill" role="button" tabindex="0" aria-haspopup="listbox" aria-expanded="false">
        <div class="vokler-q-selected">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="${ACCENT}" stroke-width="3" stroke-linecap="round"><path d="M12 4v12M7 11l5 5 5-5"/></svg>
          <span id="vokler-q-label">${escapeHtml(qLabel)}</span>
        </div>
        <div class="vokler-q-arrow" aria-hidden="true">
          <svg viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="#aaa" stroke-width="1.5" stroke-linecap="round"/></svg>
        </div>
        <div class="vokler-q-dropdown" id="vokler-q-dropdown">
          <div class="vokler-q-header">
            <div class="vokler-q-header-t">Streams</div>
            <div class="vokler-q-header-s">Vokler · ${escapeHtml(shorten(title, 24))}</div>
          </div>
          ${dropdownItems}
          <div class="vokler-q-footer">
            <button type="button" class="vokler-q-foot-btn vokler-q-audio" id="vokler-audio-only">Audio first</button>
            <button type="button" class="vokler-q-foot-btn vokler-q-dl" id="vokler-dl-dropdown">Copy URL</button>
          </div>
        </div>
      </div>
      <button type="button" class="vokler-dl-main" id="vokler-save-btn" ${list.length ? "" : "disabled"}>
        <svg viewBox="0 0 24 24"><path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 19h16"/></svg>
        Save video
      </button>
      <button type="button" class="vokler-inj-close" id="vokler-inj-close" title="Dismiss" aria-label="Dismiss">
        <svg viewBox="0 0 14 14"><path d="M2 2l10 10M12 2L2 12"/></svg>
      </button>
    </div>
  `;

  const toast = document.createElement("div");
  toast.className = "vokler-inj-toast";
  toast.id = "vokler-inj-toast";
  toast.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg><span id="vokler-toast-msg">Saved</span>`;

  mount.el.appendChild(bar);
  document.body.appendChild(toast);

  let titleTicks = 0;
  const titleInterval = window.setInterval(() => {
    const still = document.getElementById(BAR_ID);
    if (!still || still !== bar) {
      window.clearInterval(titleInterval);
      return;
    }
    const tEl = bar.querySelector("#vokler-inj-title") as HTMLElement | null;
    if (tEl) tEl.textContent = getVideoTitle();
    titleTicks += 1;
    if (titleTicks >= 24) window.clearInterval(titleInterval);
  }, 350);

  const pill = bar.querySelector("#vokler-q-pill") as HTMLElement;
  const dropdown = bar.querySelector("#vokler-q-dropdown") as HTMLElement;
  const qLabelEl = bar.querySelector("#vokler-q-label") as HTMLElement;
  const subEl = bar.querySelector("#vokler-inj-sub") as HTMLElement;
  const saveBtn = bar.querySelector("#vokler-save-btn") as HTMLButtonElement;
  const closeBtn = bar.querySelector("#vokler-inj-close") as HTMLButtonElement;
  const qItems = bar.querySelectorAll(".vokler-q-item[data-url]");
  const audioBtn = bar.querySelector("#vokler-audio-only") as HTMLButtonElement;
  const dlDropdown = bar.querySelector("#vokler-dl-dropdown") as HTMLButtonElement;

  let selectedUrl = primary?.url ?? "";

  const closeDropdown = () => {
    dropdown.classList.remove("vokler-open");
    pill.setAttribute("aria-expanded", "false");
  };

  const openDropdown = () => {
    dropdown.classList.add("vokler-open");
    pill.setAttribute("aria-expanded", "true");
  };

  pill.addEventListener("click", (e) => {
    e.stopPropagation();
    if (dropdown.classList.contains("vokler-open")) {
      closeDropdown();
    } else {
      openDropdown();
    }
  });

  document.addEventListener("click", closeDropdown);
  dropdown.addEventListener("click", (e) => e.stopPropagation());

  qItems.forEach((item) => {
    item.addEventListener("click", () => {
      qItems.forEach((i) => i.classList.remove("vokler-sel"));
      item.classList.add("vokler-sel");
      selectedUrl = (item as HTMLElement).dataset.url ?? "";
      const hit = list.find((h) => h.url === selectedUrl);
      if (hit) {
        const { main } = streamLabel(hit);
        qLabelEl.textContent = main;
        subEl.textContent = `${platformName} · ${streamLabel(hit).main} · ${streamLabel(hit).sub}`;
      }
    });
  });

  function showToast(msg: string, success = true): void {
    const msgEl = toast.querySelector("#vokler-toast-msg");
    if (msgEl) msgEl.textContent = msg;
    toast.style.background = success ? "#1e7a45" : "#8c2f2f";
    toast.style.borderColor = success ? "rgba(46, 204, 113, 0.3)" : "rgba(255, 100, 100, 0.35)";
    toast.classList.add("vokler-show");
    window.setTimeout(() => toast.classList.remove("vokler-show"), 2200);
  }

  function resetMainButton(): void {
    saveBtn.classList.remove("vokler-busy", "vokler-done");
    saveBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 19h16"/></svg> Save video`;
    saveBtn.disabled = !list.length;
  }

  async function copySelected(): Promise<boolean> {
    if (!selectedUrl && list[0]) {
      selectedUrl = list[0].url;
    }
    if (!selectedUrl) return false;
    try {
      await navigator.clipboard.writeText(selectedUrl);
      return true;
    } catch {
      return false;
    }
  }

  function currentHit(): MediaHit | null {
    if (!selectedUrl && list[0]) selectedUrl = list[0].url;
    return list.find((h) => h.url === selectedUrl) ?? list[0] ?? null;
  }

  async function runDownloadFlow(): Promise<void> {
    if (!list.length) return;
    const hit = currentHit();
    if (!hit) return;
    saveBtn.classList.add("vokler-busy");
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l2 2"/></svg> Downloading…`;
    const res = await new Promise<{ ok?: boolean; error?: string }>((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "DOWNLOAD_STREAM",
          url: hit.url,
          mimeType: hit.mimeType,
          pageTitle: getVideoTitle(),
          pageUrl: location.href,
        },
        (r) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve((r as { ok?: boolean; error?: string }) ?? { ok: false });
        },
      );
    });
    saveBtn.classList.remove("vokler-busy");
    if (res.ok) {
      saveBtn.classList.add("vokler-done");
      saveBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg> Started`;
      showToast("Download started", true);
      window.setTimeout(() => resetMainButton(), 2200);
      return;
    }
    const copied = await copySelected();
    if (copied) {
      saveBtn.classList.add("vokler-done");
      saveBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg> Copied URL`;
      showToast("Couldn’t save file — stream link copied", false);
      window.setTimeout(() => resetMainButton(), 2600);
    } else {
      showToast(res.error ?? "Download failed", false);
      resetMainButton();
    }
  }

  async function runCopyFlow(): Promise<void> {
    if (!list.length) return;
    saveBtn.classList.add("vokler-busy");
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l2 2"/></svg> Copying…`;
    const ok = await copySelected();
    saveBtn.classList.remove("vokler-busy");
    if (ok) {
      saveBtn.classList.add("vokler-done");
      saveBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg> Copied!`;
      showToast("Copied to clipboard", true);
      window.setTimeout(() => resetMainButton(), 2200);
    } else {
      resetMainButton();
    }
  }

  saveBtn.addEventListener("click", () => void runDownloadFlow());
  dlDropdown.addEventListener("click", () => {
    closeDropdown();
    void runCopyFlow();
  });

  audioBtn.addEventListener("click", () => {
    closeDropdown();
    const ah = pickAudioHit(list);
    if (ah) {
      selectedUrl = ah.url;
      qLabelEl.textContent = streamLabel(ah).main;
    }
    void runDownloadFlow();
  });

  closeBtn.addEventListener("click", () => {
    sessionStorage.setItem(`${DISMISS_PREFIX}${location.href}`, "1");
    bar.remove();
    toast.remove();
    removeStorageListener();
  });
}

async function tryMount(): Promise<void> {
  if (!isVoklerSupportedVideoPage(location.href)) {
    mountAttempt = 0;
    teardownBar();
    removeStorageListener();
    return;
  }
  if (sessionStorage.getItem(`${DISMISS_PREFIX}${location.href}`)) {
    return;
  }

  const mount = findMountEl();
  if (!mount) {
    if (mountAttempt < MAX_MOUNT_ATTEMPTS) {
      mountAttempt += 1;
      window.setTimeout(() => void tryMount(), 450);
    }
    return;
  }
  mountAttempt = 0;

  if (document.getElementById(BAR_ID)) {
    return;
  }

  removeStorageListener();

  const hits = await fetchTabHits();
  renderBar(hits, mount);

  const refresh = async () => {
    const b = document.getElementById(BAR_ID);
    if (!b || !document.body.contains(b)) return;
    if (!isVoklerSupportedVideoPage(location.href)) {
      teardownBar();
      removeStorageListener();
      return;
    }
    const next = await fetchTabHits();
    const m = findMountEl();
    if (m) {
      renderBar(next, m);
    }
  };

  storageListener = (changes, area) => {
    if (area !== "local") return;
    if (changes.voklerMediaUrls) {
      void refresh();
    }
  };
  chrome.storage.onChanged.addListener(storageListener);
}

function initNavigationWatch(): void {
  navUnsub?.();
  let lastKey = pageIdentityKey();

  const onSpaNav = () => {
    const next = pageIdentityKey();
    if (next === lastKey) return;
    lastKey = next;
    mountAttempt = 0;
    removeStorageListener();
    document.getElementById(BAR_ID)?.remove();
    document.getElementById("vokler-inj-toast")?.remove();
    const run = () => void tryMount();
    run();
    window.setTimeout(run, 400);
    window.setTimeout(run, 1200);
  };

  const onPop = () => onSpaNav();
  window.addEventListener("popstate", onPop);
  document.addEventListener("yt-navigate-finish", onPop as EventListener);
  document.addEventListener("yt-page-data-updated", onPop as EventListener);

  const poll = window.setInterval(() => {
    const next = pageIdentityKey();
    if (next !== lastKey) onSpaNav();
  }, 400);

  navUnsub = () => {
    window.removeEventListener("popstate", onPop);
    document.removeEventListener("yt-navigate-finish", onPop as EventListener);
    document.removeEventListener("yt-page-data-updated", onPop as EventListener);
    window.clearInterval(poll);
  };
}

function boot(): void {
  const schedule = () => {
    if (!isVoklerSupportedVideoPage(location.href)) {
      return;
    }
    void tryMount();
    window.setTimeout(() => void tryMount(), 900);
    window.setTimeout(() => void tryMount(), 1800);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule);
  } else {
    schedule();
  }

  initNavigationWatch();
}

boot();
