import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  requireAdminOrCreator,
  requireUserId,
  userCanAccessLevel,
} from "./lib/auth";
import { userCanAccessUnit } from "./lib/auth";
import { LAND_LEASE_CURRICULUM, seedUnitKey } from "./curriculumSeedData";

export type PrerequisiteItem = {
  unitId: Id<"units">;
  title: string;
  levelId: Id<"certificationLevels"> | null;
  levelName: string;
  completed: boolean;
};

export const statusForUnit = query({
  args: { unitId: v.id("units") },
  handler: async (ctx, { unitId }) => {
    const userId = await requireUserId(ctx);
    const ok = await userCanAccessUnit(ctx, unitId);
    if (!ok) {
      return null;
    }
    const rows = await ctx.db
      .query("unitPrerequisites")
      .withIndex("by_unit", (q) => q.eq("unitId", unitId))
      .collect();
    const prerequisites: PrerequisiteItem[] = [];
    for (const row of rows) {
      const u = await ctx.db.get(row.prerequisiteUnitId);
      if (!u) {
        continue;
      }
      const link = await ctx.db
        .query("certificationUnits")
        .withIndex("by_unit", (q) => q.eq("unitId", u._id))
        .first();
      const levelId = link?.levelId ?? u.levelId;
      const level = levelId ? await ctx.db.get(levelId) : null;
      const prog = await ctx.db
        .query("userProgress")
        .withIndex("by_user_unit", (q) =>
          q.eq("userId", userId).eq("unitId", row.prerequisiteUnitId),
        )
        .unique();
      prerequisites.push({
        unitId: u._id,
        title: u.title,
        levelId: levelId ?? null,
        levelName: level?.name ?? "Unit",
        completed: prog?.completed ?? false,
      });
    }
    const ready =
      prerequisites.length === 0 ||
      prerequisites.every((p) => p.completed);
    return { ready, prerequisites };
  },
});

export const summariesForLevel = query({
  args: { levelId: v.id("certificationLevels") },
  handler: async (ctx, { levelId }) => {
    const userId = await requireUserId(ctx);
    const levelOk = await userCanAccessLevel(ctx, levelId);
    if (!levelOk) {
      return [];
    }
    const cLinks = await ctx.db
      .query("certificationUnits")
      .withIndex("by_level", (q) => q.eq("levelId", levelId))
      .collect();
    cLinks.sort((a, b) => a.order - b.order);
    const units = [];
    for (const cl of cLinks) {
      const u = await ctx.db.get(cl.unitId);
      if (u) {
        units.push(u);
      }
    }
    const results: Array<{
      unitId: Id<"units">;
      ready: boolean;
      prerequisiteTitles: string[];
    }> = [];
    for (const unit of units) {
      const rows = await ctx.db
        .query("unitPrerequisites")
        .withIndex("by_unit", (q) => q.eq("unitId", unit._id))
        .collect();
      const titles: string[] = [];
      let ready = true;
      for (const row of rows) {
        const pu = await ctx.db.get(row.prerequisiteUnitId);
        if (!pu) {
          continue;
        }
        titles.push(pu.title);
        const prog = await ctx.db
          .query("userProgress")
          .withIndex("by_user_unit", (q) =>
            q.eq("userId", userId).eq("unitId", row.prerequisiteUnitId),
          )
          .unique();
        if (!prog?.completed) {
          ready = false;
        }
      }
      results.push({
        unitId: unit._id,
        ready,
        prerequisiteTitles: titles,
      });
    }
    return results;
  },
});

/**
 * Idempotent: inserts prerequisite edges from curriculum data for global (non-company) levels.
 * Safe to run after `seedLandLeaseCurriculum`; resolves units by level name + unit title.
 */
/** No user auth — same as `seed:seedLandLeaseCurriculum`; run only from trusted environments. */
async function prerequisiteWouldCreateCycle(
  ctx: MutationCtx,
  unitId: Id<"units">,
  prerequisiteUnitId: Id<"units">,
): Promise<boolean> {
  if (unitId === prerequisiteUnitId) {
    return true;
  }
  const stack: Id<"units">[] = [prerequisiteUnitId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (seen.has(current)) {
      continue;
    }
    seen.add(current);
    const dependents = await ctx.db
      .query("unitPrerequisites")
      .withIndex("by_prerequisite_unit", (q) =>
        q.eq("prerequisiteUnitId", current),
      )
      .collect();
    for (const d of dependents) {
      if (d.unitId === unitId) {
        return true;
      }
      stack.push(d.unitId);
    }
  }
  return false;
}

/** Admin: prerequisite edges for a unit (titles for display). */
export const adminListForUnit = query({
  args: { unitId: v.id("units") },
  handler: async (ctx, { unitId }) => {
    await requireAdminOrCreator(ctx);
    const rows = await ctx.db
      .query("unitPrerequisites")
      .withIndex("by_unit", (q) => q.eq("unitId", unitId))
      .collect();
    const out: Array<{
      edgeId: Id<"unitPrerequisites">;
      prerequisiteUnitId: Id<"units">;
      title: string;
    }> = [];
    for (const row of rows) {
      const u = await ctx.db.get(row.prerequisiteUnitId);
      if (u) {
        out.push({
          edgeId: row._id,
          prerequisiteUnitId: u._id,
          title: u.title,
        });
      }
    }
    return out;
  },
});

export const adminAddPrerequisite = mutation({
  args: {
    unitId: v.id("units"),
    prerequisiteUnitId: v.id("units"),
  },
  handler: async (ctx, { unitId, prerequisiteUnitId }) => {
    await requireAdminOrCreator(ctx);
    if (unitId === prerequisiteUnitId) {
      throw new Error("A unit cannot be its own prerequisite");
    }
    if (await prerequisiteWouldCreateCycle(ctx, unitId, prerequisiteUnitId)) {
      throw new Error("That prerequisite would create a cycle");
    }
    const existing = await ctx.db
      .query("unitPrerequisites")
      .withIndex("by_unit", (q) => q.eq("unitId", unitId))
      .collect();
    if (existing.some((e) => e.prerequisiteUnitId === prerequisiteUnitId)) {
      return { ok: true as const, duplicate: true };
    }
    await ctx.db.insert("unitPrerequisites", {
      unitId,
      prerequisiteUnitId,
    });
    return { ok: true as const, duplicate: false };
  },
});

export const adminRemovePrerequisite = mutation({
  args: { edgeId: v.id("unitPrerequisites") },
  handler: async (ctx, { edgeId }) => {
    await requireAdminOrCreator(ctx);
    await ctx.db.delete(edgeId);
  },
});

export const syncLandLeasePrerequisitesFromCurriculum = mutation({
  args: {},
  handler: async (ctx) => {
    const levels = await ctx.db.query("certificationLevels").collect();
    const globalLevels = levels.filter((l) => l.companyId == null);
    const idByKey = new Map<string, Id<"units">>();
    for (const level of globalLevels) {
      const links = await ctx.db
        .query("certificationUnits")
        .withIndex("by_level", (q) => q.eq("levelId", level._id))
        .collect();
      for (const link of links) {
        const u = await ctx.db.get(link.unitId);
        if (u) {
          idByKey.set(seedUnitKey(level.name, u.title), u._id);
        }
      }
    }
    let inserted = 0;
    for (const course of LAND_LEASE_CURRICULUM) {
      for (const unit of course.units) {
        const unitId = idByKey.get(seedUnitKey(course.name, unit.title));
        if (!unitId || !unit.prerequisites?.length) {
          continue;
        }
        for (const p of unit.prerequisites) {
          const prerequisiteUnitId = idByKey.get(
            seedUnitKey(p.courseName, p.unitTitle),
          );
          if (!prerequisiteUnitId) {
            throw new Error(
              `Prerequisite not found: ${p.courseName} — ${p.unitTitle} (for ${course.name} — ${unit.title})`,
            );
          }
          if (prerequisiteUnitId === unitId) {
            throw new Error(`Self prerequisite: ${unit.title}`);
          }
          const existing = await ctx.db
            .query("unitPrerequisites")
            .withIndex("by_unit", (q) => q.eq("unitId", unitId))
            .collect();
          const dup = existing.some(
            (e) => e.prerequisiteUnitId === prerequisiteUnitId,
          );
          if (!dup) {
            await ctx.db.insert("unitPrerequisites", {
              unitId,
              prerequisiteUnitId,
            });
            inserted += 1;
          }
        }
      }
    }
    return { ok: true as const, inserted };
  },
});
