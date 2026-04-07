import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { headersJsonWithAppKey, mergeFrontendAppKey } from "../shared/api-auth";
import {
  appendPendingDownload,
  compactQueueItems,
  DOWNLOAD_QUEUE_KEY,
  type DownloadQueueItem,
} from "../shared/download-queue";
import { isVoklerSupportedVideoPage } from "../shared/supported-video-pages";

import "./popup.css";

type TabId = "download" | "settings";

type ThemeMode = "light" | "dark";

const SETTINGS_KEY = "voklerPopupSettings";
const DEFAULT_APP_URL = "http://127.0.0.1:3000";
const DEFAULT_API_URL = "http://127.0.0.1:8000";

type PopupSettings = {
  theme: ThemeMode;
  appUrl: string;
  apiBaseUrl: string;
  frontendAppKey: string;
  autoDetect: boolean;
  badgeCount: boolean;
  notifyOnComplete: boolean;
};

const defaultSettings = (): PopupSettings => ({
  theme: "light",
  appUrl: DEFAULT_APP_URL,
  apiBaseUrl: DEFAULT_API_URL,
  frontendAppKey: "",
  autoDetect: true,
  badgeCount: true,
  notifyOnComplete: false,
});

type PreviewDto = {
  title: string | null;
  duration_seconds: number | null;
  duration_label: string | null;
  uploader: string | null;
  thumbnail: string | null;
  webpage_url: string | null;
  recommended_format: string | null;
};

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "page";
  }
}

function hostAccent(host: string): string {
  let h = 0;
  for (let i = 0; i < host.length; i++) h = (h * 31 + host.charCodeAt(i)) >>> 0;
  const colors = ["#e8521a", "#1a7a4a", "#1a4e8c", "#a06800", "#6b4e9e"];
  return colors[h % colors.length];
}

function shorten(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function extForFormat(format: string): string {
  const f = format.toLowerCase();
  if (f.startsWith("mp3")) return ".mp3";
  return ".mp4";
}

function normalizeApiBase(raw: string): string {
  const u = raw.trim().replace(/\/$/, "");
  return u || DEFAULT_API_URL;
}

async function readFetchError(res: Response): Promise<string> {
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

/** Popup fetch avoids MV3 service-worker message ports closing before sendResponse. */
async function fetchPreviewDirect(
  apiBase: string,
  pageUrl: string,
  storedAppKey: string | undefined,
): Promise<PreviewDto> {
  const base = normalizeApiBase(apiBase);
  const appKey = mergeFrontendAppKey(storedAppKey);
  const res = await fetch(`${base}/preview`, {
    method: "POST",
    headers: headersJsonWithAppKey(appKey),
    body: JSON.stringify({ url: pageUrl.trim() }),
  });
  if (!res.ok) {
    throw new Error(await readFetchError(res));
  }
  return res.json() as Promise<PreviewDto>;
}

function normalizeThumbnailUrl(t: string | null | undefined): string | null {
  if (t == null || typeof t !== "string") return null;
  const s = t.trim();
  if (!s) return null;
  if (s.startsWith("//")) return `https:${s}`;
  if (/^https?:\/\//i.test(s)) return s;
  return null;
}

/** YouTube watch / shorts / youtu.be — public CDN thumbs when API preview is slow or missing. */
function youtubeVideoIdFromUrl(href: string): string | null {
  try {
    const u = new URL(href);
    const h = u.hostname.replace(/^www\./, "");
    if (h === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (h === "m.youtube.com" || h.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v && /^[\w-]{11}$/.test(v)) return v;
      if (u.pathname.startsWith("/shorts/")) {
        const seg = u.pathname.split("/").filter(Boolean)[1];
        if (seg && /^[\w-]{11}$/.test(seg)) return seg;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function youtubeThumbFallback(href: string): string | null {
  const id = youtubeVideoIdFromUrl(href);
  if (!id) return null;
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

function kickQueueFromBackground(): void {
  chrome.runtime.sendMessage({ type: "QUEUE_KICK" });
}

function readQueueFromStorage(): Promise<DownloadQueueItem[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get(DOWNLOAD_QUEUE_KEY, (d) => {
      const raw = d[DOWNLOAD_QUEUE_KEY];
      resolve(Array.isArray(raw) ? (raw as DownloadQueueItem[]) : []);
    });
  });
}

function writeQueueToStorage(items: DownloadQueueItem[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [DOWNLOAD_QUEUE_KEY]: items }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function App() {
  const version = chrome.runtime.getManifest().version;
  const [error, setError] = useState<string | null>(null);
  const [tabTitle, setTabTitle] = useState<string>("");
  const [tabUrl, setTabUrl] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabId>("download");
  const [settings, setSettings] = useState<PopupSettings>(defaultSettings);
  const [dlState, setDlState] = useState<"idle" | "adding" | "added">("idle");
  const [queueItems, setQueueItems] = useState<DownloadQueueItem[]>([]);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [previewStatus, setPreviewStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [preview, setPreview] = useState<PreviewDto | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [thumbCandidateIndex, setThumbCandidateIndex] = useState(0);

  const loadTab = useCallback(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const t = tabs[0];
      if (t?.title) setTabTitle(t.title);
      if (t?.url) setTabUrl(t.url);
    });
  }, []);

  useEffect(() => {
    loadTab();
  }, [loadTab]);

  useEffect(() => {
    kickQueueFromBackground();
  }, []);

  useEffect(() => {
    const loadQ = () => {
      chrome.storage.local.get(DOWNLOAD_QUEUE_KEY, (d) => {
        const raw = d[DOWNLOAD_QUEUE_KEY];
        setQueueItems(Array.isArray(raw) ? (raw as DownloadQueueItem[]) : []);
      });
    };
    loadQ();
    const onStorage = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== "local" || !changes[DOWNLOAD_QUEUE_KEY]) return;
      const n = changes[DOWNLOAD_QUEUE_KEY].newValue;
      setQueueItems(Array.isArray(n) ? (n as DownloadQueueItem[]) : []);
    };
    chrome.storage.onChanged.addListener(onStorage);
    return () => chrome.storage.onChanged.removeListener(onStorage);
  }, []);

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

  const tabIsSupportedVideoPage = !tabUrl || isVoklerSupportedVideoPage(tabUrl);

  useEffect(() => {
    if (!tabUrl || !tabIsSupportedVideoPage) {
      setPreviewStatus("idle");
      setPreview(null);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    setPreviewStatus("loading");
    setPreviewError(null);
    void (async () => {
      try {
        const data = await fetchPreviewDirect(
          settings.apiBaseUrl,
          tabUrl,
          settings.frontendAppKey,
        );
        if (cancelled) return;
        setPreview(data);
        setPreviewStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setPreviewStatus("error");
        setPreviewError(e instanceof Error ? e.message : String(e));
        setPreview(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tabUrl, tabIsSupportedVideoPage, previewNonce, settings.apiBaseUrl, settings.frontendAppKey]);

  const thumbnailCandidates = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();
    const push = (u: string | null) => {
      if (!u || seen.has(u)) return;
      seen.add(u);
      list.push(u);
    };
    push(normalizeThumbnailUrl(preview?.thumbnail));
    push(youtubeThumbFallback(tabUrl));
    return list;
  }, [preview?.thumbnail, tabUrl]);

  useEffect(() => {
    setThumbCandidateIndex(0);
  }, [thumbnailCandidates.join("|")]);

  const activeThumbnail =
    thumbCandidateIndex < thumbnailCandidates.length
      ? thumbnailCandidates[thumbCandidateIndex]
      : null;

  const displayTitle = useMemo(() => {
    if (preview?.title?.trim()) return preview.title.trim();
    return tabTitle || "Current tab";
  }, [preview, tabTitle]);

  const formatForJob = useMemo(() => {
    const r = preview?.recommended_format?.trim();
    if (r) return r;
    return "original";
  }, [preview]);

  const hostLabel = tabUrl ? hostFromUrl(tabUrl) : "—";

  const sortedQueue = useMemo(
    () => [...queueItems].sort((a, b) => b.createdAt - a.createdAt),
    [queueItems],
  );

  const activeQueueCount = useMemo(
    () => queueItems.filter((i) => i.status === "pending" || i.status === "running").length,
    [queueItems],
  );

  const thisTabJob = useMemo(() => {
    if (!tabUrl) return null;
    return (
      queueItems.find(
        (i) =>
          i.pageUrl === tabUrl &&
          (i.status === "pending" || i.status === "running"),
      ) ?? null
    );
  }, [queueItems, tabUrl]);

  const finishedCount = useMemo(
    () => queueItems.filter((i) => i.status === "completed" || i.status === "failed").length,
    [queueItems],
  );

  const refreshAll = () => {
    loadTab();
    setPreviewNonce((n) => n + 1);
  };

  const addToQueue = async () => {
    if (!tabUrl || !tabIsSupportedVideoPage) return;
    setDlState("adding");
    setError(null);
    const thumb = thumbnailCandidates[0] ?? null;
    try {
      const existing = await readQueueFromStorage();
      const r = appendPendingDownload(existing, {
        pageUrl: tabUrl,
        pageTitle: tabTitle,
        displayTitle: displayTitle,
        format: formatForJob,
        thumbnailUrl: thumb,
      });
      if (!r.ok) {
        setError(r.error);
        setDlState("idle");
        return;
      }
      await writeQueueToStorage(r.next);
      kickQueueFromBackground();
      setQueueItems(r.next);
      setDlState("added");
      window.setTimeout(() => setDlState("idle"), 1600);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDlState("idle");
    }
  };

  const clearFinished = async () => {
    try {
      const q = await readQueueFromStorage();
      const next = compactQueueItems(q.filter((i) => i.status === "pending" || i.status === "running"));
      await writeQueueToStorage(next);
      setQueueItems(next);
    } catch {
      /* ignore */
    }
  };

  const openApp = () => {
    const u = settings.appUrl.trim() || DEFAULT_APP_URL;
    chrome.tabs.create({ url: u });
  };

  const canDownload = tabIsSupportedVideoPage && !!tabUrl && dlState !== "adding";

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
          <button type="button" className="icon-btn" title="Refresh" onClick={refreshAll}>
            <svg viewBox="0 0 24 24">
              <path d="M2 12a10 10 0 1 1 1.5 5.2" />
              <path d="M2 18v-6h6" />
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

      <section className="dl-section dl-section--flush">
        <div className="dl-section-head">
          <h2 className="dl-section-title">Current video</h2>
          <p className="dl-section-sub">
            Add to the background queue and keep watching — earlier videos finish even if you navigate
            away.
          </p>
        </div>
        <div className="video-detail-card video-detail-card--rich">
          <div className="video-detail-thumb">
            {activeThumbnail ? (
              <img
                src={activeThumbnail}
                alt=""
                className="video-detail-thumb-img"
                referrerPolicy="no-referrer"
                loading="lazy"
                decoding="async"
                onError={() =>
                  setThumbCandidateIndex((i) =>
                    i + 1 < thumbnailCandidates.length ? i + 1 : thumbnailCandidates.length,
                  )
                }
              />
            ) : (
              <div className="video-detail-thumb-fallback">
                <svg viewBox="0 0 24 24" aria-hidden>
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <polygon points="10,8 16,12 10,16" />
                </svg>
              </div>
            )}
          </div>
          <div className="video-detail-body">
            <div className="video-detail-title" title={displayTitle}>
              {shorten(displayTitle, 80)}
            </div>
            <div className="video-detail-meta">
              <span className="plat-chip">
                <span className="plat-dot" style={{ background: hostAccent(hostLabel) }} />
                {shorten(hostLabel, 22)}
              </span>
              {preview?.duration_label ? (
                <span className="video-detail-dur">{preview.duration_label}</span>
              ) : null}
            </div>
            {preview?.uploader?.trim() ? (
              <div className="video-detail-uploader">{shorten(preview.uploader.trim(), 52)}</div>
            ) : null}
            {!tabIsSupportedVideoPage ? (
              <p className="video-detail-hint">
                Open a supported video page (watch URL, reel, TikTok video, etc.).
              </p>
            ) : previewStatus === "loading" ? (
              <p className="video-detail-hint">Loading video info from API…</p>
            ) : previewStatus === "error" ? (
              <p className="video-detail-hint video-detail-hint--warn">
                {previewError ??
                  "Preview unavailable — download may still work if the API can fetch this URL."}
              </p>
            ) : null}
          </div>
        </div>
        {tabUrl && tabIsSupportedVideoPage ? (
          <dl className="dl-meta-grid">
            <div className="dl-meta-row">
              <dt>Page URL</dt>
              <dd title={tabUrl}>{shorten(tabUrl, 46)}</dd>
            </div>
            <div className="dl-meta-row">
              <dt>Format</dt>
              <dd title={formatForJob}>
                <code className="dl-mono">{shorten(formatForJob, 36)}</code>
              </dd>
            </div>
            {preview?.webpage_url ? (
              <div className="dl-meta-row">
                <dt>Canonical</dt>
                <dd title={preview.webpage_url}>{shorten(preview.webpage_url, 46)}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </section>

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
          className={`tab ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          Settings
        </button>
      </div>

      <div className="main">
        {error ? <p className="popup-error">{error}</p> : null}

        <div className={`page ${activeTab === "download" ? "active" : ""}`}>
          {thisTabJob ? (
            <div className="dl-progress-block dl-progress-block--tab">
              <div className="dl-progress-head">
                <span className="dl-progress-label">
                  {thisTabJob.status === "pending" ? "Queued" : "Downloading this video"}
                </span>
                {thisTabJob.status === "running" ? (
                  <span className="dl-progress-pct">{Math.round(thisTabJob.progress)}%</span>
                ) : null}
              </div>
              <div className="dl-progress-track" aria-hidden>
                <div
                  className={`dl-progress-fill ${thisTabJob.status === "pending" ? "dl-progress-fill--pulse" : ""}`}
                  style={{
                    width:
                      thisTabJob.status === "pending"
                        ? "28%"
                        : `${Math.min(100, Math.max(0, thisTabJob.progress))}%`,
                  }}
                />
              </div>
            </div>
          ) : null}

          <div className="dl-actions">
            <button
              type="button"
              className={`dl-btn ${dlState === "added" ? "dl-btn--success" : ""}`}
              disabled={!canDownload}
              onClick={() => void addToQueue()}
            >
              {dlState === "adding" ? (
                <>
                  <svg viewBox="0 0 24 24" className="dl-btn__spin" aria-hidden>
                    <path d="M12 2v4M12 18v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M2 12h4M18 12h4" />
                  </svg>
                  Adding…
                </>
              ) : dlState === "added" ? (
                <>
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  In queue
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path d="M12 3v12M7 10l5 5 5-5" />
                    <path d="M3 19h18" />
                  </svg>
                  Add to download queue
                </>
              )}
            </button>
            <p className="dl-hint">
              Runs in the background. Queue order: first in, first out. Duplicate URLs are blocked
              while already queued or downloading.
            </p>
          </div>

          <section className="dl-section">
            <div className="dl-section-head dl-section-head--row">
              <div>
                <h2 className="dl-section-title">Queue</h2>
                <p className="dl-section-sub dl-section-sub--inline">
                  {activeQueueCount} active
                  {finishedCount ? ` · ${finishedCount} recent finished` : ""}
                </p>
              </div>
              {finishedCount > 0 ? (
                <button type="button" className="btn-text" onClick={() => void clearFinished()}>
                  Clear finished
                </button>
              ) : null}
            </div>
            {sortedQueue.length === 0 ? (
              <p className="queue-empty">No downloads yet. Add the current video to start.</p>
            ) : (
              <ul className="queue-list">
                {sortedQueue.map((item) => {
                  const isThisTab = tabUrl !== "" && item.pageUrl === tabUrl;
                  const st = item.status;
                  const stLabel =
                    st === "pending"
                      ? "Queued"
                      : st === "running"
                        ? "Downloading"
                        : st === "completed"
                          ? "Saved"
                          : "Failed";
                  return (
                    <li
                      key={item.localId}
                      className={`queue-row ${isThisTab ? "queue-row--current" : ""}`}
                    >
                      <div className="queue-row-thumb">
                        {item.thumbnailUrl ? (
                          <img src={item.thumbnailUrl} alt="" referrerPolicy="no-referrer" />
                        ) : (
                          <span className="queue-row-thumb-ph" aria-hidden>
                            <svg viewBox="0 0 24 24">
                              <polygon points="10,8 16,12 10,16" fill="currentColor" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <div className="queue-row-body">
                        <div className="queue-row-title" title={item.displayTitle}>
                          {shorten(item.displayTitle, 56)}
                        </div>
                        <div className="queue-row-meta">
                          <span className={`queue-status queue-status--${st}`}>{stLabel}</span>
                          {isThisTab ? <span className="queue-pill">This tab</span> : null}
                          <span className="queue-fmt">{shorten(item.format, 20)}</span>
                        </div>
                        {st === "running" ? (
                          <div className="queue-progress-track">
                            <div
                              className="queue-progress-fill"
                              style={{
                                width: `${Math.min(100, Math.max(0, item.progress))}%`,
                              }}
                            />
                          </div>
                        ) : null}
                        {st === "failed" && item.error ? (
                          <p className="queue-row-err">{shorten(item.error, 120)}</p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className={`page ${activeTab === "settings" ? "active" : ""}`}>
          <div className="settings-intro">
            <p className="settings-intro-lead">Vokler extension</p>
            <p className="settings-intro-text">
              Point the extension at your FastAPI backend and optional <code>X-App-Key</code>. Preview
              loads in the popup; downloads are processed in the background queue so you can change
              videos anytime.
            </p>
          </div>
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
              <div className="setting-group-label">Connections</div>
              <div className="setting-item setting-item--stack">
                <div>
                  <div className="setting-name">Web app URL</div>
                  <div className="setting-desc">Next.js UI — opened from the footer link</div>
                </div>
                <input
                  className="setting-input setting-input--url"
                  type="url"
                  value={settings.appUrl}
                  onChange={(e) => persistSettings({ ...settings, appUrl: e.target.value })}
                />
              </div>
              <div className="setting-item setting-item--stack">
                <div>
                  <div className="setting-name">API base URL</div>
                  <div className="setting-desc">
                    Same host/port as <code className="setting-code">NEXT_PUBLIC_API_URL</code> (e.g.
                    http://127.0.0.1:8000)
                  </div>
                </div>
                <input
                  className="setting-input setting-input--url"
                  type="url"
                  value={settings.apiBaseUrl}
                  onChange={(e) => persistSettings({ ...settings, apiBaseUrl: e.target.value })}
                />
              </div>
              <div className="setting-item setting-item--stack">
                <div>
                  <div className="setting-name">Frontend app key</div>
                  <div className="setting-desc">
                    Same as API <code className="setting-code">FRONTEND_APP_KEY</code> — sent as{" "}
                    <code className="setting-code">X-App-Key</code>. Optional if baked in at build (
                    <code className="setting-code">VITE_FRONTEND_APP_KEY</code>).
                  </div>
                </div>
                <input
                  className="setting-input setting-input--url"
                  type="password"
                  autoComplete="off"
                  placeholder="Paste key if not set in extension .env"
                  value={settings.frontendAppKey}
                  onChange={(e) => persistSettings({ ...settings, frontendAppKey: e.target.value })}
                />
              </div>
            </div>

            <div className="setting-group">
              <div className="setting-group-label">Behavior</div>
              <div className="setting-item">
                <div>
                  <div className="setting-name">Auto-detect streams</div>
                  <div className="setting-desc">
                    Capture media requests for the injected player bar (not used for API downloads)
                  </div>
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
                  <div className="setting-name">Badge on icon</div>
                  <div className="setting-desc">On supported video pages</div>
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
                  <div className="setting-name">Notify when file is ready</div>
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
          </div>
        </div>
      </div>

      <div className="footer footer--simple">
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
