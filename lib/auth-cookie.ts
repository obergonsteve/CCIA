/** §4 — httpOnly session cookie name. */
export const AUTH_COOKIE = "auth";

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
