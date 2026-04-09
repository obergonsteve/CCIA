import type { AuthConfig } from "convex/server";

/**
 * No browser JWT to Convex by default (`JWT_AUTH_ENABLED` is not `true` on Convex).
 * Enable RS256 + JWKS in git history / docs if you set `JWT_AUTH_ENABLED=true` on Next + Convex.
 */
export default {
  providers: [],
} satisfies AuthConfig;
