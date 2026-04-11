import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireAdminOrCreator } from "./lib/auth";
import { isLive } from "./lib/softDelete";

export const listAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCreator(ctx);
    const rows = await ctx.db.query("contentCategories").collect();
    return rows.sort((a, b) => {
      const o = a.sortOrder - b.sortOrder;
      if (o !== 0) {
        return o;
      }
      return a.shortCode.localeCompare(b.shortCode);
    });
  },
});

async function nextSortOrder(ctx: MutationCtx): Promise<number> {
  const rows = await ctx.db.query("contentCategories").collect();
  const max = rows.reduce((m, r) => Math.max(m, r.sortOrder), -1);
  return max + 1;
}

export const create = mutation({
  args: {
    shortCode: v.string(),
    longDescription: v.string(),
  },
  handler: async (ctx, { shortCode, longDescription }) => {
    await requireAdminOrCreator(ctx);
    const code = shortCode.trim();
    const desc = longDescription.trim();
    if (!code) {
      throw new Error("Short code is required");
    }
    if (!desc) {
      throw new Error("Long description is required");
    }
    const dup = await ctx.db
      .query("contentCategories")
      .withIndex("by_short_code", (q) => q.eq("shortCode", code))
      .first();
    if (dup) {
      throw new Error("A category with that short code already exists");
    }
    const sortOrder = await nextSortOrder(ctx);
    return await ctx.db.insert("contentCategories", {
      shortCode: code,
      longDescription: desc,
      sortOrder,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("contentCategories"),
    shortCode: v.optional(v.string()),
    longDescription: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, { id, shortCode, longDescription, sortOrder }) => {
    await requireAdminOrCreator(ctx);
    const row = await ctx.db.get(id);
    if (!row) {
      throw new Error("Category not found");
    }
    const patch: Record<string, unknown> = {};
    if (shortCode !== undefined) {
      const code = shortCode.trim();
      if (!code) {
        throw new Error("Short code cannot be empty");
      }
      const dup = await ctx.db
        .query("contentCategories")
        .withIndex("by_short_code", (q) => q.eq("shortCode", code))
        .first();
      if (dup && dup._id !== id) {
        throw new Error("Another category already uses that short code");
      }
      patch.shortCode = code;
    }
    if (longDescription !== undefined) {
      const d = longDescription.trim();
      if (!d) {
        throw new Error("Long description cannot be empty");
      }
      patch.longDescription = d;
    }
    if (sortOrder !== undefined) {
      patch.sortOrder = sortOrder;
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(id, patch);
    }
  },
});

export const remove = mutation({
  args: { id: v.id("contentCategories") },
  handler: async (ctx, { id }) => {
    await requireAdminOrCreator(ctx);
    for (const row of await ctx.db
      .query("contentItems")
      .withIndex("by_content_category", (q) => q.eq("contentCategoryId", id))
      .collect()) {
      if (isLive(row)) {
        throw new Error("Cannot delete: one or more content items use this category");
      }
    }
    await ctx.db.delete(id);
  },
});
