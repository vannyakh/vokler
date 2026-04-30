import { type NextRequest, NextResponse } from "next/server";

/** Railway / dashboard paste sometimes includes wrapping quotes — strip them. */
function stripCopyPasteQuotes(s: string): string {
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
function normalizeUpstreamUrl(raw: string): string | null {
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
function upstreamBase(): string | null {
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

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

function stripForwardedSearch(source: URL, target: URL) {
  source.searchParams.forEach((value, key) => {
    if (key !== "forward") target.searchParams.set(key, value);
  });
}

async function proxy(request: NextRequest, method: string) {
  const upstream = upstreamBase();
  if (!upstream) {
    return NextResponse.json(
      {
        detail:
          "Upstream API URL is not configured. Set API_URL, FASTAPI_URL, or NEXT_PUBLIC_API_URL on the server.",
      },
      { status: 503 },
    );
  }

  const forward = request.nextUrl.searchParams.get("forward");
  if (!forward || !forward.startsWith("/")) {
    return NextResponse.json(
      { detail: 'Query "forward" is required and must start with / (e.g. /preview).' },
      { status: 400 },
    );
  }

  const target = new URL(upstream + forward);
  stripForwardedSearch(request.nextUrl, target);

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    headers.set(key, value);
  });

  // Match FastAPI aliases: FRONTEND_APP_KEY / APP_FRONTEND_KEY; then public client var.
  const upstreamAppKey =
    process.env.FRONTEND_APP_KEY?.trim() ||
    process.env.APP_FRONTEND_KEY?.trim() ||
    process.env.NEXT_PUBLIC_FRONTEND_APP_KEY?.trim();
  if (upstreamAppKey) {
    headers.set("X-App-Key", upstreamAppKey);
  }

  const hasBody = !["GET", "HEAD"].includes(method);
  const body = hasBody ? await request.arrayBuffer() : undefined;

  const res = await fetch(target.toString(), {
    method,
    headers,
    body: body && body.byteLength > 0 ? body : undefined,
  });

  const out = new Headers();
  res.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    out.set(key, value);
  });

  return new NextResponse(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: out,
  });
}

export async function GET(request: NextRequest) {
  return proxy(request, "GET");
}

export async function POST(request: NextRequest) {
  return proxy(request, "POST");
}

export async function DELETE(request: NextRequest) {
  return proxy(request, "DELETE");
}

export async function PUT(request: NextRequest) {
  return proxy(request, "PUT");
}

export async function PATCH(request: NextRequest) {
  return proxy(request, "PATCH");
}
