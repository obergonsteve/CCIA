import type { JWTPayload } from "jose";
import { importSPKI } from "jose";
import { jwtVerify } from "jose";
import { resolveJwtPublicKeyPem } from "./jwt-public-embedded";
import { JWT_AUDIENCE, JWT_ISSUER } from "./jwt-constants";

let keyPromise: ReturnType<typeof importSPKI> | null = null;

async function getKey() {
  if (!keyPromise) {
    keyPromise = importSPKI(resolveJwtPublicKeyPem(), "RS256");
  }
  return keyPromise;
}

export type EdgeSession = JWTPayload & {
  sub: string;
  role?: string;
  companyId?: string;
};

export async function verifyAuthCookieToken(token: string) {
  const key = await getKey();
  const { payload } = await jwtVerify(token, key, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
  return payload as EdgeSession;
}
