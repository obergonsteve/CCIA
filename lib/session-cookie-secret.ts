/**
 * HMAC secret for the httpOnly auth cookie (same value for signing and verifying).
 * Prefer SESSION_COOKIE_SECRET; JWT_SECRET still works for existing .env files.
 */
export function sessionCookieSigningSecret(): string | null {
  const s =
    process.env.SESSION_COOKIE_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    "";
  if (!s || s.includes("replace_with")) {
    return null;
  }
  return s;
}
