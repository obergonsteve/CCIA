import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireAdminOrCreator } from "./lib/auth";

function byDeletedAtDesc<T extends { deletedAt?: number }>(a: T, b: T) {
  return (b.deletedAt ?? 0) - (a.deletedAt ?? 0);
}

/** Certifications soft-deleted from admin (still in DB). */
export const listDeletedCertifications = query({
  args: {},
  handler: async (ctx): Promise<Doc<"certificationLevels">[]> => {
    await requireAdminOrCreator(ctx);
    return (await ctx.db.query("certificationLevels").collect())
      .filter((l) => l.deletedAt != null)
      .sort(byDeletedAtDesc);
  },
});

/** Units soft-deleted from admin (still in DB). */
export const listDeletedUnits = query({
  args: {},
  handler: async (ctx): Promise<Doc<"units">[]> => {
    await requireAdminOrCreator(ctx);
    return (await ctx.db.query("units").collect())
      .filter((u) => u.deletedAt != null)
      .sort(byDeletedAtDesc);
  },
});

/** Library content soft-deleted from admin (still in DB). */
export const listDeletedContent = query({
  args: {},
  handler: async (ctx): Promise<Doc<"contentItems">[]> => {
    await requireAdminOrCreator(ctx);
    return (await ctx.db.query("contentItems").collect())
      .filter((c) => c.deletedAt != null)
      .sort(byDeletedAtDesc);
  },
});

export const restoreCertificationLevel = mutation({
  args: { levelId: v.id("certificationLevels") },
  handler: async (ctx, { levelId }) => {
    await requireAdminOrCreator(ctx);
    const row = await ctx.db.get(levelId);
    if (!row || row.deletedAt == null) {
      throw new Error("Not a deleted certification");
    }
    await ctx.db.patch(levelId, { deletedAt: undefined });
  },
});

export const restoreUnit = mutation({
  args: { unitId: v.id("units") },
  handler: async (ctx, { unitId }) => {
    await requireAdminOrCreator(ctx);
    const row = await ctx.db.get(unitId);
    if (!row || row.deletedAt == null) {
      throw new Error("Not a deleted unit");
    }
    await ctx.db.patch(unitId, { deletedAt: undefined });
  },
});

export const restoreContentItem = mutation({
  args: { contentId: v.id("contentItems") },
  handler: async (ctx, { contentId }) => {
    await requireAdminOrCreator(ctx);
    const row = await ctx.db.get(contentId);
    if (!row || row.deletedAt == null) {
      throw new Error("Not a deleted content item");
    }
    await ctx.db.patch(contentId, { deletedAt: undefined });
  },
});
