/** True if a captured hit belongs to the same video/page as the current tab URL (SPA-safe). */
export function sameVideoPage(current: string, hitPage: string | undefined): boolean {
  if (!hitPage) return true;
  try {
    const c = new URL(current);
    const h = new URL(hitPage);
    const ch = c.hostname.replace(/^www\./, "");
    const hh = h.hostname.replace(/^www\./, "");
    if (ch !== hh) return false;

    if (ch.includes("youtube.com")) {
      const cv = c.searchParams.get("v");
      const hv = h.searchParams.get("v");
      if (cv != null && hv != null) return cv === hv;
      if (c.pathname.startsWith("/shorts/") && h.pathname.startsWith("/shorts/")) {
        return c.pathname.split("/")[2] === h.pathname.split("/")[2];
      }
      return c.pathname === h.pathname && c.search === h.search;
    }

    return c.origin + c.pathname + c.search === h.origin + h.pathname + h.search;
  } catch {
    return hitPage === current;
  }
}
