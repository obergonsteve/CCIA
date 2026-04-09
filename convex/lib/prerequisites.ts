import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function getIncompletePrerequisites(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  unitId: Id<"units">,
): Promise<Doc<"units">[]> {
  const rows = await ctx.db
    .query("unitPrerequisites")
    .withIndex("by_unit", (q) => q.eq("unitId", unitId))
    .collect();
  const missing: Doc<"units">[] = [];
  for (const row of rows) {
    const prereqUnit = await ctx.db.get(row.prerequisiteUnitId);
    if (!prereqUnit) {
      continue;
    }
    const prog = await ctx.db
      .query("userProgress")
      .withIndex("by_user_unit", (q) =>
        q.eq("userId", userId).eq("unitId", row.prerequisiteUnitId),
      )
      .unique();
    if (!prog?.completed) {
      missing.push(prereqUnit);
    }
  }
  return missing;
}
