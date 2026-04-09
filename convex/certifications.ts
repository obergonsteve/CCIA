import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  requireAdminOrCreator,
  requireUserId,
  userCanAccessLevel,
} from "./lib/auth";

export const listAllAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCreator(ctx);
    const all = await ctx.db.query("certificationLevels").collect();
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
    const all = await ctx.db.query("certificationLevels").collect();
    if (user.role === "admin" || user.role === "content_creator") {
      return all.sort((a, b) => a.order - b.order);
    }
    const filtered = all.filter(
      (l) => l.companyId == null || l.companyId === user.companyId,
    );
    return filtered.sort((a, b) => a.order - b.order);
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
    const all = await ctx.db.query("certificationLevels").collect();
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
      const unitsOnLevel: Doc<"units">[] = [];
      if (links.length > 0) {
        for (const link of links) {
          const u = await ctx.db.get(link.unitId);
          if (u) {
            unitsOnLevel.push(u);
          }
        }
      } else {
        const legacy = await ctx.db
          .query("units")
          .filter((q) => q.eq(q.field("levelId"), level._id))
          .collect();
        for (const u of legacy) {
          unitsOnLevel.push(u);
        }
      }
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
        let lessons = uc.length;
        for (const c of legacyAttached) {
          if (!linkedIds.has(c._id)) {
            lessons += 1;
          }
        }
        const assigns = await ctx.db
          .query("assignments")
          .filter((q) => q.eq(q.field("unitId"), u._id))
          .collect();
        lessonCount += lessons;
        assessmentCount += assigns.length;
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
    return await ctx.db.get(levelId);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    summary: v.optional(v.string()),
    description: v.string(),
    order: v.number(),
    companyId: v.optional(v.id("companies")),
    tagline: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCreator(ctx);
    return await ctx.db.insert("certificationLevels", { ...args });
  },
});

export const update = mutation({
  args: {
    levelId: v.id("certificationLevels"),
    name: v.string(),
    summary: v.optional(v.string()),
    description: v.string(),
    order: v.number(),
    companyId: v.optional(v.id("companies")),
    tagline: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
  },
  handler: async (ctx, { levelId, ...fields }) => {
    await requireAdminOrCreator(ctx);
    await ctx.db.patch(levelId, fields);
  },
});

export const reorderLevels = mutation({
  args: { orderedIds: v.array(v.id("certificationLevels")) },
  handler: async (ctx, { orderedIds }) => {
    await requireAdminOrCreator(ctx);
    for (let i = 0; i < orderedIds.length; i++) {
      await ctx.db.patch(orderedIds[i], { order: i });
    }
  },
});

export const remove = mutation({
  args: { levelId: v.id("certificationLevels") },
  handler: async (ctx, { levelId }) => {
    await requireAdminOrCreator(ctx);
    const links = await ctx.db
      .query("certificationUnits")
      .withIndex("by_level", (q) => q.eq("levelId", levelId))
      .collect();
    for (const link of links) {
      await ctx.db.delete(link._id);
    }
    await ctx.db.delete(levelId);
  },
});
