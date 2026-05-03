/** Railway / dashboard paste sometimes includes wrapping quotes — strip them. */
export function stripCopyPasteQuotes(s: string): string {
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

/**
 * RAILWAY_PUBLIC_DOMAIN is hostname-only; fetch() needs a full origin.
 * Also accept values pasted with accidental quotes.
 */
export function normalizeUpstreamUrl(raw: string): string | null {
  let u = stripCopyPasteQuotes(raw);
  if (!u) return null;
  u = u.replace(/\/$/, "");
  if (!/^https?:\/\//i.test(u)) {
    u = `https://${u}`;
  }
  try {
    new URL(u);
  } catch {
    return null;
  }
  return u;
}

/** Server-side upstream only — no hardcoded default. */
export function serverUpstreamApiBase(): string | null {
  for (const v of [
    process.env.API_URL,
    process.env.FASTAPI_URL,
    process.env.NEXT_PUBLIC_API_URL,
  ]) {
    if (!v?.trim()) continue;
    const n = normalizeUpstreamUrl(v);
    if (n) return n;
  }
  return null;
}

/** Match FastAPI aliases: FRONTEND_APP_KEY / APP_FRONTEND_KEY; then public client var. */
export function serverFrontendAppKey(): string {
  return (
    process.env.FRONTEND_APP_KEY?.trim() ||
    process.env.APP_FRONTEND_KEY?.trim() ||
    process.env.NEXT_PUBLIC_FRONTEND_APP_KEY?.trim() ||
    ""
  );
}
