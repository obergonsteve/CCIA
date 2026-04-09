import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE, sessionCookieOptions } from "@/lib/jwt-constants";

export async function POST() {
  const cookieStore = await cookies();
  const clearOpts = { ...sessionCookieOptions(), maxAge: 0 };
  cookieStore.set(AUTH_COOKIE, "", clearOpts);
  return NextResponse.json({ ok: true });
}
