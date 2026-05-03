import { type NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const jwtSecret = new TextEncoder().encode(
  process.env.JWT_SECRET_KEY ?? "change-me-in-production",
);

export async function proxy(request: NextRequest) {
  const token = request.cookies.get("vokler_token")?.value;

  if (!token) {
    const url = new URL("/auth/sign-in", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  try {
    await jwtVerify(token, jwtSecret);
    return NextResponse.next();
  } catch {
    const url = new URL("/auth/sign-in", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    const response = NextResponse.redirect(url);
    response.cookies.delete("vokler_token");
    return response;
  }
}

export const config = {
  matcher: ["/home", "/profile"],
};
