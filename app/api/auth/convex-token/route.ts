import { NextResponse } from "next/server";

/** Convex client does not use a separate browser token; session is the httpOnly cookie. */
export async function GET() {
  return NextResponse.json({ token: null });
}
