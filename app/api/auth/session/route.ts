import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isJwtAuthDisabled } from "@/lib/auth-mode";
import { AUTH_COOKIE, verifySessionToken } from "@/lib/jwt";
import { verifyPasswordSessionCookie } from "@/lib/password-session";

export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(AUTH_COOKIE)?.value;
  if (!raw) {
    return NextResponse.json({ user: null });
  }
  if (isJwtAuthDisabled()) {
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
      },
    });
  }
  try {
    const payload = await verifySessionToken(raw);
    return NextResponse.json({
      user: {
        userId: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        companyId: payload.companyId,
      },
    });
  } catch {
    return NextResponse.json({ user: null });
  }
}
