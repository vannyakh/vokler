/**
 * Canonical site origin for metadata (Open Graph, sitemap, JSON-LD).
 * Set `NEXT_PUBLIC_SITE_URL` in production (e.g. https://yourdomain.com).
 */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;

  return "http://localhost:3000";
}
