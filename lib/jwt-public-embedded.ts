/**
 * Public key matching `keys/jwt-private.pem` (dev). For production, set JWT_PUBLIC_KEY in Vercel
 * and replace this file’s export via build step, or regenerate keys and JWKS in `convex/auth.config.ts`.
 */
export const JWT_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAy7KyGhCs5LG/t8EiQMKN
hqQL/sPbHmzdpQhzD4wgkWLj1qnKfA1pM2uPzSZy7stskV5X1Be09XDLZJwl7VV9
2IE4CkmQgq9NuY75y8mY97ItpaRgeQ8bcnriZijKoclxUZBqutdyVkMW75hLWw0t
nXRpY1bANF4i0tWdkO+a0nOjHjSxFiHUa9xawH0Vb03/WpcFtZQPTm0hPKKlzJUk
fauzty8xSbQWM8ymAlK4s1holFOB5cHd0NaoQsXjC4l9idGqhbQ1tFPCwPpKyM3z
rQFMuWEe3169/uZEhdPttHmpnyn3547OTdkwBhH6T5FLRnIAcSVbiQV+kMkRduW7
CQIDAQAB
-----END PUBLIC KEY-----
`;

/** Empty `JWT_PUBLIC_KEY=` in `.env` must not win over the embedded dev key (`??` only skips null/undefined). */
export function resolveJwtPublicKeyPem(): string {
  const fromEnv = process.env.JWT_PUBLIC_KEY?.replace(/\\n/g, "\n")?.trim();
  if (fromEnv) return fromEnv;
  return JWT_PUBLIC_KEY_PEM;
}
