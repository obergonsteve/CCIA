import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

function devImpersonatedUserId(): Id<"users"> {
  const raw = process.env.CONVEX_DEV_USER_ID;
  if (!raw?.trim()) {
    throw new Error(
      "Set CONVEX_DEV_USER_ID on this Convex deployment when DISABLE_JWT_AUTH=true.",
    );
  }
  return raw as Id<"users">;
}

export async function requireUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
  if (process.env.DISABLE_JWT_AUTH === "true") {
    return devImpersonatedUserId();
  }
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) {
    throw new Error("Unauthorized");
  }
  return identity.subject as Id<"users">;
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
  if (!user || !level) {
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
  const unit = await ctx.db.get(unitId);
  if (!unit) {
    return false;
  }
  return userCanAccessLevel(ctx, unit.levelId);
}
