import { createHmac, timingSafeEqual } from "crypto";
import {
  AUTH_REMEMBER_MAX_AGE_SEC,
  AUTH_SESSION_MAX_AGE_SEC,
} from "./auth-cookie";
import type { PasswordSessionPayload } from "./password-session-edge";
import { sessionCookieSigningSecret } from "./session-cookie-secret";

export type { PasswordSessionPayload };

function sessionSecret(): string {
  const s = sessionCookieSigningSecret();
  if (!s) {
    throw new Error(
      "Missing session signing secret: set SESSION_COOKIE_SECRET or JWT_SECRET in .env.local, then restart `npm run dev`.",
    );
  }
  return s;
}

/** Signed cookie: base64url JSON payload + HMAC-SHA256. */
export function signPasswordSessionCookie(
  payload: Omit<PasswordSessionPayload, "exp" | "rememberMe">,
  opts?: { rememberMe?: boolean },
): string {
  const rememberMe = Boolean(opts?.rememberMe);
  const ttl = rememberMe ? AUTH_REMEMBER_MAX_AGE_SEC : AUTH_SESSION_MAX_AGE_SEC;
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const body: PasswordSessionPayload = { ...payload, exp, rememberMe };
  const b64 = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  const sig = createHmac("sha256", sessionSecret())
    .update(b64)
    .digest("base64url");
  return `${b64}.${sig}`;
}

export function verifyPasswordSessionCookie(
  raw: string,
): PasswordSessionPayload | null {
  const i = raw.lastIndexOf(".");
  if (i === -1) return null;
  const b64 = raw.slice(0, i);
  const sig = raw.slice(i + 1);
  const expected = createHmac("sha256", sessionSecret())
    .update(b64)
    .digest("base64url");
  const sigBuf = Buffer.from(sig, "utf8");
  const expBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const body = JSON.parse(
      Buffer.from(b64, "base64url").toString("utf8"),
    ) as PasswordSessionPayload;
    if (body.exp < Math.floor(Date.now() / 1000)) return null;
    if (
      !body.userId ||
      !body.email ||
      !body.name ||
      !body.role ||
      !body.companyId
    ) {
      return null;
    }
    return body;
  } catch {
    return null;
  }
}
