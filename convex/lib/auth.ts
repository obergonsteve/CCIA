import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getEffectiveAuthModeInConvex } from "./authMode";
import { isLive } from "./softDelete";
import {
  canStudentStartCertification,
  studentEntitlementsActive,
} from "./studentEntitlements";

/**
 * Legacy deployment fallback (when `appSettings` / `AUTH_STRATEGY` is `legacy`).
 * 1) `CONVEX_DEV_USER_ID` on the deployment if set (must be an existing `users` id).
 * 2) Else exactly one `users` row with email `steve.moore@ccia-landlease.com` (see `seed.ts`).
 *
 * Note: `.unique()` on the `email` index throws if there are 0 or 2+ matches — that surfaced as a
 * generic client “Server Error”. We use `.collect()` and explicit errors instead.
 */
const FALLBACK_ADMIN_EMAIL = "steve.moore@ccia-landlease.com";

export async function resolveDeploymentUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
  const raw = process.env.CONVEX_DEV_USER_ID?.trim();
  if (raw) {
    let row;
    try {
      row = await ctx.db.get(raw as Id<"users">);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ConvexError(
        `CONVEX_DEV_USER_ID "${raw}" is not a valid users id (${msg}). Remove or fix it under Convex → Deployment → Environment Variables.`,
      );
    }
    if (!row) {
      throw new ConvexError(
        `CONVEX_DEV_USER_ID is "${raw}" but no users row exists. Remove it or set it to a real users document _id from the dashboard.`,
      );
    }
    return row._id;
  }

  const email = FALLBACK_ADMIN_EMAIL.toLowerCase();
  const candidates = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .collect();

  if (candidates.length === 0) {
    throw new ConvexError(
      `No deployment fallback user: no users row with email "${email}". Run: npx convex run seed:seedCommunityOperatorsAndAdmins` +
        " (add --prod for production). Or set CONVEX_DEV_USER_ID to a users document id.",
    );
  }
  if (candidates.length > 1) {
    throw new ConvexError(
      `${candidates.length} users share email "${email}"; Convex requires exactly one fallback. Delete duplicates in Dashboard → Data → users, or set CONVEX_DEV_USER_ID to one _id.`,
    );
  }

  return candidates[0]!._id;
}

export async function requireUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
  const row = await ctx.runQuery(internal.appSettings.getAppSettingsRow, {});
  const mode = await getEffectiveAuthModeInConvex(ctx, row);
  if (mode === "convex") {
    const id = await getAuthUserId(ctx);
    if (id === null) {
      throw new ConvexError("Unauthorized");
    }
    return id;
  }
  return resolveDeploymentUserId(ctx);
}

export async function requireAdminOrCreator(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
  const userId = await requireUserId(ctx);
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("Unauthorized");
  }
  if (user.role !== "admin" && user.role !== "content_creator") {
    throw new Error("Forbidden");
  }
  return userId;
}

/** Synchronous check for a known `users` + `certificationLevels` row (e.g. admin/mutations targeting other users). */
export function userCanAccessLevelWithUser(
  user: Doc<"users">,
  level: Doc<"certificationLevels">,
): boolean {
  if (!isLive(level)) {
    return false;
  }
  if (user.role === "admin" || user.role === "content_creator") {
    return true;
  }
  return level.companyId == null || level.companyId === user.companyId;
}

export async function userCanAccessLevel(
  ctx: QueryCtx | MutationCtx,
  levelId: Id<"certificationLevels">,
): Promise<boolean> {
  const userId = await requireUserId(ctx);
  const user = await ctx.db.get(userId);
  const level = await ctx.db.get(levelId);
  if (!user) {
    return false;
  }
  if (!isLive(level)) {
    return false;
  }
  return userCanAccessLevelWithUser(user, level);
}

export async function userCanAccessUnit(
  ctx: QueryCtx | MutationCtx,
  unitId: Id<"units">,
): Promise<boolean> {
  const userId = await requireUserId(ctx);
  const user = await ctx.db.get(userId);
  const unit = await ctx.db.get(unitId);
  if (!user) {
    return false;
  }
  if (!isLive(unit)) {
    return false;
  }
  if (user.role === "admin" || user.role === "content_creator") {
    return true;
  }
  const links = await ctx.db
    .query("certificationUnits")
    .withIndex("by_unit", (q) => q.eq("unitId", unitId))
    .collect();
  if (links.length === 0) {
    if (unit.levelId) {
      const ok = await userCanAccessLevel(ctx, unit.levelId);
      if (!ok) {
        return false;
      }
      if (!studentEntitlementsActive(user)) {
        return true;
      }
      const prog = await ctx.db
        .query("userProgress")
        .withIndex("by_user_unit", (q) =>
          q.eq("userId", userId).eq("unitId", unitId),
        )
        .unique();
      if (prog) {
        return true;
      }
      return canStudentStartCertification(user, unit.levelId);
    }
    return false;
  }
  const accessibleLevelIds: Id<"certificationLevels">[] = [];
  for (const link of links) {
    if (await userCanAccessLevel(ctx, link.levelId)) {
      accessibleLevelIds.push(link.levelId);
    }
  }
  if (accessibleLevelIds.length === 0) {
    return false;
  }
  if (!studentEntitlementsActive(user)) {
    return true;
  }
  const prog = await ctx.db
    .query("userProgress")
    .withIndex("by_user_unit", (q) =>
      q.eq("userId", userId).eq("unitId", unitId),
    )
    .unique();
  if (prog) {
    return true;
  }
  for (const lid of accessibleLevelIds) {
    if (canStudentStartCertification(user, lid)) {
      return true;
    }
  }
  return false;
}

/**
 * Unit access for an arbitrary user row (e.g. admin “view as” a student on the
 * roadmap). Does not use the session user for membership checks.
 */
export async function userCanAccessUnitForUser(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
  unitId: Id<"units">,
): Promise<boolean> {
  const userId = user._id;
  const unit = await ctx.db.get(unitId);
  if (!isLive(unit)) {
    return false;
  }
  if (user.role === "admin" || user.role === "content_creator") {
    return true;
  }
  const links = await ctx.db
    .query("certificationUnits")
    .withIndex("by_unit", (q) => q.eq("unitId", unitId))
    .collect();
  if (links.length === 0) {
    if (unit.levelId) {
      const level = await ctx.db.get(unit.levelId);
      if (!level) {
        return false;
      }
      if (!userCanAccessLevelWithUser(user, level)) {
        return false;
      }
      if (!studentEntitlementsActive(user)) {
        return true;
      }
      const prog = await ctx.db
        .query("userProgress")
        .withIndex("by_user_unit", (q) =>
          q.eq("userId", userId).eq("unitId", unitId),
        )
        .unique();
      if (prog) {
        return true;
      }
      return canStudentStartCertification(user, unit.levelId);
    }
    return false;
  }
  const accessibleLevelIds: Id<"certificationLevels">[] = [];
  for (const link of links) {
    const lev = await ctx.db.get(link.levelId);
    if (lev && userCanAccessLevelWithUser(user, lev)) {
      accessibleLevelIds.push(link.levelId);
    }
  }
  if (accessibleLevelIds.length === 0) {
    return false;
  }
  if (!studentEntitlementsActive(user)) {
    return true;
  }
  const prog = await ctx.db
    .query("userProgress")
    .withIndex("by_user_unit", (q) =>
      q.eq("userId", userId).eq("unitId", unitId),
    )
    .unique();
  if (prog) {
    return true;
  }
  for (const lid of accessibleLevelIds) {
    if (canStudentStartCertification(user, lid)) {
      return true;
    }
  }
  return false;
}
