import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isJwtAuthDisabled } from "@/lib/auth-mode";
import { AUTH_COOKIE } from "@/lib/jwt-constants";

export async function GET() {
  if (isJwtAuthDisabled()) {
    return NextResponse.json({ token: null });
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ token: null }, { status: 401 });
  }
  return NextResponse.json({ token });
}
