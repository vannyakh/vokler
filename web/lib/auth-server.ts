import { serverFrontendAppKey, serverUpstreamApiBase } from "@/lib/server-api-base";

/** Validates email/password against FastAPI; used by NextAuth Credentials (server-only). */
export async function authServerValidateCredentials(
  email: string,
  password: string,
): Promise<{ id: string; email: string } | null> {
  const base = serverUpstreamApiBase();
  if (!base) return null;
  const appKey = serverFrontendAppKey();
  const headers = new Headers({ "Content-Type": "application/json" });
  if (appKey) headers.set("X-App-Key", appKey);

  const loginRes = await fetch(`${base.replace(/\/$/, "")}/auth/login`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password }),
  });
  if (!loginRes.ok) return null;

  const { access_token: accessToken } = (await loginRes.json()) as { access_token: string };
  const h2 = new Headers();
  if (appKey) h2.set("X-App-Key", appKey);
  h2.set("Authorization", `Bearer ${accessToken}`);
  const meRes = await fetch(`${base.replace(/\/$/, "")}/auth/me`, { headers: h2 });
  if (!meRes.ok) return null;
  const user = (await meRes.json()) as { id: string; email: string };
  return user;
}
