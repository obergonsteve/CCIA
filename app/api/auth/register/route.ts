import { ConvexHttpClient } from "convex/browser";
import type { FunctionReturnType } from "convex/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { AUTH_COOKIE, sessionCookieOptions } from "@/lib/auth-cookie";
import { convexCloudUrlMisconfigurationMessage } from "@/lib/convex-deployment-url";
import { formatConvexHttpFailure } from "@/lib/convex-http-failure-format";
import { signPasswordSessionCookie } from "@/lib/password-session";

export const dynamic = "force-dynamic";

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

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!convexUrl) {
    return NextResponse.json(
      {
        error:
          "Missing NEXT_PUBLIC_CONVEX_URL. Set it in Vercel to your Convex production URL, then redeploy.",
      },
      { status: 503 },
    );
  }

  const urlMisconfig = convexCloudUrlMisconfigurationMessage(convexUrl);
  if (urlMisconfig) {
    return NextResponse.json({ error: urlMisconfig }, { status: 503 });
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
    return NextResponse.json(
      {
        error: formatConvexHttpFailure(e, {
          operation: "auth:register (Convex action)",
          convexUrl,
        }),
      },
      { status: 400 },
    );
  }

  let user: FunctionReturnType<typeof api.auth.login>;
  try {
    user = await convex.action(api.auth.login, {
      email: body.email.trim(),
      password: body.password,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: formatConvexHttpFailure(e, {
          operation: "auth:login after register (Convex action)",
          convexUrl,
        }),
      },
      { status: 502 },
    );
  }
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

  const devOnly = process.env.DEV_AUTH_USER_ID;
  if (devOnly && user.userId !== devOnly) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  let token: string;
  try {
    token = signPasswordSessionCookie({
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not create session cookie.";
    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }

  try {
    await convex.mutation(api.users.recordLoginDev, {
      userId: user.userId as Id<"users">,
    });
  } catch {
    /* optional */
  }

  try {
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE, token, sessionCookieOptions());
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not set session cookie.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json(jsonBody);
}
