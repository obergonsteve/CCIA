import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId, userCanAccessLevel } from "./lib/auth";
import { userCanAccessUnit } from "./lib/auth";
import { LAND_LEASE_CURRICULUM, seedUnitKey } from "./curriculumSeedData";

export type PrerequisiteItem = {
  unitId: Id<"units">;
  title: string;
  levelId: Id<"certificationLevels">;
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
      const level = await ctx.db.get(u.levelId);
      const prog = await ctx.db
        .query("userProgress")
        .withIndex("by_user_unit", (q) =>
          q.eq("userId", userId).eq("unitId", row.prerequisiteUnitId),
        )
        .unique();
      prerequisites.push({
        unitId: u._id,
        title: u.title,
        levelId: u.levelId,
        levelName: level?.name ?? "Certification",
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
    const units = await ctx.db
      .query("units")
      .filter((q) => q.eq(q.field("levelId"), levelId))
      .collect();
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
export const syncLandLeasePrerequisitesFromCurriculum = mutation({
  args: {},
  handler: async (ctx) => {
    const levels = await ctx.db.query("certificationLevels").collect();
    const globalLevels = levels.filter((l) => l.companyId == null);
    const idByKey = new Map<string, Id<"units">>();
    for (const level of globalLevels) {
      const units = await ctx.db
        .query("units")
        .filter((q) => q.eq(q.field("levelId"), level._id))
        .collect();
      for (const u of units) {
        idByKey.set(seedUnitKey(level.name, u.title), u._id);
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
