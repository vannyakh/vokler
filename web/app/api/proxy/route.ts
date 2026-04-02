import { type NextRequest, NextResponse } from "next/server";

const UPSTREAM = (
  process.env.API_URL ??
  process.env.FASTAPI_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

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
  const forward = request.nextUrl.searchParams.get("forward");
  if (!forward || !forward.startsWith("/")) {
    return NextResponse.json(
      { detail: 'Query "forward" is required and must start with / (e.g. /history).' },
      { status: 400 },
    );
  }

  const target = new URL(UPSTREAM + forward);
  stripForwardedSearch(request.nextUrl, target);

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    headers.set(key, value);
  });

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
