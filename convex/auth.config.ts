import type { AuthConfig } from "convex/server";

/**
 * JWT verification for Convex Auth (`@convex-dev/auth`).
 * Set `JWT_PRIVATE_KEY`, `JWKS`, and `CONVEX_SITE_URL` on the deployment (see labs manual setup).
 */
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL ?? "",
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
