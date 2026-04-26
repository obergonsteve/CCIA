"use client";

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

/**
 * Email/password sign-in via Convex Auth (`POST /api/auth` → `auth:signIn`), then `users.recordLogin`.
 * Only valid when the app is in Convex Auth mode (see [lib/auth-mode.ts]).
 */
export async function signInWithConvexPassword(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      action: "auth:signIn",
      args: {
        provider: "password",
        params: {
          email: email.trim().toLowerCase(),
          password,
        },
      },
    }),
  });
  let data: { error?: string; tokens?: { token: string; refreshToken?: string } | null };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return { ok: false, error: "Invalid response from /api/auth" };
  }
  if (!res.ok) {
    return { ok: false, error: data.error ?? `HTTP ${res.status}` };
  }
  if (data.error) {
    return { ok: false, error: data.error };
  }
  try {
    await fetch("/api/auth/mode-cookie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ authMode: "convex" }),
    });
  } catch {
    /* best-effort cookie sync for proxy/layout mode selection */
  }
  if (data.tokens?.token) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
    if (url) {
      const c = new ConvexHttpClient(url);
      c.setAuth(data.tokens.token);
      try {
        await c.mutation(api.users.recordLogin, {});
      } catch {
        /* optional */
      }
    }
  }
  return { ok: true };
}
