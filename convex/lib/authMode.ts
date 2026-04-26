import type { MutationCtx, QueryCtx } from "../_generated/server";
import { v, type Infer } from "convex/values";

export const authModeValidator = v.union(v.literal("legacy"), v.literal("convex"));
export type AuthMode = Infer<typeof authModeValidator>;

const ENV = {
  override: "AUTH_STRATEGY" as const,
  emergency: "EMERGENCY_AUTH_LEGACY" as const,
};

/**
 * For Convex: env (deployment settings) overrides appSettings in DB.
 */
function authModeFromProcessEnv(ctx: { env?: NodeJS.ProcessEnv }): AuthMode | null {
  const env = ctx.env ?? (typeof process !== "undefined" ? process.env : undefined);
  if (!env) {
    return null;
  }
  const o = env[ENV.override]?.trim().toLowerCase();
  if (o === "legacy" || o === "convex") {
    return o;
  }
  const e = env[ENV.emergency];
  if (e === "1" || e?.toLowerCase() === "true") {
    return "legacy";
  }
  return null;
}

const SETTINGS_ID = "default" as const;

export function defaultAuthModeValue(): AuthMode {
  return "legacy";
}

export async function getEffectiveAuthModeInConvex(
  _ctx: QueryCtx | MutationCtx,
  row: { authMode: AuthMode } | null,
): Promise<AuthMode> {
  const fromEnv = authModeFromProcessEnv({ env: process.env });
  if (fromEnv) {
    return fromEnv;
  }
  if (row?.authMode) {
    return row.authMode;
  }
  return defaultAuthModeValue();
}

export { SETTINGS_ID };
