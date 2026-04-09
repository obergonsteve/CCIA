import { NextResponse } from "next/server";

/** No Convex browser JWT in default auth mode. */
export async function GET() {
  return NextResponse.json({ token: null });
}
