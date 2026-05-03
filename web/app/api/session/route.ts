import { type NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { serverFrontendAppKey, serverUpstreamApiBase } from "@/lib/server-api-base";

export const dynamic = "force-dynamic";

/** Sanity check in the browser: if this 404s, the dev server is not this app or needs a restart. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "POST here with an active NextAuth session cookie to sync API JWTs.",
  });
}

/**
 * Provisions FastAPI JWTs after OAuth (NextAuth session email → `/auth/oauth-sync`).
 * Uses `/api/session` (not under `/api/auth/*`) so it never conflicts with Auth.js routes.
 */
export async function POST(_request: NextRequest) {
  const syncSecret = process.env.OAUTH_SYNC_SECRET?.trim();
  if (!syncSecret) {
    return NextResponse.json(
      { detail: "OAUTH_SYNC_SECRET is not set on the web server." },
      { status: 503 },
    );
  }

  const session = await auth();
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
