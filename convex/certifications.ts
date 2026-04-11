import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  requireAdminOrCreator,
  requireUserId,
  userCanAccessLevel,
} from "./lib/auth";
import { isLive, nowDeletedAt } from "./lib/softDelete";
import { countUnitStepProgress } from "./contentProgress";
import { collectUnitsForLevel } from "./units";

export const listAllAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCreator(ctx);
    const all = (await ctx.db.query("certificationLevels").collect()).filter(
      (l) => isLive(l),
    );
    return all.sort((a, b) => a.order - b.order);
  },
});

export const listForUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    if (!user) {
      return [];
    }
    const all = (await ctx.db.query("certificationLevels").collect()).filter(
      (l) => isLive(l),
    );
    if (user.role === "admin" || user.role === "content_creator") {
      return all.sort((a, b) => a.order - b.order);
    }
    const filtered = all.filter(
      (l) => l.companyId == null || l.companyId === user.companyId,
    );
    return filtered.sort((a, b) => a.order - b.order);
  },
});

/**
 * Certifications grouped for the learner dashboard: in progress, not started, fully complete.
 */
export const listDashboardBucketsForUser = query({
  args: {},
  handler: async (ctx) => {
    type Row = {
      level: Doc<"certificationLevels">;
      unitTotal: number;
      completedCount: number;
      touchedCount: number;
      /** All sequential steps (lessons + assessments) across units in this certification. */
      contentStepsTotal: number;
      contentStepsCompleted: number;
    };
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    if (!user) {
      return {
        current: [] as Row[],
        future: [] as Row[],
        completed: [] as Row[],
      };
    }
    const all = (await ctx.db.query("certificationLevels").collect()).filter(
      (l) => isLive(l),
    );
    const levels =
      user.role === "admin" || user.role === "content_creator"
        ? all
        : all.filter(
            (l) => l.companyId == null || l.companyId === user.companyId,
          );
    const sorted = levels.sort((a, b) => a.order - b.order);

    const allProgress = await ctx.db
      .query("userProgress")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
    const progressByUnit = new Map<
      Id<"units">,
      (typeof allProgress)[number]
    >();
    for (const p of allProgress) {
      progressByUnit.set(p.unitId, p);
    }

    const rows: Row[] = [];
    for (const level of sorted) {
      const ok = await userCanAccessLevel(ctx, level._id);
      if (!ok) {
        continue;
      }
      const units = await collectUnitsForLevel(ctx, level._id);
      const unitIds = units.map((u) => u._id);
      let completedCount = 0;
      let touchedCount = 0;
      let contentStepsTotal = 0;
      let contentStepsCompleted = 0;
      for (const uid of unitIds) {
        const pr = progressByUnit.get(uid);
        if (pr) {
          touchedCount += 1;
          if (pr.completed) {
            completedCount += 1;
          }
        }
        const stepCounts = await countUnitStepProgress(ctx, userId, uid);
        contentStepsTotal += stepCounts.total;
        contentStepsCompleted += stepCounts.completed;
      }
      rows.push({
        level,
        unitTotal: unitIds.length,
        completedCount,
        touchedCount,
        contentStepsTotal,
        contentStepsCompleted,
      });
    }

    const current: Row[] = [];
    const future: Row[] = [];
    const completed: Row[] = [];
    for (const row of rows) {
      const { unitTotal, completedCount, touchedCount } = row;
      if (unitTotal === 0) {
        future.push(row);
        continue;
      }
      if (completedCount === unitTotal) {
        completed.push(row);
      } else if (touchedCount > 0) {
        current.push(row);
      } else {
        future.push(row);
      }
    }
    return { current, future, completed };
  },
});

/** Certification cards + counts for catalog UI (lessons = content items, assessments = assignments). */
export const listCatalogForUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    if (!user) {
      return [];
    }
    const all = (await ctx.db.query("certificationLevels").collect()).filter(
      (l) => isLive(l),
    );
    const levels =
      user.role === "admin" || user.role === "content_creator"
        ? all
        : all.filter(
            (l) => l.companyId == null || l.companyId === user.companyId,
          );
    const sorted = levels.sort((a, b) => a.order - b.order);
    const out: Array<
      Doc<"certificationLevels"> & {
        unitCount: number;
        lessonCount: number;
        assessmentCount: number;
      }
    > = [];
    for (const level of sorted) {
      const links = await ctx.db
        .query("certificationUnits")
        .withIndex("by_level", (q) => q.eq("levelId", level._id))
        .collect();
      links.sort((a, b) => a.order - b.order);
      const linkedUnitIds = new Set<Id<"units">>();
      const unitsOnLevel: Doc<"units">[] = [];
      for (const link of links) {
        const u = await ctx.db.get(link.unitId);
        if (isLive(u)) {
          linkedUnitIds.add(u._id);
          unitsOnLevel.push(u);
        }
      }
      const legacy = await ctx.db
        .query("units")
        .filter((q) => q.eq(q.field("levelId"), level._id))
        .collect();
      const legacyOnly = legacy
        .filter((u) => isLive(u) && !linkedUnitIds.has(u._id))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      unitsOnLevel.push(...legacyOnly);
      let lessonCount = 0;
      let assessmentCount = 0;
      for (const u of unitsOnLevel) {
        const uc = await ctx.db
          .query("unitContents")
          .withIndex("by_unit", (q) => q.eq("unitId", u._id))
          .collect();
        const linkedIds = new Set(uc.map((x) => x.contentId));
        const legacyAttached = await ctx.db
          .query("contentItems")
          .filter((q) => q.eq(q.field("unitId"), u._id))
          .collect();
        let lessons = 0;
        let unitAssessments = 0;
        for (const link of uc) {
          const cdoc = await ctx.db.get(link.contentId);
          if (!isLive(cdoc)) {
            continue;
          }
          if (cdoc.type === "test" || cdoc.type === "assignment") {
            unitAssessments += 1;
          } else {
            lessons += 1;
          }
        }
        for (const c of legacyAttached) {
          if (!isLive(c) || linkedIds.has(c._id)) {
            continue;
          }
          if (c.type === "test" || c.type === "assignment") {
            unitAssessments += 1;
          } else {
            lessons += 1;
          }
        }
        const assigns = await ctx.db
          .query("assignments")
          .filter((q) => q.eq(q.field("unitId"), u._id))
          .collect();
        lessonCount += lessons;
        assessmentCount += unitAssessments + assigns.length;
      }
      out.push({
        ...level,
        unitCount: unitsOnLevel.length,
        lessonCount,
        assessmentCount,
      });
    }
    return out;
  },
});

export const get = query({
  args: { levelId: v.id("certificationLevels") },
  handler: async (ctx, { levelId }) => {
    await requireUserId(ctx);
    const ok = await userCanAccessLevel(ctx, levelId);
    if (!ok) {
      return null;
    }
    const row = await ctx.db.get(levelId);
    return isLive(row) ? row : null;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    certificationCategoryId: v.optional(v.id("certificationCategories")),
    summary: v.optional(v.string()),
    description: v.string(),
    order: v.number(),
    companyId: v.optional(v.id("companies")),
    tagline: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCreator(ctx);
    const { certificationCategoryId, ...rest } = args;
    return await ctx.db.insert("certificationLevels", {
      ...rest,
      ...(certificationCategoryId
        ? { certificationCategoryId }
        : {}),
    });
  },
});

export const update = mutation({
  args: {
    levelId: v.id("certificationLevels"),
    name: v.string(),
    certificationCategoryId: v.optional(
      v.union(v.id("certificationCategories"), v.null()),
    ),
    summary: v.optional(v.string()),
    description: v.string(),
    order: v.number(),
    companyId: v.optional(v.id("companies")),
    tagline: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
  },
  handler: async (ctx, { levelId, certificationCategoryId, ...fields }) => {
    await requireAdminOrCreator(ctx);
    const row = await ctx.db.get(levelId);
    if (!isLive(row)) {
      throw new Error("Certification not found");
    }
    await ctx.db.patch(levelId, {
      ...fields,
      ...(certificationCategoryId !== undefined
        ? {
            certificationCategoryId:
              certificationCategoryId === null
                ? undefined
                : certificationCategoryId,
          }
        : {}),
    });
  },
});

export const reorderLevels = mutation({
  args: { orderedIds: v.array(v.id("certificationLevels")) },
  handler: async (ctx, { orderedIds }) => {
    await requireAdminOrCreator(ctx);
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      const lev = await ctx.db.get(id);
      if (!isLive(lev)) {
        throw new Error("Unknown or removed certification in order");
      }
      await ctx.db.patch(id, { order: i });
    }
  },
});

export const remove = mutation({
  args: { levelId: v.id("certificationLevels") },
  handler: async (ctx, { levelId }) => {
    await requireAdminOrCreator(ctx);
    const row = await ctx.db.get(levelId);
    if (!row) {
      throw new Error("Certification not found");
    }
    if (row.deletedAt != null) {
      return;
    }
    await ctx.db.patch(levelId, { deletedAt: nowDeletedAt() });
  },
});
