import { ConvexHttpClient } from "convex/browser";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { isJwtAuthDisabled } from "@/lib/auth-mode";
import { AUTH_COOKIE, signSessionToken } from "@/lib/jwt";
import { sessionCookieOptions } from "@/lib/jwt-constants";
import { signPasswordSessionCookie } from "@/lib/password-session";

export const dynamic = "force-dynamic";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
    name?: string;
    companyId?: string;
  };

  if (
    !body.email?.trim() ||
    !body.password ||
    !body.name?.trim() ||
    !body.companyId
  ) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const convex = new ConvexHttpClient(convexUrl);

  try {
    await convex.action(api.auth.register, {
      email: body.email.trim(),
      password: body.password,
      name: body.name.trim(),
      companyId: body.companyId as Id<"companies">,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const user = await convex.action(api.auth.login, {
    email: body.email.trim(),
    password: body.password,
  });
  if (!user) {
    return NextResponse.json(
      { error: "Account created but login failed" },
      { status: 500 },
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

  const cookieOpts = sessionCookieOptions();

  if (isJwtAuthDisabled()) {
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
      await convex.mutation(api.users.recordLoginDev, { userId: user.userId });
    } catch {
      /* optional */
    }
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE, token, cookieOpts);
    return NextResponse.json(jsonBody);
  }

  let token: string;
  try {
    token = await signSessionToken({
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not create session (check JWT keys).";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, token, cookieOpts);
  return NextResponse.json(jsonBody);
}
