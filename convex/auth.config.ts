import type { AuthConfig } from "convex/server";

const JWKS_DATA_URI =
  "data:text/plain;charset=utf-8;base64,eyJrZXlzIjpbeyJrdHkiOiJSU0EiLCJuIjoieTdLeUdoQ3M1TEdfdDhFaVFNS05ocVFMX3NQYkhtemRwUWh6RDR3Z2tXTGoxcW5LZkExcE0ydVB6U1p5N3N0c2tWNVgxQmUwOVhETFpKd2w3VlY5MklFNENrbVFncTlOdVk3NXk4bVk5N0l0cGFSZ2VROGJjbnJpWmlqS29jbHhVWkJxdXRkeVZrTVc3NWhMV3cwdG5YUnBZMWJBTkY0aTB0V2RrTy1hMG5PakhqU3hGaUhVYTl4YXdIMFZiMDNfV3BjRnRaUVBUbTBoUEtLbHpKVWtmYXV6dHk4eFNiUVdNOHltQWxLNHMxaG9sRk9CNWNIZDBOYW9Rc1hqQzRsOWlkR3FoYlExdEZQQ3dQcEt5TTN6clFGTXVXRWUzMTY5X3VaRWhkUHR0SG1wbnluMzU0N09UZGt3QmhINlQ1RkxSbklBY1NWYmlRVi1rTWtSZHVXN0NRIiwiZSI6IkFRQUIiLCJ1c2UiOiJzaWciLCJhbGciOiJSUzI1NiIsImtpZCI6ImNjaWEtbGFuZGxlYXNlLTEifV19";

/**
 * JWT `iss` claim from Next.js session tokens — must match `JWT_ISSUER` / `NEXT_PUBLIC_APP_URL` there.
 * Avoid `process.env.JWT_ISSUER` here: Convex requires that var on the deployment whenever it appears in this file,
 * even when `DISABLE_JWT_AUTH=true`. Change this string if your app URL differs (e.g. production).
 */
/** Must match `NEXT_PUBLIC_APP_URL` / signed JWT `iss` from Next (local dev defaults to localhost). */
const ISSUER = "http://localhost:3000";

/**
 * Always register the JWT provider. Convex rejects `auth.config.ts` if it references env vars
 * that are not set on the deployment (including `DISABLE_JWT_AUTH`).
 * Password-only mode (Next `DISABLE_JWT_AUTH`) sends no Convex token; `convex/lib/auth.ts` then
 * uses `CONVEX_DEV_USER_ID` when that flag is set on the deployment.
 */
export default {
  providers: [
    {
      type: "customJwt" as const,
      applicationID: "convex",
      issuer: ISSUER,
      jwks: JWKS_DATA_URI,
      algorithm: "RS256" as const,
    },
  ],
} satisfies AuthConfig;
