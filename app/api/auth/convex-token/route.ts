import { NextResponse } from "next/server";

/** Convex React client: no JWT; session is the httpOnly cookie (see `convex/lib/auth.ts`). */
export async function GET() {
  return NextResponse.json({ token: null });
}
