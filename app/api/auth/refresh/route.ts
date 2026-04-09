import { ConvexHttpClient } from "convex/browser";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { isJwtAuthDisabled } from "@/lib/auth-mode";
import { AUTH_COOKIE, signSessionToken, verifySessionToken } from "@/lib/jwt";
import { sessionCookieOptions } from "@/lib/jwt-constants";
import {
  signPasswordSessionCookie,
  verifyPasswordSessionCookie,
} from "@/lib/password-session";

export const dynamic = "force-dynamic";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;

/** §4 — refresh session: re-validate with Convex then re-issue JWT (or HMAC cookie if DISABLE_JWT_AUTH). */
export async function POST() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(AUTH_COOKIE)?.value;
  if (!raw) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieOpts = sessionCookieOptions();

  if (isJwtAuthDisabled()) {
    const session = verifyPasswordSessionCookie(raw);
    if (!session) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    const convex = new ConvexHttpClient(convexUrl);
    try {
      await convex.mutation(api.users.recordLoginDev, {
        userId: session.userId as Id<"users">,
      });
    } catch {
      /* optional */
    }
    const nextTok = signPasswordSessionCookie({
      userId: session.userId,
      email: session.email,
      name: session.name,
      role: session.role,
      companyId: session.companyId,
    });
    cookieStore.set(AUTH_COOKIE, nextTok, cookieOpts);
    return NextResponse.json({ ok: true });
  }

  let payload: Awaited<ReturnType<typeof verifySessionToken>>;
  try {
    payload = await verifySessionToken(raw);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const sub = payload.sub;
  if (
    !sub ||
    !payload.email ||
    !payload.name ||
    !payload.role ||
    !payload.companyId
  ) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(raw);
  try {
    await convex.mutation(api.authMutations.refresh, {});
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let token: string;
  try {
    token = await signSessionToken({
      userId: sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      companyId: payload.companyId,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not refresh session (check JWT keys).";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  cookieStore.set(AUTH_COOKIE, token, cookieOpts);
  return NextResponse.json({ ok: true });
}
