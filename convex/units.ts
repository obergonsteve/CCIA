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
  for (const row of await ctx.db
    .query("unitContents")
    .withIndex("by_unit", (q) => q.eq("unitId", unitId))
    .collect()) {
    await ctx.db.delete(row._id);
  }
  for (const row of await ctx.db
    .query("certificationUnits")
    .withIndex("by_unit", (q) => q.eq("unitId", unitId))
    .collect()) {
    await ctx.db.delete(row._id);
  }
  for (const pr of await ctx.db
    .query("userProgress")
    .filter((q) => q.eq(q.field("unitId"), unitId))
    .collect()) {
    await ctx.db.delete(pr._id);
  }
  await ctx.db.delete(unitId);
}

/** Cascade-delete a unit (no auth); used internally. */
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

export type UnitAdminListRow = {
  _id: Id<"units">;
  _creationTime: number;
  title: string;
  description: string;
  certificationSummary: string;
};

export const listAllAdmin = query({
  args: {},
  handler: async (ctx): Promise<UnitAdminListRow[]> => {
    await requireAdminOrCreator(ctx);
    const all = await ctx.db.query("units").collect();
    const out: UnitAdminListRow[] = [];
    for (const u of all) {
      const links = await ctx.db
        .query("certificationUnits")
        .withIndex("by_unit", (q) => q.eq("unitId", u._id))
        .collect();
      const names: string[] = [];
      for (const link of links) {
        const lev = await ctx.db.get(link.levelId);
        if (lev) {
          names.push(lev.name);
        }
      }
      if (links.length === 0 && u.levelId) {
        const lev = await ctx.db.get(u.levelId);
        if (lev) {
          names.push(lev.name);
        }
      }
      names.sort((a, b) => a.localeCompare(b));
      out.push({
        _id: u._id,
        _creationTime: u._creationTime,
        title: u.title,
        description: u.description,
        certificationSummary: names.length ? names.join(", ") : "—",
      });
    }
    out.sort((a, b) => a.title.localeCompare(b.title));
    return out;
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
    const links = await ctx.db
      .query("certificationUnits")
      .withIndex("by_level", (q) => q.eq("levelId", levelId))
      .collect();
    if (links.length > 0) {
      links.sort((a, b) => a.order - b.order);
      const units = [];
      for (const link of links) {
        const u = await ctx.db.get(link.unitId);
        if (u) {
          units.push(u);
        }
      }
      return units;
    }
    const legacy = await ctx.db
      .query("units")
      .filter((q) => q.eq(q.field("levelId"), levelId))
      .collect();
    return legacy.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
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
    title: v.string(),
    description: v.string(),
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
  },
  handler: async (ctx, { unitId, ...fields }) => {
    await requireAdminOrCreator(ctx);
    await ctx.db.patch(unitId, fields);
  },
});

export const addUnitToLevel = mutation({
  args: {
    levelId: v.id("certificationLevels"),
    unitId: v.id("units"),
  },
  handler: async (ctx, { levelId, unitId }) => {
    await requireAdminOrCreator(ctx);
    const existing = await ctx.db
      .query("certificationUnits")
      .withIndex("by_level_and_unit", (q) =>
        q.eq("levelId", levelId).eq("unitId", unitId),
      )
      .unique();
    if (existing) {
      throw new Error("This unit is already in this certification");
    }
    const inLevel = await ctx.db
      .query("certificationUnits")
      .withIndex("by_level", (q) => q.eq("levelId", levelId))
      .collect();
    const nextOrder =
      inLevel.length === 0
        ? 0
        : Math.max(...inLevel.map((r) => r.order)) + 1;
    return await ctx.db.insert("certificationUnits", {
      levelId,
      unitId,
      order: nextOrder,
    });
  },
});

export const removeUnitFromLevel = mutation({
  args: {
    levelId: v.id("certificationLevels"),
    unitId: v.id("units"),
  },
  handler: async (ctx, { levelId, unitId }) => {
    await requireAdminOrCreator(ctx);
    const row = await ctx.db
      .query("certificationUnits")
      .withIndex("by_level_and_unit", (q) =>
        q.eq("levelId", levelId).eq("unitId", unitId),
      )
      .unique();
    if (!row) {
      return;
    }
    await ctx.db.delete(row._id);
    const rest = await ctx.db
      .query("certificationUnits")
      .withIndex("by_level", (q) => q.eq("levelId", levelId))
      .collect();
    rest.sort((a, b) => a.order - b.order);
    for (let i = 0; i < rest.length; i++) {
      await ctx.db.patch(rest[i]!._id, { order: i });
    }
  },
});

export const reorderUnitsInLevel = mutation({
  args: {
    levelId: v.id("certificationLevels"),
    orderedUnitIds: v.array(v.id("units")),
  },
  handler: async (ctx, { levelId, orderedUnitIds }) => {
    await requireAdminOrCreator(ctx);
    const links = await ctx.db
      .query("certificationUnits")
      .withIndex("by_level", (q) => q.eq("levelId", levelId))
      .collect();
    const byUnit = new Map(links.map((l) => [l.unitId, l] as const));
    for (let i = 0; i < orderedUnitIds.length; i++) {
      const link = byUnit.get(orderedUnitIds[i]!);
      if (link) {
        await ctx.db.patch(link._id, { order: i });
      }
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
