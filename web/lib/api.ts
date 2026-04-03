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

export type HistoryEntryDto = {
  id: string;
  job_id: string | null;
  title: string;
  source_url: string;
  artifact_uri: string;
  created_at: string;
};

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
