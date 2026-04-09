import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  type MutationCtx,
  query,
} from "./_generated/server";
import {
  requireAdminOrCreator,
  requireUserId,
  userCanAccessLevel,
  userCanAccessUnit,
} from "./lib/auth";

async function deleteUnitCascade(ctx: MutationCtx, unitId: Id<"units">) {
  for (const p of await ctx.db
    .query("unitPrerequisites")
    .withIndex("by_unit", (q) => q.eq("unitId", unitId))
    .collect()) {
    await ctx.db.delete(p._id);
  }
  for (const p of await ctx.db
    .query("unitPrerequisites")
    .withIndex("by_prerequisite_unit", (q) =>
      q.eq("prerequisiteUnitId", unitId),
    )
    .collect()) {
    await ctx.db.delete(p._id);
  }
  const assigns = await ctx.db
    .query("assignments")
    .filter((q) => q.eq(q.field("unitId"), unitId))
    .collect();
  for (const a of assigns) {
    for (const t of await ctx.db
      .query("testResults")
      .filter((q) => q.eq(q.field("assignmentId"), a._id))
      .collect()) {
      await ctx.db.delete(t._id);
    }
    await ctx.db.delete(a._id);
  }
  for (const it of await ctx.db
    .query("contentItems")
    .filter((q) => q.eq(q.field("unitId"), unitId))
    .collect()) {
    await ctx.db.delete(it._id);
  }
  for (const pr of await ctx.db
    .query("userProgress")
    .filter((q) => q.eq(q.field("unitId"), unitId))
    .collect()) {
    await ctx.db.delete(pr._id);
  }
  await ctx.db.delete(unitId);
}

/** Cascade-delete a unit (no auth); used when removing a certification level. */
export const removeInternal = internalMutation({
  args: { unitId: v.id("units") },
  handler: async (ctx, { unitId }) => {
    const row = await ctx.db.get(unitId);
    if (!row) {
      return;
    }
    await deleteUnitCascade(ctx, unitId);
  },
});

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

export const remove = mutation({
  args: { unitId: v.id("units") },
  handler: async (ctx, { unitId }) => {
    await requireAdminOrCreator(ctx);
    const row = await ctx.db.get(unitId);
    if (!row) {
      throw new Error("Unit not found");
    }
    await deleteUnitCascade(ctx, unitId);
  },
});
