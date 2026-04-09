import { ConvexHttpClient } from "convex/browser";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { isJwtAuthDisabled } from "@/lib/auth-mode";
import { AUTH_COOKIE } from "@/lib/jwt";
import { sessionCookieOptions } from "@/lib/jwt-constants";

export const dynamic = "force-dynamic";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (token && convexUrl) {
    try {
      const convex = new ConvexHttpClient(convexUrl);
      if (!isJwtAuthDisabled()) {
        convex.setAuth(token);
      }
      await convex.mutation(api.authMutations.logout, {});
    } catch {
      /* still clear cookie */
    }
  }

  const clearOpts = { ...sessionCookieOptions(), maxAge: 0 };
  cookieStore.set(AUTH_COOKIE, "", clearOpts);
  return NextResponse.json({ ok: true });
}
