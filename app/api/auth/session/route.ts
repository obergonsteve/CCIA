import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth-cookie";
import { verifyPasswordSessionCookie } from "@/lib/password-session";

export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(AUTH_COOKIE)?.value;
  if (!raw) {
    return NextResponse.json({ user: null });
  }

  const payload = verifyPasswordSessionCookie(raw);
  if (!payload) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      companyId: payload.companyId,
      companyTimezone: payload.companyTimezone,
    },
  });
}
