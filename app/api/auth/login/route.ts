import { ConvexHttpClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { AUTH_COOKIE, sessionCookieOptions } from "@/lib/jwt-constants";
import { signPasswordSessionCookie } from "@/lib/password-session";
import type { Id } from "@/convex/_generated/dataModel";

export const dynamic = "force-dynamic";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  if (!body.email?.trim() || !body.password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  const convex = new ConvexHttpClient(convexUrl);
  let user: FunctionReturnType<typeof api.auth.login>;
  try {
    user = await convex.action(api.auth.login, {
      email: body.email.trim().toLowerCase(),
      password: body.password,
    });
  } catch (e) {
    const hint =
      "Convex returned an error (often: missing latest deploy — run `npx convex deploy`, or check Dashboard → Logs).";
    const message =
      e instanceof Error && e.message && e.message !== "Server Error"
        ? `${e.message}. ${hint}`
        : hint;
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!user) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 },
    );
  }

  const jsonBody = {
    ok: true as const,
    user: {
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    },
  };

  const devOnly = process.env.DEV_AUTH_USER_ID;
  if (devOnly && user.userId !== devOnly) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const token = signPasswordSessionCookie({
    userId: user.userId,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
  });

  try {
    await convex.mutation(api.users.recordLoginDev, {
      userId: user.userId as Id<"users">,
    });
  } catch {
    /* optional */
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, token, sessionCookieOptions());
  return NextResponse.json(jsonBody);
}
