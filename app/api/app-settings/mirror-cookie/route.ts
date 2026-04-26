import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { AUTH_COOKIE } from "@/lib/auth-cookie";
import { authModeCookieOptions } from "@/lib/auth-mode";
import { verifyPasswordSessionCookie } from "@/lib/password-session";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  authMode: z.enum(["legacy", "convex"]),
});

/**
 * After `appSettings.setAuthMode` in Convex, call this to mirror `authMode` to an
 * httpOnly cookie so [middleware.ts] and [app/layout] can read mode without a Convex round-trip.
 */
export async function POST(request: Request) {
  let body: { authMode: string };
  try {
    body = (await request.json()) as { authMode: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const mode = parsed.data.authMode;

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!convexUrl) {
    return NextResponse.json(
      { error: "Missing NEXT_PUBLIC_CONVEX_URL" },
      { status: 503 },
    );
  }

  const token = await convexAuthNextjsToken();
  if (token) {
    const client = new ConvexHttpClient(convexUrl);
    client.setAuth(token);
    const me = await client.query(api.users.me, {});
    if (
      !me ||
      (me.role !== "admin" && me.role !== "content_creator")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    const cookieStore = await cookies();
    const raw = cookieStore.get(AUTH_COOKIE)?.value;
    if (!raw) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const session = verifyPasswordSessionCookie(raw);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "admin" && session.role !== "content_creator") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const res = NextResponse.json({ ok: true as const });
  res.cookies.set("cciaAuthMode", mode, authModeCookieOptions);
  return res;
}
