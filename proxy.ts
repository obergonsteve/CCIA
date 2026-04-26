import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth-cookie";
import { getEffectiveAuthModeForEdge } from "@/lib/auth-mode";
import { verifyPasswordSessionCookieEdge } from "@/lib/password-session-edge";

const protectedPrefixes = [
  "/dashboard",
  "/certifications",
  "/units",
  "/admin",
  "/workshop-sim",
];

const isPublicConvex = createRouteMatcher([
  "/",
  "/login(.*)",
  "/register(.*)",
  /** Legacy session routes + Convex `POST` exact `/api/auth` handled first inside the Convex helper */
  "/api/auth/(.*)",
  "/favicon.ico",
  "/sw.js",
  "/workbox-(.*)\\.js",
  "/icons/(.*)",
]);

const convex = convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    if (isPublicConvex(request)) {
      return NextResponse.next();
    }
    if (!(await convexAuth.isAuthenticated())) {
      return nextjsMiddlewareRedirect(request, "/login");
    }
    return NextResponse.next();
  },
);

const noopEvent = {
  waitUntil: () => {
    return;
  },
} as unknown as NextFetchEvent;

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * App Router 16+ uses `proxy.ts` (replaces `middleware.ts`). For Convex Auth mode, run
 * the `@convex-dev/auth/nextjs` middleware. For legacy mode, enforce the httpOnly
 * session cookie (same as before this change).
 */
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/auth") {
    return convex(request, noopEvent);
  }
  const mode = getEffectiveAuthModeForEdge({
    getCookie: (n) => request.cookies.get(n)?.value,
  });
  if (mode === "convex") {
    return convex(request, noopEvent);
  }

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
    "/((?!_next/static|_next/image|_next/data|favicon\\.ico|.*\\.(?:ico|png|svg|jpe?g|gif|webp|map|js|webmanifest|woff2?|ttf|eot|css|json|pdf|txt|svg)$).*)",
  ],
};