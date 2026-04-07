/** Non-empty lines = URLs (one per line). */
export function parseUrls(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Enough structure to start a preview fetch (avoids spam while typing). */
export function looksLikeHttpUrl(s: string): boolean {
  const t = s.trim();
  if (t.length < 11) return false;
  if (!/^https?:\/\//i.test(t)) return false;
  try {
    const u = new URL(t);
    return Boolean(u.hostname);
  } catch {
    return false;
  }
}

function isYoutubeHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h.includes("youtube.com") || h.includes("youtu.be");
}

/** Shape of a YouTube URL for tab hints (order: playlist → profile/channel → single video). */
export type YoutubeUrlKind = "playlist" | "profile" | "single";

export function youtubeUrlKind(url: string): YoutubeUrlKind | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (!isYoutubeHost(u.hostname)) return null;

  const list = u.searchParams.get("list");
  if (list?.trim()) return "playlist";
  const p = u.pathname.toLowerCase();
  if (p.includes("/playlist")) return "playlist";

  if (
    p.startsWith("/@") ||
    p.includes("/channel/") ||
    /^\/c\/[^/]+/.test(p) ||
    /^\/user\/[^/]+/.test(p)
  ) {
    return "profile";
  }
  if (/\/(videos|shorts|streams|live)(\/|$)/.test(p)) return "profile";

  if (u.hostname.includes("youtu.be")) return "single";
  if (p.startsWith("/watch") && u.searchParams.get("v")) return "single";
  if (p.startsWith("/shorts/") && p.length > "/shorts/".length) return "single";

  return null;
}

export type UrlTabMode = "single" | "multi" | "playlist" | "profile";

/**
 * When the active tab does not match the YouTube URL shape, return a short message for a toast.
 * Non-YouTube links return null (any tab may apply).
 */
export function previewModeMismatchMessage(mode: UrlTabMode, url: string): string | null {
  if (mode === "multi") return null;
  const t = url.trim();
  if (!t || !looksLikeHttpUrl(t)) return null;
  const kind = youtubeUrlKind(t);
  if (!kind) return null;

  if (kind === "playlist" && mode === "playlist") return null;
  if (kind === "profile" && mode === "profile") return null;
  if (kind === "single" && mode === "single") return null;

  const tab: Record<YoutubeUrlKind, string> = {
    playlist: "Playlist",
    profile: "Profile",
    single: "Single",
  };
  return `This link fits the ${tab[kind]} tab better — switch tabs or change the URL.`;
}
