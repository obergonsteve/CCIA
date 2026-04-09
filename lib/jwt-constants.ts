/** §4 — httpOnly session cookie name. */
export const AUTH_COOKIE = "auth";

function firstNonEmpty(...candidates: (string | undefined)[]): string {
  for (const c of candidates) {
    const t = c?.trim();
    if (t) return t;
  }
  return "http://localhost:3000";
}

/**
 * Must match on Edge (proxy) and Node (login/sign). Prefer `NEXT_PUBLIC_APP_URL` first so
 * the issuer matches the host users open in the browser (e.g. localhost vs 127.0.0.1).
 */
export const JWT_ISSUER = firstNonEmpty(
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.JWT_ISSUER,
);

export const JWT_AUDIENCE = "convex";

/** Applied to `Set-Cookie` on `NextResponse` (more reliable than `cookies().set` + `json()` in Route Handlers). */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 8,
  };
}
