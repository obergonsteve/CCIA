import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Convex has no browser token: `requireUserId` uses `CONVEX_DEV_USER_ID` for this deployment.
 * Set it to a real `users` document id (Convex dashboard → Data).
 */
function deploymentUserId(): Id<"users"> {
  const raw = process.env.CONVEX_DEV_USER_ID;
  if (!raw?.trim()) {
    throw new Error(
      "Convex env CONVEX_DEV_USER_ID is unset (not in .env.local — set it on the Convex deployment). " +
        "Run: npx convex run seed:seedCommunityOperatorsAndAdmins — copy setConvexDevUserId from the output — " +
        "then: npx convex env set CONVEX_DEV_USER_ID \"<that id>\" — then: npx convex dev (or deploy).",
    );
  }
  return raw as Id<"users">;
}

export async function requireUserId(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
  void ctx;
  return deploymentUserId();
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
