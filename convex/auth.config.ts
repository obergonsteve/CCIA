import type { AuthConfig } from "convex/server";

/** No Convex Auth providers; identity is not used from the browser. */
export default {
  providers: [],
} satisfies AuthConfig;
