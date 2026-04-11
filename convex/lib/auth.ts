import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isLive } from "./softDelete";

/**
 * Default Convex “acting user” when there is no browser token.
 * 1) `CONVEX_DEV_USER_ID` if set on the deployment (pins user in prod / multi-account).
 * 2) Else the seeded admin `steve.moore@ccia-landlease.com` (must match `seed.ts`).
 */
const FALLBACK_ADMIN_EMAIL = "steve.moore@ccia-landlease.com";

export async function resolveDeploymentUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
  const raw = process.env.CONVEX_DEV_USER_ID?.trim();
  if (raw) {
    return raw as Id<"users">;
  }
  const seeded = await ctx.db
    .query("users")
    .withIndex("by_email", (q) =>
      q.eq("email", FALLBACK_ADMIN_EMAIL.toLowerCase()),
    )
    .unique();
  if (seeded) {
    return seeded._id;
  }
  throw new Error(
    "No Convex user identity: run `npx convex run seed:seedCommunityOperatorsAndAdmins`, " +
      "or set deployment env CONVEX_DEV_USER_ID to a `users` document id.",
  );
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
