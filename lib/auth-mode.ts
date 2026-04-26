/**
 * Which authentication stack the app + Convex use.
 * Keep in sync with [convex/lib/authMode.ts] validators.
 */
export const AUTH_MODES = ["legacy", "convex"] as const;
export type AuthMode = (typeof AUTH_MODES)[number];

const COOKIE_NAME = "cciaAuthMode";
export const AUTH_MODE_COOKIE = COOKIE_NAME;

const ENV_KEYS = {
  override: "AUTH_STRATEGY",
  emergency: "EMERGENCY_AUTH_LEGACY",
} as const;

/**
 * For Next.js `process.env` and Convex deployment env: `legacy` | `convex`.
 * If set, overrides DB and cookie (break-glass).
 */
export function authStrategyFromProcessEnv(
  env: NodeJS.ProcessEnv = process.env,
): AuthMode | null {
  const o = env[ENV_KEYS.override]?.trim().toLowerCase();
  if (o === "legacy" || o === "convex") {
    return o;
  }
  const emerg = env[ENV_KEYS.emergency];
  if (emerg === "1" || emerg?.toLowerCase() === "true") {
    return "legacy";
  }
  return null;
}

/** Cookie mirroring `appSettings.authMode` for Edge middleware. */
export function readAuthModeCookie(
  getCookie: (name: string) => string | undefined,
): AuthMode | null {
  const raw = getCookie(COOKIE_NAME)?.trim().toLowerCase();
  if (raw === "legacy" || raw === "convex") {
    return raw;
  }
  return null;
}

export function isAuthMode(m: string | null | undefined): m is AuthMode {
  return m === "legacy" || m === "convex";
}

/**
 * Precedence: env (AUTH_STRATEGY / EMERGENCY_AUTH_LEGACY) > cookie > default.
 * Used in middleware and server components when Convex query is not available.
 */
export function getEffectiveAuthModeForEdge(options: {
  getCookie: (name: string) => string | undefined;
  defaultMode?: AuthMode;
}): AuthMode {
  const fromEnv = authStrategyFromProcessEnv();
  if (fromEnv) {
    return fromEnv;
  }
  const fromCookie = readAuthModeCookie(options.getCookie);
  if (fromCookie) {
    return fromCookie;
  }
  return options.defaultMode ?? "legacy";
}

export const authModeCookieOptions = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 365, // 1 year — refreshed when admin changes setting
  secure: process.env.NODE_ENV === "production",
};
