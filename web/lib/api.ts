function stripCopyPasteQuotes(s: string): string {
  const t = s.trim();
  if (t.length >= 2) {
    const a = t[0];
    const b = t[t.length - 1];
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) {
      return t.slice(1, -1).trim();
    }
  }
  return t;
}

function publicBase(): string {
  let raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) {
    throw new Error(
      "Lost connection to the API. Please check your internet connection and try again.",
    );
  }
  raw = stripCopyPasteQuotes(raw);
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }
  raw = raw.replace(/\/$/, "");
  try {
    new URL(raw);
  } catch {
    throw new Error("NEXT_PUBLIC_API_URL is set but is not a valid URL.");
  }
  return raw;
}

function proxyEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_PROXY === "true";
}

/** Optional Bearer token (e.g. mobile app); the web UI does not use auth. */
function accessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("vokler_access_token");
}

function frontendAppKey(): string | null {
  const k =
    process.env.NEXT_PUBLIC_FRONTEND_APP_KEY ??
    process.env.NEXT_PUBLIC_APP_KEY;
  return k && k.length > 0 ? k : null;
}

function applyAppKey(headers: Headers): void {
  const k = frontendAppKey();
  if (k) headers.set("X-App-Key", k);
}

/** Build request URL: direct FastAPI or same-origin proxy (`/api/proxy?forward=...`). */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (proxyEnabled()) {
    return `/api/proxy?forward=${encodeURIComponent(p)}`;
  }
  return `${publicBase()}${p}`;
}

export type ArchiveJobDto = {
  id: string;
  status: string;
  progress: number;
  error_message: string | null;
  download_format: string;
  label: string | null;
  source_urls: string[];
  total_items: number;
  current_index: number;
  result_path: string | null;
  created_at: string;
  updated_at: string;
};

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

export type MediaFormatRowDto = {
  format_id: string;
  ext: string;
  resolution: string;
  fps: number | null;
  filesize: number | null;
  vcodec: string | null;
  acodec: string | null;
  format_note: string | null;
  tbr: number | null;
};

export type BundlePreviewItemDto = {
  url: string;
  title: string;
  thumbnail: string | null;
  duration_seconds: number | null;
  duration_label: string | null;
};

export type PreviewResponseDto = {
  title: string | null;
  duration_seconds: number | null;
  duration_label: string | null;
  uploader: string | null;
  thumbnail: string | null;
  webpage_url: string | null;
  recommended_format: string | null;
  formats: MediaFormatRowDto[];
  bundle_title?: string | null;
  bundle_items?: BundlePreviewItemDto[];
};

export type PreviewRequestType = "video" | "playlist" | "profile";

export async function previewMedia(
  url: string,
  type?: PreviewRequestType | null,
): Promise<PreviewResponseDto> {
  const payload: { url: string; type?: PreviewRequestType } = { url: url.trim() };
  if (type === "playlist" || type === "profile") {
    payload.type = type;
  }
  return apiFetch<PreviewResponseDto>("/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

type JobFileDownloadLinkDto = { mode: "redirect" | "blob"; url: string };

function apiAuthHeaders(): Headers {
  const headers = new Headers();
  applyAppKey(headers);
  const token = accessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

function readErrorDetail(text: string): string {
  let detail = text;
  try {
    const j = JSON.parse(text) as { detail?: unknown };
    if (typeof j.detail === "string") detail = j.detail;
    else if (Array.isArray(j.detail)) detail = JSON.stringify(j.detail);
  } catch {
    /* ignore */
  }
  return detail;
}

/** True when running on a mobile/touch browser (client-side only). */
function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Build a browser-navigable href for a completed job file.
 *
 * - Proxy mode: returns a same-origin `/api/proxy?forward=/files/{id}` URL — the
 *   Next.js proxy adds X-App-Key server-side, so no header workaround needed.
 * - Direct mode: returns the full API URL with `?app_key=…` appended so the
 *   FrontendAppKeyMiddleware accepts plain browser navigation (no custom headers).
 */
export function jobFileHref(job: JobDto): string {
  return _fileHref(`/files/${job.id}`);
}

/** Same as `jobFileHref` but for archive ZIPs. */
export function archiveFileHref(archiveId: string): string {
  return _fileHref(`/files/archive/${archiveId}`);
}

function _fileHref(apiPath: string): string {
  if (proxyEnabled()) {
    return apiUrl(apiPath);
  }
  const base = apiUrl(apiPath);
  const k = frontendAppKey();
  if (k) {
    try {
      const u = new URL(base);
      u.searchParams.set("app_key", k);
      return u.toString();
    } catch {
      const sep = base.includes("?") ? "&" : "?";
      return `${base}${sep}app_key=${encodeURIComponent(k)}`;
    }
  }
  return base;
}

/**
 * Presigned / public URLs: open in a new tab on desktop.
 * On mobile, programmatic clicks are blocked after async polling; navigate via
 * window.location.assign instead (no user-gesture requirement, and
 * Content-Disposition: attachment prevents the page from navigating away).
 */
function openExternalDownload(url: string, fallbackFilename: string): void {
  if (isMobileBrowser()) {
    window.location.assign(url);
    return;
  }
  const filename =
    fallbackFilename.replace(/[^\w.\-()\s[\]]/g, "_").trim() || "download";
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function fetchDownloadLinkJson(path: string): Promise<JobFileDownloadLinkDto> {
  const res = await fetch(apiUrl(path), { headers: apiAuthHeaders() });
  if (!res.ok) {
    throw new Error(readErrorDetail(await res.text()) || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<JobFileDownloadLinkDto>;
}

/** Fetch finished archive ZIP and trigger the browser Save / Downloads UI. */
export async function downloadArchiveFileToBrowser(
  archiveId: string,
  fallbackFilename: string,
): Promise<void> {
  const link = await fetchDownloadLinkJson(`/files/archive/${archiveId}/download-link`);
  if (link.mode === "redirect") {
    openExternalDownload(link.url, fallbackFilename || "download.zip");
    return;
  }
  // Mobile: blob tricks (fetch → createObjectURL → a.click) are blocked after async polling.
  // Navigate directly instead — FastAPI serves Content-Disposition: attachment.
  if (isMobileBrowser()) {
    window.location.assign(archiveFileHref(archiveId));
    return;
  }
  const res = await fetch(apiUrl(link.url), { headers: apiAuthHeaders() });
  if (!res.ok) {
    throw new Error(readErrorDetail(await res.text()) || `${res.status} ${res.statusText}`);
  }
  const cd = res.headers.get("Content-Disposition");
  let filename = fallbackFilename.replace(/[^\w.\-()\s[\]]/g, "_").trim() || "download.zip";
  const m = cd?.match(/filename\*?=(?:UTF-8'')?["']?([^";\n]+)["']?/i);
  if (m?.[1]) {
    try {
      filename = decodeURIComponent(m[1].trim());
    } catch {
      filename = m[1].trim();
    }
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Public / R2 HTTPS artifact: open directly (avoids `/files/.../download-link`). */
function isDirectHttpResultPath(path: string | null | undefined): path is string {
  const p = (path ?? "").trim();
  return p.startsWith("https://") || p.startsWith("http://");
}

/**
 * After a single job completes, prefer ``GET /jobs/{id}``’s ``result_path`` when it is already
 * a public HTTPS URL; otherwise fall back to ``/files/{id}/download-link`` (local disk / presigned).
 */
export async function downloadJobFileToBrowser(
  job: JobDto,
  fallbackFilename: string,
): Promise<void> {
  const completed = (job.status || "").toLowerCase() === "completed";
  if (completed && isDirectHttpResultPath(job.result_path)) {
    openExternalDownload(job.result_path.trim(), fallbackFilename || "download.bin");
    return;
  }

  const link = await fetchDownloadLinkJson(`/files/${job.id}/download-link`);
  if (link.mode === "redirect") {
    openExternalDownload(link.url, fallbackFilename || "download.bin");
    return;
  }
  // Mobile: blob tricks (fetch → createObjectURL → a.click) are blocked after async polling.
  // Navigate directly instead — FastAPI serves Content-Disposition: attachment.
  if (isMobileBrowser()) {
    window.location.assign(jobFileHref(job));
    return;
  }
  const res = await fetch(apiUrl(link.url), { headers: apiAuthHeaders() });
  if (!res.ok) {
    throw new Error(readErrorDetail(await res.text()) || `${res.status} ${res.statusText}`);
  }
  const cd = res.headers.get("Content-Disposition");
  let filename = fallbackFilename.replace(/[^\w.\-()\s[\]]/g, "_").trim() || "download.bin";
  const m = cd?.match(/filename\*?=(?:UTF-8'')?["']?([^";\n]+)["']?/i);
  if (m?.[1]) {
    try {
      filename = decodeURIComponent(m[1].trim());
    } catch {
      filename = m[1].trim();
    }
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type AuthUserDto = {
  id: string;
  email: string;
  created_at: string;
};

export type TokenPairDto = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export async function fetchCurrentUser(): Promise<AuthUserDto> {
  return apiFetch<AuthUserDto>("/auth/me");
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  applyAppKey(headers);
  const token = accessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(apiUrl(path), { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(readErrorDetail(text) || `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function setAccessToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem("vokler_access_token", token);
  else localStorage.removeItem("vokler_access_token");
}

export function wsUrlForJob(jobId: string): string {
  const httpBase = publicBase();
  // Must not use .replace(/^http/, "wss") — that turns "https://" into "wsss://".
  const wsBase = httpBase.replace(/^https:\/\//i, "wss://").replace(/^http:\/\//i, "ws://");
  const k = frontendAppKey();
  const q = k ? `?app_key=${encodeURIComponent(k)}` : "";
  return `${wsBase}/ws/jobs/${jobId}${q}`;
}
