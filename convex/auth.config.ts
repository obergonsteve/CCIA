import type { AuthConfig } from "convex/server";

/** No Convex Auth / OIDC; identity for queries comes from `convex/lib/auth.ts` fallback. */
export default {
  providers: [],
} satisfies AuthConfig;
