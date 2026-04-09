/**
 * §4 — helpers to read the httpOnly `auth` cookie from a Cookie header (e.g. Convex HTTP actions).
 */
export function parseAuthCookieFromHeader(
  cookieHeader: string | null,
): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "auth" && rest.length) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return undefined;
}
