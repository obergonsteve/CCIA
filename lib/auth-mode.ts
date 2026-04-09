/** When true (Next.js + Convex deployment), Convex uses no JWT; set CONVEX_DEV_USER_ID on Convex. */
export function isJwtAuthDisabled(): boolean {
  return process.env.DISABLE_JWT_AUTH === "true";
}
