import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isLive } from "./softDelete";

/**
 * Convex “acting user” for browser queries (no Convex Auth JWT in this app).
 * 1) `CONVEX_DEV_USER_ID` on the deployment if set (must be an existing `users` id).
 * 2) Else exactly one `users` row with email `steve.moore@ccia-landlease.com` (see `seed.ts`).
 *
 * Note: `.unique()` on `by_email` throws if there are 0 or 2+ matches — that surfaced as a
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
    .withIndex("by_email", (q) => q.eq("email", email))
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
  if (user.role === "admin" || user.role === "content_creator") {
    return true;
  }
  return level.companyId == null || level.companyId === user.companyId;
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
      return userCanAccessLevel(ctx, unit.levelId);
    }
    return false;
  }
  for (const link of links) {
    if (await userCanAccessLevel(ctx, link.levelId)) {
      return true;
    }
  }
  return false;
}
