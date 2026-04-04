const BAR_ID = "vokler-player-inject";
const STYLE_ID = "vokler-player-inject-styles";
const DISMISS_PREFIX = "vokler-inject-dismiss:";

type MediaHit = {
  url: string;
  tabId: number;
  mimeType: string | undefined;
  timeStamp: number;
  initiator: string | undefined;
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
    titleSelector: "h1.ytd-watch-metadata yt-formatted-string",
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

function getVideoTitle(): string {
  const key = getPlatformKey();
  const sel = key ? PLATFORMS[key]?.titleSelector : null;
  if (sel) {
    const el = document.querySelector(sel);
    const t = el?.textContent?.trim();
    if (t) return t;
  }
  return document.title.replace(/\s*-\s*YouTube\s*$/i, "").trim() || document.title;
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

  const v = document.querySelector("video");
  if (v) {
    const parent = v.parentElement;
    if (parent && parent !== document.body) {
      const el = parent as HTMLElement;
      const pos = window.getComputedStyle(el).position;
      if (pos === "static") {
        el.style.position = "relative";
      }
      return { el, mode: "in-player" };
    }
  }

  return { el: document.body, mode: "fixed" };
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

let urlObserver: MutationObserver | null = null;
let storageListener:
  | ((changes: Record<string, chrome.storage.StorageChange>, area: string) => void)
  | null = null;

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
            <div class="vokler-q-header-t">Captured streams</div>
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
        Copy stream
      </button>
      <button type="button" class="vokler-inj-close" id="vokler-inj-close" title="Dismiss" aria-label="Dismiss">
        <svg viewBox="0 0 14 14"><path d="M2 2l10 10M12 2L2 12"/></svg>
      </button>
    </div>
  `;

  const toast = document.createElement("div");
  toast.className = "vokler-inj-toast";
  toast.id = "vokler-inj-toast";
  toast.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg> Copied to clipboard`;

  mount.el.appendChild(bar);
  document.body.appendChild(toast);

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
      toast.classList.add("vokler-show");
      window.setTimeout(() => {
        toast.classList.remove("vokler-show");
        saveBtn.classList.remove("vokler-done");
        saveBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 19h16"/></svg> Copy stream`;
        saveBtn.disabled = false;
      }, 2200);
    } else {
      saveBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 19h16"/></svg> Copy stream`;
      saveBtn.disabled = false;
    }
  }

  saveBtn.addEventListener("click", () => void runCopyFlow());
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
    void runCopyFlow();
  });

  closeBtn.addEventListener("click", () => {
    sessionStorage.setItem(`${DISMISS_PREFIX}${location.href}`, "1");
    bar.remove();
    toast.remove();
    removeStorageListener();
  });
}

async function tryMount(): Promise<void> {
  if (sessionStorage.getItem(`${DISMISS_PREFIX}${location.href}`)) {
    return;
  }

  const mount = findMountEl();
  if (!mount) return;

  if (document.getElementById(BAR_ID)) {
    return;
  }

  removeStorageListener();

  const hits = await fetchTabHits();
  renderBar(hits, mount);

  const refresh = async () => {
    const b = document.getElementById(BAR_ID);
    if (!b || !document.body.contains(b)) return;
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
  let lastUrl = location.href;
  urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      removeStorageListener();
      document.getElementById(BAR_ID)?.remove();
      document.getElementById("vokler-inj-toast")?.remove();
      window.setTimeout(() => void tryMount(), 800);
    }
  });
  urlObserver.observe(document.body, { subtree: true, childList: true });
}

function boot(): void {
  const hasVideo = (): boolean =>
    !!document.querySelector("video") ||
    !!getPlatformKey() ||
    /youtube\.com\/watch|instagram\.com\/(reel|p)\//.test(location.href);

  const schedule = () => {
    window.setTimeout(() => {
      if (hasVideo()) {
        void tryMount();
      }
    }, 600);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule);
  } else {
    schedule();
  }

  initNavigationWatch();
}

boot();
