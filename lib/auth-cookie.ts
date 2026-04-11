/** §4 — httpOnly session cookie name. */
export const AUTH_COOKIE = "auth";

/** Default signed-in session length (browser closed / cookie cleared ends session sooner). */
export const AUTH_SESSION_MAX_AGE_SEC = 60 * 60 * 8;

/** “Remember me” — longer cookie + matching JWT `exp` in `signPasswordSessionCookie`. */
export const AUTH_REMEMBER_MAX_AGE_SEC = 60 * 60 * 24 * 30;

/** Applied to `Set-Cookie` on `NextResponse` (more reliable than `cookies().set` + `json()` in Route Handlers). */
export function sessionCookieOptions(opts?: { rememberMe?: boolean }) {
  const maxAge = opts?.rememberMe
    ? AUTH_REMEMBER_MAX_AGE_SEC
    : AUTH_SESSION_MAX_AGE_SEC;
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
