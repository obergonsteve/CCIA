import type { AuthConfig } from "convex/server";

const JWKS_DATA_URI =
  "data:text/plain;charset=utf-8;base64,eyJrZXlzIjpbeyJrdHkiOiJSU0EiLCJuIjoieTdLeUdoQ3M1TEdfdDhFaVFNS05ocVFMX3NQYkhtemRwUWh6RDR3Z2tXTGoxcW5LZkExcE0ydVB6U1p5N3N0c2tWNVgxQmUwOVhETFpKd2w3VlY5MklFNENrbVFncTlOdVk3NXk4bVk5N0l0cGFSZ2VROGJjbnJpWmlqS29jbHhVWkJxdXRkeVZrTVc3NWhMV3cwdG5YUnBZMWJBTkY0aTB0V2RrTy1hMG5PakhqU3hGaUhVYTl4YXdIMFZiMDNfV3BjRnRaUVBUbTBoUEtLbHpKVWtmYXV6dHk4eFNiUVdNOHltQWxLNHMxaG9sRk9CNWNIZDBOYW9Rc1hqQzRsOWlkR3FoYlExdEZQQ3dQcEt5TTN6clFGTXVXRWUzMTY5X3VaRWhkUHR0SG1wbnluMzU0N09UZGt3QmhINlQ1RkxSbklBY1NWYmlRVi1rTWtSZHVXN0NRIiwiZSI6IkFRQUIiLCJ1c2UiOiJzaWciLCJhbGciOiJSUzI1NiIsImtpZCI6ImNjaWEtbGFuZGxlYXNlLTEifV19";

/**
 * JWT `iss` on session tokens must match one of these issuers (same signing key / JWKS).
 *
 * - Local dev: include both `localhost` and `127.0.0.1` so tokens match `NEXT_PUBLIC_APP_URL`
 *   whether you open the app as http://localhost:3000 or http://127.0.0.1:3000.
 * - Production: add your public origin to `extraIssuers` (same value as `NEXT_PUBLIC_APP_URL` on the host).
 *
 * Do not use `process.env` here: Convex requires any referenced env vars to be set on the deployment,
 * which breaks `npx convex dev` unless every developer configures them.
 *
 * Password-only mode (`DISABLE_JWT_AUTH=true` on Convex): Next sends no token; `requireUserId` uses
 * `CONVEX_DEV_USER_ID` instead.
 */
const extraIssuers: string[] = [
  "https://ccia-one.vercel.app",
];

const issuers = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  ...extraIssuers,
];

export default {
  providers: issuers.map((issuer) => ({
    type: "customJwt" as const,
    applicationID: "convex",
    issuer,
    jwks: JWKS_DATA_URI,
    algorithm: "RS256" as const,
  })),
} satisfies AuthConfig;
