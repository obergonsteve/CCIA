/** Edge-safe verify for HMAC session cookies (matches `lib/password-session.ts` signing). */

import { sessionCookieSigningSecret } from "./session-cookie-secret";

export type PasswordSessionPayload = {
  userId: string;
  email: string;
  name: string;
  role: string;
  companyId: string;
  exp: number;
  /** When true, refresh/login should keep long-lived session. Omitted on older cookies. */
  rememberMe?: boolean;
};

function base64UrlToBytes(input: string): Uint8Array {
  const pad = (4 - (input.length % 4)) % 4;
  const b64 = (input + "=".repeat(pad)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]!);
  }
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) {
    x |= a.charCodeAt(i)! ^ b.charCodeAt(i)!;
  }
  return x === 0;
}

export async function verifyPasswordSessionCookieEdge(
  raw: string,
): Promise<PasswordSessionPayload | null> {
  const secret = sessionCookieSigningSecret();
  if (!secret) {
    return null;
  }
  const i = raw.lastIndexOf(".");
  if (i === -1) return null;
  const b64 = raw.slice(0, i);
  const sig = raw.slice(i + 1);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(b64),
  );
  const expected = bytesToBase64Url(mac);
  if (!timingSafeEqualStr(sig, expected)) {
    return null;
  }
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(b64));
    const body = JSON.parse(json) as PasswordSessionPayload;
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
