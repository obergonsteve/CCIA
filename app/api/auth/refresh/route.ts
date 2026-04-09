import { ConvexHttpClient } from "convex/browser";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { AUTH_COOKIE, sessionCookieOptions } from "@/lib/auth-cookie";
import {
  signPasswordSessionCookie,
  verifyPasswordSessionCookie,
} from "@/lib/password-session";

export const dynamic = "force-dynamic";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;

export async function POST() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(AUTH_COOKIE)?.value;
  if (!raw) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieOpts = sessionCookieOptions();

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

  let nextTok: string;
  try {
    nextTok = signPasswordSessionCookie({
      userId: session.userId,
      email: session.email,
      name: session.name,
      role: session.role,
      companyId: session.companyId,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not refresh session cookie.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
  cookieStore.set(AUTH_COOKIE, nextTok, cookieOpts);
  return NextResponse.json({ ok: true });
}
