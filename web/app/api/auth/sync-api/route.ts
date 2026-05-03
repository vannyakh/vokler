import { type NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { serverFrontendAppKey, serverUpstreamApiBase } from "@/lib/server-api-base";

/**
 * After Better Auth OAuth, provisions the FastAPI `users` row (if needed) and returns JWTs.
 * Requires OAUTH_SYNC_SECRET on web and api (same value). Not exposed to the browser.
 */
export async function POST(request: NextRequest) {
  const syncSecret = process.env.OAUTH_SYNC_SECRET?.trim();
  if (!syncSecret) {
    return NextResponse.json(
      { detail: "OAUTH_SYNC_SECRET is not set on the web server." },
      { status: 503 },
    );
  }

  const session = await auth.api.getSession({ headers: request.headers });
  const email = session?.user?.email?.trim();
  if (!email) {
    return NextResponse.json({ detail: "Not signed in" }, { status: 401 });
  }

  const upstream = serverUpstreamApiBase();
  if (!upstream) {
    return NextResponse.json(
      { detail: "Upstream API URL is not configured on the web server." },
      { status: 503 },
    );
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("X-OAuth-Sync-Secret", syncSecret);
  const appKey = serverFrontendAppKey();
  if (appKey) {
    headers.set("X-App-Key", appKey);
  }

  const res = await fetch(`${upstream.replace(/\/$/, "")}/auth/oauth-sync`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email }),
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}
