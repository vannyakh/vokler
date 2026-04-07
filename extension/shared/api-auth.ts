/**
 * Same header the web app sends (`web/lib/api.ts` → `X-App-Key`).
 * Optional build-time default: `VITE_FRONTEND_APP_KEY` in `extension/.env`.
 */
export function bundledFrontendAppKey(): string | undefined {
  const v = import.meta.env.VITE_FRONTEND_APP_KEY as string | undefined;
  if (v && typeof v === "string" && v.trim()) return v.trim();
  return undefined;
}

/** Prefer explicit storage value; fall back to value baked in at build time. */
export function mergeFrontendAppKey(stored: string | undefined): string | undefined {
  const t = stored?.trim();
  if (t) return t;
  return bundledFrontendAppKey();
}

export function headersJsonWithAppKey(appKey: string | undefined): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const k = appKey?.trim();
  if (k) h["X-App-Key"] = k;
  return h;
}

export function headersWithAppKey(appKey: string | undefined): Record<string, string> {
  const k = appKey?.trim();
  if (!k) return {};
  return { "X-App-Key": k };
}
