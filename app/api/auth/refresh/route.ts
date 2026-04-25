import { ConvexHttpClient } from "convex/browser";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { AUTH_COOKIE, sessionCookieOptions } from "@/lib/auth-cookie";
import { convexCloudUrlMisconfigurationMessage } from "@/lib/convex-deployment-url";
import {
  signPasswordSessionCookie,
  verifyPasswordSessionCookie,
} from "@/lib/password-session";

export const dynamic = "force-dynamic";

export async function POST() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(AUTH_COOKIE)?.value;
  if (!raw) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = verifyPasswordSessionCookie(raw);
  if (!session) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const rememberMe = session.rememberMe === true;
  const cookieOpts = sessionCookieOptions({ rememberMe });

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!convexUrl) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_CONVEX_URL" },
      { status: 503 },
    );
  }

  const urlMisconfig = convexCloudUrlMisconfigurationMessage(convexUrl);
  if (urlMisconfig) {
    return NextResponse.json({ error: urlMisconfig }, { status: 503 });
  }

  const convex = new ConvexHttpClient(convexUrl);
  try {
    await convex.mutation(api.users.recordLoginDev, {
      userId: session.userId as Id<"users">,
    });
  } catch {
    /* optional */
  }

  let companyTimezone: string | undefined = session.companyTimezone;
  try {
    const tz = await convex.query(api.companies.getTimezone, {
      companyId: session.companyId as Id<"companies">,
    });
    if (tz) {
      companyTimezone = tz;
    } else {
      companyTimezone = undefined;
    }
  } catch {
    /* keep previous session value */
  }

  let nextTok: string;
  try {
    nextTok = signPasswordSessionCookie(
      {
        userId: session.userId,
        email: session.email,
        name: session.name,
        role: session.role,
        companyId: session.companyId,
        companyTimezone,
      },
      { rememberMe },
    );
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not refresh session cookie.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
  cookieStore.set(AUTH_COOKIE, nextTok, cookieOpts);
  return NextResponse.json({ ok: true });
}
