import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  requireAdminOrCreator,
  requireUserId,
  userCanAccessLevel,
  userCanAccessUnit,
} from "./lib/auth";

export const listAllAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCreator(ctx);
    const all = await ctx.db.query("units").collect();
    return all.sort((a, b) => a.order - b.order);
  },
});

export const listByLevel = query({
  args: { levelId: v.id("certificationLevels") },
  handler: async (ctx, { levelId }) => {
    await requireUserId(ctx);
    const ok = await userCanAccessLevel(ctx, levelId);
    if (!ok) {
      return [];
    }
    const units = await ctx.db
      .query("units")
      .filter((q) => q.eq(q.field("levelId"), levelId))
      .collect();
    return units.sort((a, b) => a.order - b.order);
  },
});

export const get = query({
  args: { unitId: v.id("units") },
  handler: async (ctx, { unitId }) => {
    await requireUserId(ctx);
    const ok = await userCanAccessUnit(ctx, unitId);
    if (!ok) {
      return null;
    }
    return await ctx.db.get(unitId);
  },
});

export const create = mutation({
  args: {
    levelId: v.id("certificationLevels"),
    title: v.string(),
    description: v.string(),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCreator(ctx);
    return await ctx.db.insert("units", args);
  },
});

export const update = mutation({
  args: {
    unitId: v.id("units"),
    title: v.string(),
    description: v.string(),
    order: v.number(),
  },
  handler: async (ctx, { unitId, ...fields }) => {
    await requireAdminOrCreator(ctx);
    await ctx.db.patch(unitId, fields);
  },
});

export const reorderUnits = mutation({
  args: { orderedIds: v.array(v.id("units")) },
  handler: async (ctx, { orderedIds }) => {
    await requireAdminOrCreator(ctx);
    for (let i = 0; i < orderedIds.length; i++) {
      await ctx.db.patch(orderedIds[i], { order: i });
    }
  },
});
