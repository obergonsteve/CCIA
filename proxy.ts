import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { verifyPasswordSessionCookieEdge } from "@/lib/password-session-edge";
import { AUTH_COOKIE } from "@/lib/auth-cookie";

const protectedPrefixes = ["/dashboard", "/certifications", "/units", "/admin"];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const raw = request.cookies.get(AUTH_COOKIE)?.value;
  if (!raw) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  const session = await verifyPasswordSessionCookieEdge(raw);
  if (!session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (
    pathname.startsWith("/admin") &&
    session.role !== "admin" &&
    session.role !== "content_creator"
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/certifications/:path*",
    "/units/:path*",
    "/admin/:path*",
  ],
};
