import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { userCanAccessLevel } from "./auth";

/** Certification levels that include this unit (junction + legacy `units.levelId`). */
export async function collectLevelIdsForUnit(
  ctx: QueryCtx,
  unitId: Id<"units">,
): Promise<Id<"certificationLevels">[]> {
  const links = await ctx.db
    .query("certificationUnits")
    .withIndex("by_unit", (q) => q.eq("unitId", unitId))
    .collect();
  const ids = new Set<Id<"certificationLevels">>();
  for (const l of links) {
    ids.add(l.levelId);
  }
  const u = await ctx.db.get(unitId);
  if (u?.levelId) {
    ids.add(u.levelId);
  }
  return [...ids];
}

export async function userCanAccessWorkshopSession(
  ctx: QueryCtx,
  workshopUnitId: Id<"units">,
): Promise<boolean> {
  const levelIds = await collectLevelIdsForUnit(ctx, workshopUnitId);
  for (const levelId of levelIds) {
    if (await userCanAccessLevel(ctx, levelId)) {
      return true;
    }
  }
  return false;
}
