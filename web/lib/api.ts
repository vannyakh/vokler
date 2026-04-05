const DEFAULT_ORIGIN = "http://127.0.0.1:8000";

function publicBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_ORIGIN).replace(/\/$/, "");
}

function proxyEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_PROXY === "true";
}

/** Optional Bearer token (e.g. mobile app); the web UI does not use auth. */
function accessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("vokler_access_token");
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

export type PreviewResponseDto = {
  title: string | null;
  duration_seconds: number | null;
  duration_label: string | null;
  uploader: string | null;
  thumbnail: string | null;
  webpage_url: string | null;
  recommended_format: string | null;
  formats: MediaFormatRowDto[];
};

export async function previewMedia(url: string): Promise<PreviewResponseDto> {
  return apiFetch<PreviewResponseDto>("/preview", {
    method: "POST",
    body: JSON.stringify({ url: url.trim() }),
  });
}

/** Fetch finished archive ZIP and trigger the browser Save / Downloads UI. */
export async function downloadArchiveFileToBrowser(
  archiveId: string,
  fallbackFilename: string,
): Promise<void> {
  const headers = new Headers();
  const token = accessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(apiUrl(`/files/archive/${archiveId}`), { headers });
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const j = JSON.parse(text) as { detail?: unknown };
      if (typeof j.detail === "string") detail = j.detail;
      else if (Array.isArray(j.detail)) detail = JSON.stringify(j.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail || `${res.status} ${res.statusText}`);
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

/** Fetch finished job file and trigger the browser Save / Downloads UI. */
export async function downloadJobFileToBrowser(
  jobId: string,
  fallbackFilename: string,
): Promise<void> {
  const headers = new Headers();
  const token = accessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(apiUrl(`/files/${jobId}`), { headers });
  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const j = JSON.parse(text) as { detail?: unknown };
      if (typeof j.detail === "string") detail = j.detail;
      else if (Array.isArray(j.detail)) detail = JSON.stringify(j.detail);
    } catch {
      /* ignore */
    }
    throw new Error(
      detail || `${res.status} ${res.statusText}`,
    );
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

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = accessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(apiUrl(path), { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function setAccessToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem("vokler_access_token", token);
  else localStorage.removeItem("vokler_access_token");
}

/** WebSocket URL (direct to FastAPI). Configure CORS / mixed-content for your deploy. */
export function wsUrlForJob(jobId: string): string {
  const base = publicBase().replace(/^http/, "ws");
  return `${base}/ws/jobs/${jobId}`;
}
