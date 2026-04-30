import { type NextRequest, NextResponse } from "next/server";

/** Server-side upstream only — no hardcoded default. */
function upstreamBase(): string | null {
  const raw =
    process.env.API_URL?.trim() ??
    process.env.FASTAPI_URL?.trim() ??
    process.env.NEXT_PUBLIC_API_URL?.trim() ??
    "";
  if (!raw) return null;
  return raw.replace(/\/$/, "");
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

  // Server-only key first; fall back to the public var used by the browser bundle.
  const upstreamAppKey =
    process.env.FRONTEND_APP_KEY ??
    process.env.NEXT_PUBLIC_FRONTEND_APP_KEY;
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
