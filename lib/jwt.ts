import { createPrivateKey, type KeyObject } from "crypto";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { importSPKI, jwtVerify, SignJWT, type JWTPayload } from "jose";
import { resolveJwtPublicKeyPem } from "./jwt-public-embedded";
import { JWT_AUDIENCE, JWT_ISSUER } from "./jwt-constants";

export { AUTH_COOKIE, JWT_AUDIENCE, JWT_ISSUER } from "./jwt-constants";

export type SessionPayload = JWTPayload & {
  sub: string;
  email?: string;
  name?: string;
  role?: string;
  companyId?: string;
};

function loadPrivateKeyPem(): string {
  const fromEnv = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (fromEnv) {
    return fromEnv;
  }
  const path = join(process.cwd(), "keys/jwt-private.pem");
  if (existsSync(path)) {
    return readFileSync(path, "utf8");
  }
  throw new Error(
    "Set JWT_PRIVATE_KEY or add keys/jwt-private.pem (generate locally; never commit the private key).",
  );
}

let privateKeyObject: KeyObject | null = null;

/** Node `createPrivateKey` accepts PKCS#8 and legacy PKCS#1 (`BEGIN RSA PRIVATE KEY`) PEM. */
export function getPrivateKey(): KeyObject {
  if (!privateKeyObject) {
    privateKeyObject = createPrivateKey(loadPrivateKeyPem());
  }
  return privateKeyObject;
}

export async function getPublicKey() {
  return importSPKI(resolveJwtPublicKeyPem(), "RS256");
}

export async function signSessionToken(claims: {
  userId: string;
  email: string;
  name: string;
  role: string;
  companyId: string;
}) {
  const key = getPrivateKey();
  return await new SignJWT({
    email: claims.email,
    name: claims.name,
    role: claims.role,
    companyId: claims.companyId,
  })
    .setProtectedHeader({ alg: "RS256", kid: "ccia-landlease-1" })
    .setSubject(claims.userId)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(key);
}

export async function verifySessionToken(token: string) {
  const key = await getPublicKey();
  const { payload } = await jwtVerify(token, key, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
  return payload as SessionPayload;
}
