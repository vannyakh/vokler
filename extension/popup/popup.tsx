import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { sameVideoPage } from "../shared/same-video-page";
import { isVoklerSupportedVideoPage } from "../shared/supported-video-pages";

import "./popup.css";

type MediaHit = {
  url: string;
  tabId: number;
  mimeType: string | undefined;
  timeStamp: number;
  initiator: string | undefined;
  pageUrl?: string;
};

type TabId = "download" | "history" | "settings";

type ThemeMode = "light" | "dark";

const SETTINGS_KEY = "voklerPopupSettings";
const DEFAULT_APP_URL = "http://127.0.0.1:3000";

type PopupSettings = {
  theme: ThemeMode;
  appUrl: string;
  includeSubtitles: boolean;
  embedThumb: boolean;
  saveMetadata: boolean;
  autoDetect: boolean;
  badgeCount: boolean;
  notifyOnComplete: boolean;
  rateLimit: boolean;
  useProxy: boolean;
};

const defaultSettings = (): PopupSettings => ({
  theme: "light",
  appUrl: DEFAULT_APP_URL,
  includeSubtitles: false,
  embedThumb: true,
  saveMetadata: true,
  autoDetect: true,
  badgeCount: true,
  notifyOnComplete: false,
  rateLimit: false,
  useProxy: false,
});

function streamKind(mime: string | undefined, url: string): { label: string; detail: string } {
  const u = url.toLowerCase();
  if (mime?.includes("mpegurl") || u.includes(".m3u8")) {
    return { label: "HLS", detail: "Playlist" };
  }
  if (mime?.includes("dash") || u.includes(".mpd")) {
    return { label: "DASH", detail: "Manifest" };
  }
  if (mime?.startsWith("audio/")) {
    return { label: "♪", detail: mime.split("/")[1]?.slice(0, 8) ?? "Audio" };
  }
  if (u.includes(".mp4") || mime?.includes("mp4")) {
    return { label: "MP4", detail: "Direct" };
  }
  if (u.includes(".webm") || mime?.includes("webm")) {
    return { label: "WEBM", detail: "Direct" };
  }
  const short = mime ? mime.split(";")[0].slice(0, 14) : "Stream";
  return { label: "SRC", detail: short };
}

function formatChipForHit(mime: string | undefined, url: string): string {
  const u = url.toLowerCase();
  if (mime?.includes("mpegurl") || u.includes(".m3u8")) return "HLS";
  if (mime?.includes("dash") || u.includes(".mpd")) return "DASH";
  if (mime?.includes("webm")) return "WEBM";
  if (mime?.includes("audio") || /\.(m4a|aac|opus)(\?|$)/i.test(u)) return "AAC";
  if (u.includes(".mp4") || mime?.includes("mp4")) return "MP4";
  return "MP4";
}

const FMT_OPTIONS = ["MP4", "WEBM", "MOV", "MP3", "AAC", "FLAC", "HLS", "DASH"] as const;

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "stream";
  }
}

function hostAccent(host: string): string {
  let h = 0;
  for (let i = 0; i < host.length; i++) h = (h * 31 + host.charCodeAt(i)) >>> 0;
  const colors = ["#e8521a", "#1a7a4a", "#1a4e8c", "#a06800", "#6b4e9e"];
  return colors[h % colors.length];
}

function relativeTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`;
  return `${Math.floor(s / 86400)} days ago`;
}

function shorten(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function App() {
  const version = chrome.runtime.getManifest().version;
  const [hits, setHits] = useState<MediaHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tabId, setTabId] = useState<number | null>(null);
  const [tabTitle, setTabTitle] = useState<string>("");
  const [tabUrl, setTabUrl] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabId>("download");
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [fmtSelected, setFmtSelected] = useState<string>("MP4");
  const [settings, setSettings] = useState<PopupSettings>(defaultSettings);
  const [dlState, setDlState] = useState<"idle" | "busy" | "done">("idle");

  const refresh = useCallback(() => {
    chrome.runtime.sendMessage({ type: "GET_MEDIA_HITS" }, (res) => {
      if (chrome.runtime.lastError) {
        setError(chrome.runtime.lastError.message ?? "Unknown error");
        return;
      }
      const next = (res?.hits as MediaHit[]) ?? [];
      setHits(next);
      setError(null);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    chrome.storage.local.get(SETTINGS_KEY).then((data) => {
      const raw = data[SETTINGS_KEY] as Partial<PopupSettings> | undefined;
      if (raw && typeof raw === "object") {
        setSettings({ ...defaultSettings(), ...raw });
      }
    });
  }, []);

  const persistSettings = useCallback((next: PopupSettings) => {
    setSettings(next);
    void chrome.storage.local.set({ [SETTINGS_KEY]: next });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", settings.theme);
  }, [settings.theme]);

  const cycleTheme = useCallback(() => {
    const next: ThemeMode = settings.theme === "light" ? "dark" : "light";
    persistSettings({ ...settings, theme: next });
  }, [settings, persistSettings]);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const t = tabs[0];
      if (t?.id != null) setTabId(t.id);
      if (t?.title) setTabTitle(t.title);
      if (t?.url) setTabUrl(t.url);
    });
  }, [hits]);

  const tabHits = useMemo(() => {
    if (tabId == null) return hits;
    const forTab = hits.filter((h) => h.tabId === tabId);
    if (!tabUrl) return forTab.length ? forTab : hits;
    return forTab.filter((h) => sameVideoPage(tabUrl, h.pageUrl));
  }, [hits, tabId, tabUrl]);

  const primaryHit = tabHits[0] ?? null;

  const tabIsSupportedVideoPage = !tabUrl || isVoklerSupportedVideoPage(tabUrl);

  useEffect(() => {
    if (!tabHits.length) {
      setSelectedUrl(null);
      return;
    }
    if (!selectedUrl || !tabHits.some((h) => h.url === selectedUrl)) {
      setSelectedUrl(tabHits[0].url);
    }
  }, [tabHits, selectedUrl]);

  useEffect(() => {
    if (primaryHit) {
      setFmtSelected(formatChipForHit(primaryHit.mimeType, primaryHit.url));
    }
  }, [primaryHit?.url, primaryHit?.mimeType]);

  const selectedHit = useMemo(
    () => tabHits.find((h) => h.url === selectedUrl) ?? primaryHit,
    [tabHits, selectedUrl, primaryHit],
  );

  const qualityCards = useMemo(() => {
    const seen = new Set<string>();
    const list: MediaHit[] = [];
    for (const h of tabHits) {
      if (seen.has(h.url)) continue;
      seen.add(h.url);
      list.push(h);
      if (list.length >= 6) break;
    }
    return list;
  }, [tabHits]);

  const clear = () => {
    chrome.runtime.sendMessage({ type: "CLEAR_MEDIA_HITS" }, () => refresh());
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      return false;
    }
  };

  const startDownload = async () => {
    const url = selectedHit?.url;
    if (!url) return;
    setDlState("busy");
    setError(null);
    const res = await new Promise<{ ok?: boolean; error?: string }>((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "DOWNLOAD_STREAM",
          url,
          mimeType: selectedHit?.mimeType,
          pageTitle: tabTitle || "video",
          pageUrl: tabUrl || undefined,
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
    if (res.ok) {
      setDlState("done");
      window.setTimeout(() => setDlState("idle"), 2000);
      return;
    }
    const ok = await copyUrl(url);
    if (ok) {
      setDlState("idle");
      setError("Couldn’t start file download — stream URL copied to clipboard.");
      window.setTimeout(() => setError(null), 4500);
      return;
    }
    setDlState("idle");
    setError(res.error ?? "Download failed.");
  };

  const openApp = () => {
    const u = settings.appUrl.trim() || DEFAULT_APP_URL;
    chrome.tabs.create({ url: u });
  };

  const detectedTitle =
    tabTitle ||
    (primaryHit ? shorten(hostFromUrl(primaryHit.url), 40) : "No stream captured yet");

  const detectedHost = primaryHit ? hostFromUrl(primaryHit.url) : "—";
  const detectedTime = primaryHit ? relativeTime(primaryHit.timeStamp) : "";

  return (
    <div className="app">
      <div className="header">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            <svg viewBox="0 0 24 24">
              <path d="M12 3v12M7 10l5 5 5-5" />
              <path d="M3 19h18" />
            </svg>
          </div>
          <div>
            <div className="brand-name">Vokler</div>
            <div className="brand-version">v{version}</div>
          </div>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="icon-btn"
            title={settings.theme === "light" ? "Dark mode" : "Light mode"}
            onClick={cycleTheme}
          >
            {settings.theme === "light" ? (
              <svg viewBox="0 0 24 24" aria-hidden className="icon-btn__fill">
                <path
                  d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                  fill="currentColor"
                  stroke="none"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            )}
          </button>
          <button type="button" className="icon-btn" title="Refresh captures" onClick={refresh}>
            <svg viewBox="0 0 24 24">
              <path d="M2 12a10 10 0 1 1 1.5 5.2" />
              <path d="M2 18v-6h6" />
            </svg>
          </button>
          <button type="button" className="icon-btn" title="Pin is managed by the browser menu">
            <svg viewBox="0 0 24 24">
              <path d="M12 2l2.4 6.4H21l-5.4 3.9 2.1 6.4L12 15 6.3 18.7l2.1-6.4L3 8.4h6.6z" />
            </svg>
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Settings"
            onClick={() => setActiveTab("settings")}
          >
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>
        </div>
      </div>

      <div className="detected-bar">
        <div className="detected-thumb">
          <svg viewBox="0 0 24 24">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <polygon points="10,8 16,12 10,16" />
          </svg>
          {primaryHit ? (
            <div className="play-overlay">
              <svg viewBox="0 0 24 24">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
          ) : null}
        </div>
        <div className="detected-info">
          <div className="detected-title">{detectedTitle}</div>
          <div className="detected-meta">
            <div className="plat-chip">
              <div
                className="plat-dot"
                style={{ background: hostAccent(detectedHost) }}
              />
              {shorten(detectedHost, 22)}
            </div>
            {primaryHit ? (
              <div className="detected-dur">{detectedTime}</div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={`tab ${activeTab === "download" ? "active" : ""}`}
          onClick={() => setActiveTab("download")}
        >
          Download
        </button>
        <button
          type="button"
          className={`tab ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          History
        </button>
        <button
          type="button"
          className={`tab ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          Settings
        </button>
      </div>

      <div className="main">
        {error ? <p className="popup-error">{error}</p> : null}

        <div className={`page ${activeTab === "download" ? "active" : ""}`}>
          <div>
            <div className="section-label">Captured streams</div>
            {!tabIsSupportedVideoPage ? (
              <p className="empty-hint">
                This page isn’t a supported video URL. Open a watch page, reel, TikTok video, or
                similar so Vokler can detect the stream for this tab.
              </p>
            ) : qualityCards.length === 0 ? (
              <p className="empty-hint">
                Play a video on this tab. Stream-like requests (HLS, MP4, etc.) appear here when
                detected.
              </p>
            ) : (
              <div className="quality-grid">
                {qualityCards.map((h, i) => {
                  const sk = streamKind(h.mimeType, h.url);
                  const sel = h.url === selectedUrl;
                  return (
                    <button
                      key={h.url}
                      type="button"
                      className={`q-card ${sel ? "selected" : ""}`}
                      onClick={() => setSelectedUrl(h.url)}
                    >
                      {i === 0 ? <div className="q-badge">BEST</div> : null}
                      <div className="q-res">{sk.label}</div>
                      <div className="q-info">{sk.detail}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="section-label">Format hint</div>
            <div className="fmt-row" role="list">
              {FMT_OPTIONS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`fmt-chip ${fmtSelected === f ? "selected" : ""}`}
                  onClick={() => setFmtSelected(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="quick-opts">
            <div className="opt-row">
              <div>
                <div className="opt-label">
                  <svg viewBox="0 0 24 24">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  Include subtitles
                </div>
                <div className="opt-sub">For use with the full Vokler app</div>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.includeSubtitles}
                  onChange={(e) =>
                    persistSettings({ ...settings, includeSubtitles: e.target.checked })
                  }
                />
                <span className="track" />
              </label>
            </div>
            <div className="opt-row">
              <div>
                <div className="opt-label">
                  <svg viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M9 21V9" />
                  </svg>
                  Embed thumbnail
                </div>
                <div className="opt-sub">Prefer cover art when saving</div>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.embedThumb}
                  onChange={(e) =>
                    persistSettings({ ...settings, embedThumb: e.target.checked })
                  }
                />
                <span className="track" />
              </label>
            </div>
            <div className="opt-row">
              <div>
                <div className="opt-label">
                  <svg viewBox="0 0 24 24">
                    <path d="M4 4h16v4H4zM4 12h10M4 16h7" />
                  </svg>
                  Save metadata
                </div>
                <div className="opt-sub">Title, page URL, time</div>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.saveMetadata}
                  onChange={(e) =>
                    persistSettings({ ...settings, saveMetadata: e.target.checked })
                  }
                />
                <span className="track" />
              </label>
            </div>
          </div>

          <div className="dl-split">
            <button
              type="button"
              className={`dl-btn ${dlState === "done" ? "dl-btn--success" : ""}`}
              disabled={!selectedHit || dlState === "busy"}
              onClick={() => void startDownload()}
            >
              {dlState === "busy" ? (
                <>
                  <svg viewBox="0 0 24 24">
                    <path d="M12 2v4M12 18v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M2 12h4M18 12h4" />
                  </svg>
                  Downloading…
                </>
              ) : dlState === "done" ? (
                <>
                  <svg viewBox="0 0 24 24">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Started!
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24">
                    <path d="M12 3v12M7 10l5 5 5-5" />
                    <path d="M3 19h18" />
                  </svg>
                  Download stream
                </>
              )}
            </button>
            <button
              type="button"
              className="dl-more"
              title="Copy URL again"
              disabled={!selectedHit}
              onClick={() => selectedHit && void copyUrl(selectedHit.url)}
            >
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
                <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
                <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
              </svg>
            </button>
          </div>
        </div>

        <div className={`page ${activeTab === "history" ? "active" : ""}`}>
          <div className="history-list">
            {hits.length === 0 ? (
              <p className="empty-hint">No captures yet.</p>
            ) : (
              hits.map((h) => {
                const sk = streamKind(h.mimeType, h.url);
                const sel = h.url === selectedUrl;
                return (
                  <button
                    key={`${h.url}-${h.timeStamp}`}
                    type="button"
                    className={`hist-item ${sel ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedUrl(h.url);
                      setActiveTab("download");
                    }}
                  >
                    <div className="hist-thumb">
                      <svg viewBox="0 0 24 24">
                        <polygon points="5,3 19,12 5,21" />
                      </svg>
                    </div>
                    <div className="hist-info">
                      <div className="hist-title">
                        {shorten(
                          (() => {
                            try {
                              const u = new URL(h.url);
                              return u.hostname + u.pathname;
                            } catch {
                              return h.url;
                            }
                          })(),
                          52,
                        )}
                      </div>
                      <div className="hist-meta">
                        {sk.label} · {fmtSelected} · {relativeTime(h.timeStamp)}
                      </div>
                    </div>
                    <div className="hist-status st-done">Saved</div>
                  </button>
                );
              })
            )}
          </div>
          <button type="button" className="clear-history-btn" onClick={clear}>
            Clear history
          </button>
        </div>

        <div className={`page ${activeTab === "settings" ? "active" : ""}`}>
          <div className="settings-section">
            <div className="setting-group">
              <div className="setting-group-label">Appearance</div>
              <div className="setting-item">
                <div>
                  <div className="setting-name">Theme</div>
                  <div className="setting-desc">Light or dark interface</div>
                </div>
                <div className="theme-seg" role="group" aria-label="Theme">
                  <button
                    type="button"
                    className={`theme-seg__btn ${settings.theme === "light" ? "active" : ""}`}
                    onClick={() => persistSettings({ ...settings, theme: "light" })}
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    className={`theme-seg__btn ${settings.theme === "dark" ? "active" : ""}`}
                    onClick={() => persistSettings({ ...settings, theme: "dark" })}
                  >
                    Dark
                  </button>
                </div>
              </div>
            </div>

            <div className="setting-group">
              <div className="setting-group-label">App</div>
              <div className="setting-item">
                <div>
                  <div className="setting-name">Full app URL</div>
                  <div className="setting-desc">Opens in a new tab</div>
                </div>
                <input
                  className="setting-input setting-input--url"
                  type="url"
                  value={settings.appUrl}
                  onChange={(e) => persistSettings({ ...settings, appUrl: e.target.value })}
                />
              </div>
            </div>

            <div className="setting-group">
              <div className="setting-group-label">Behavior</div>
              <div className="setting-item">
                <div>
                  <div className="setting-name">Auto-detect on page load</div>
                  <div className="setting-desc">Extension records stream requests</div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settings.autoDetect}
                    onChange={(e) =>
                      persistSettings({ ...settings, autoDetect: e.target.checked })
                    }
                  />
                  <span className="track" />
                </label>
              </div>
              <div className="setting-item">
                <div>
                  <div className="setting-name">Badge count on icon</div>
                  <div className="setting-desc">Show “1” on supported video pages</div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settings.badgeCount}
                    onChange={(e) =>
                      persistSettings({ ...settings, badgeCount: e.target.checked })
                    }
                  />
                  <span className="track" />
                </label>
              </div>
              <div className="setting-item">
                <div>
                  <div className="setting-name">Notify on completion</div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settings.notifyOnComplete}
                    onChange={(e) =>
                      persistSettings({ ...settings, notifyOnComplete: e.target.checked })
                    }
                  />
                  <span className="track" />
                </label>
              </div>
            </div>

            <div className="setting-group">
              <div className="setting-group-label">Advanced</div>
              <div className="setting-item">
                <div>
                  <div className="setting-name">Rate limiting</div>
                  <div className="setting-desc">Placeholder</div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settings.rateLimit}
                    onChange={(e) =>
                      persistSettings({ ...settings, rateLimit: e.target.checked })
                    }
                  />
                  <span className="track" />
                </label>
              </div>
              <div className="setting-item">
                <div>
                  <div className="setting-name">Use proxy</div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={settings.useProxy}
                    onChange={(e) =>
                      persistSettings({ ...settings, useProxy: e.target.checked })
                    }
                  />
                  <span className="track" />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="footer">
        <div className="footer-stat">
          <span>{hits.length}</span> captures · tab{" "}
          <span>{tabId ?? "—"}</span>
        </div>
        <button type="button" className="open-app" onClick={openApp}>
          Open full app ↗
        </button>
      </div>
    </div>
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
