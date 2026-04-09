import { createHmac, timingSafeEqual } from "crypto";
import type { PasswordSessionPayload } from "./password-session-edge";

export type { PasswordSessionPayload };

function sessionSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s?.trim() || s.includes("replace_with")) {
    throw new Error(
      "JWT_SECRET is required to sign the session cookie (HMAC, not RS256 JWT).",
    );
  }
  return s;
}

/** Signed cookie payload (HMAC); not an RS256 JWT. */
export function signPasswordSessionCookie(
  payload: Omit<PasswordSessionPayload, "exp">,
): string {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 8;
  const body: PasswordSessionPayload = { ...payload, exp };
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
