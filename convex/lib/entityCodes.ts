import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export const ENTITY_CODE_MAX_LEN = 48;
export const ENTITY_CODE_MIN_LEN = 2;

const CODE_RE = /^[A-Z0-9][A-Z0-9._-]*$/;

/** Normalize to a stable uppercase code: letters, digits, `.`, `_`, `-` only. */
export function normalizeEntityCode(raw: string): string {
  const ascii = raw
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");
  const upper = ascii.toUpperCase().replace(/[^A-Z0-9._-]/g, "");
  return upper.slice(0, ENTITY_CODE_MAX_LEN);
}

export function validateEntityCodeFormat(code: string): void {
  if (code.length < ENTITY_CODE_MIN_LEN || code.length > ENTITY_CODE_MAX_LEN) {
    throw new ConvexError(
      `Code must be between ${ENTITY_CODE_MIN_LEN} and ${ENTITY_CODE_MAX_LEN} characters after normalizing.`,
    );
  }
  if (!CODE_RE.test(code)) {
    throw new ConvexError(
      "Code must start with a letter or digit and may only contain letters, digits, period, underscore, or hyphen.",
    );
  }
}

export async function assertUniqueCertificationCode(
  ctx: MutationCtx,
  code: string,
  excludeLevelId?: Id<"certificationLevels">,
): Promise<void> {
  const rows = await ctx.db
    .query("certificationLevels")
    .withIndex("by_code", (q) => q.eq("code", code))
    .collect();
  if (rows.some((r) => r._id !== excludeLevelId)) {
    throw new ConvexError("This certification code is already in use.");
  }
}

export async function assertUniqueUnitCode(
  ctx: MutationCtx,
  code: string,
  excludeUnitId?: Id<"units">,
): Promise<void> {
  const rows = await ctx.db
    .query("units")
    .withIndex("by_code", (q) => q.eq("code", code))
    .collect();
  if (rows.some((r) => r._id !== excludeUnitId)) {
    throw new ConvexError("This unit code is already in use.");
  }
}

export async function assertUniqueContentCode(
  ctx: MutationCtx,
  code: string,
  excludeContentId?: Id<"contentItems">,
): Promise<void> {
  const rows = await ctx.db
    .query("contentItems")
    .withIndex("by_code", (q) => q.eq("code", code))
    .collect();
  if (rows.some((r) => r._id !== excludeContentId)) {
    throw new ConvexError("This content code is already in use.");
  }
}

function seedBaseFromLabel(
  label: string,
  fallback: string,
  /** Truncate normalized base (seed data uses a short cap for readable codes). */
  maxBaseLen = 28,
): string {
  let base = normalizeEntityCode(label);
  if (base.length < ENTITY_CODE_MIN_LEN) {
    base = normalizeEntityCode(fallback) || "X";
  }
  if (base.length < ENTITY_CODE_MIN_LEN) {
    base = "XX";
  }
  const cap = Math.min(
    Math.max(maxBaseLen, ENTITY_CODE_MIN_LEN),
    ENTITY_CODE_MAX_LEN,
  );
  return base.slice(0, cap);
}

/** Default for `seed.ts` / curriculum seed — short codes in admin lists. */
export const SEED_CODE_BASE_MAX_LEN = 10;

export async function allocateUniqueCertificationCode(
  ctx: MutationCtx,
  name: string,
  options?: { maxBaseLen?: number },
): Promise<string> {
  const base = seedBaseFromLabel(
    name,
    "CERT",
    options?.maxBaseLen ?? 28,
  );
  for (let i = 0; i < 500; i++) {
    const candidate =
      i === 0 ? base : `${base}-${i + 1}`.slice(0, ENTITY_CODE_MAX_LEN);
    validateEntityCodeFormat(candidate);
    const rows = await ctx.db
      .query("certificationLevels")
      .withIndex("by_code", (q) => q.eq("code", candidate))
      .collect();
    if (rows.length === 0) {
      return candidate;
    }
  }
  throw new ConvexError("Could not allocate a unique certification code.");
}

export async function allocateUniqueUnitCode(
  ctx: MutationCtx,
  title: string,
  options?: { maxBaseLen?: number },
): Promise<string> {
  const base = seedBaseFromLabel(
    title,
    "UNIT",
    options?.maxBaseLen ?? 28,
  );
  for (let i = 0; i < 500; i++) {
    const candidate =
      i === 0 ? base : `${base}-${i + 1}`.slice(0, ENTITY_CODE_MAX_LEN);
    validateEntityCodeFormat(candidate);
    const rows = await ctx.db
      .query("units")
      .withIndex("by_code", (q) => q.eq("code", candidate))
      .collect();
    if (rows.length === 0) {
      return candidate;
    }
  }
  throw new ConvexError("Could not allocate a unique unit code.");
}

export async function allocateUniqueContentCode(
  ctx: MutationCtx,
  title: string,
): Promise<string> {
  const base = seedBaseFromLabel(title, "CONTENT");
  for (let i = 0; i < 500; i++) {
    const candidate =
      i === 0 ? base : `${base}-${i + 1}`.slice(0, ENTITY_CODE_MAX_LEN);
    validateEntityCodeFormat(candidate);
    const rows = await ctx.db
      .query("contentItems")
      .withIndex("by_code", (q) => q.eq("code", candidate))
      .collect();
    if (rows.length === 0) {
      return candidate;
    }
  }
  throw new ConvexError("Could not allocate a unique content code.");
}
