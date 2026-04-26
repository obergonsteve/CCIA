import { NextResponse } from "next/server";
import { z } from "zod";
import { authModeCookieOptions } from "@/lib/auth-mode";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  authMode: z.enum(["legacy", "convex"]),
});

/**
 * Best-effort mode cookie sync for login flows so proxy/layout select
 * the same auth stack on subsequent requests.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true as const });
  res.cookies.set("cciaAuthMode", parsed.data.authMode, authModeCookieOptions);
  return res;
}
