/** Reject open redirects: only same-origin relative paths. */
export function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/home";
  return raw;
}

/** Post-OAuth landing page: provisions FastAPI JWTs then client redirects to `next`. */
export function buildOAuthCallbackURL(nextPathOrUrl: string): string {
  const origin = window.location.origin;
  const next = safeNextPath(nextPathOrUrl.startsWith("/") ? nextPathOrUrl : "/home");
  return `${origin}/auth/callback?${new URLSearchParams({ next }).toString()}`;
}
