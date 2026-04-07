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
