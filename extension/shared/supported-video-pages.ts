/**
 * Pages where Vokler should offer download — aligned with manifest content_scripts
 * and API platform support. Used to avoid UI on feeds, search, or unrelated paths.
 */
export function isVoklerSupportedVideoPage(href: string): boolean {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return false;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    return u.pathname.length > 1 && u.pathname !== "/";
  }

  if (host === "m.youtube.com" || host.endsWith("youtube.com")) {
    if (u.searchParams.has("v")) return u.searchParams.get("v")!.length > 0;
    if (u.pathname.startsWith("/shorts/")) {
      const parts = u.pathname.split("/").filter(Boolean);
      return parts.length >= 2 && parts[0] === "shorts";
    }
    return false;
  }

  if (host.endsWith("instagram.com")) {
    return /^\/(reel|p)\//.test(u.pathname);
  }

  if (host.endsWith("tiktok.com")) {
    return /\/video\/\d+/.test(u.pathname) || /^\/@[^/]+\/video\/\d+/.test(u.pathname);
  }

  if (host === "twitter.com" || host === "x.com") {
    return /\/status\/\d+/.test(u.pathname);
  }

  if (host.endsWith("facebook.com") || host === "fb.watch") {
    if (host === "fb.watch") return u.pathname.length > 1;
    return /\/videos\/|\/watch\//.test(u.pathname);
  }

  if (host.endsWith("vimeo.com")) {
    return /^\/\d+/.test(u.pathname);
  }

  return false;
}
