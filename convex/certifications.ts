import { v } from "convex/values";
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
    description: v.string(),
    order: v.number(),
    companyId: v.optional(v.id("companies")),
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
    description: v.string(),
    order: v.number(),
    companyId: v.optional(v.id("companies")),
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
    const units = await ctx.db
      .query("units")
      .filter((q) => q.eq(q.field("levelId"), levelId))
      .collect();
    for (const u of units) {
      const items = await ctx.db
        .query("contentItems")
        .filter((q) => q.eq(q.field("unitId"), u._id))
        .collect();
      for (const it of items) {
        await ctx.db.delete(it._id);
      }
      const assigns = await ctx.db
        .query("assignments")
        .filter((q) => q.eq(q.field("unitId"), u._id))
        .collect();
      for (const a of assigns) {
        await ctx.db.delete(a._id);
      }
      await ctx.db.delete(u._id);
    }
    await ctx.db.delete(levelId);
  },
});
