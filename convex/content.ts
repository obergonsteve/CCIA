import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  requireAdminOrCreator,
  requireUserId,
  userCanAccessUnit,
} from "./lib/auth";

export const listByUnit = query({
  args: { unitId: v.id("units") },
  handler: async (ctx, { unitId }) => {
    await requireUserId(ctx);
    const ok = await userCanAccessUnit(ctx, unitId);
    if (!ok) {
      return [];
    }
    const items = await ctx.db
      .query("contentItems")
      .filter((q) => q.eq(q.field("unitId"), unitId))
      .collect();
    return items.sort((a, b) => a.order - b.order);
  },
});

export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    await requireUserId(ctx);
    return await ctx.storage.getUrl(storageId);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCreator(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    unitId: v.id("units"),
    type: v.union(
      v.literal("video"),
      v.literal("slideshow"),
      v.literal("link"),
      v.literal("pdf"),
    ),
    title: v.string(),
    url: v.string(),
    storageId: v.optional(v.id("_storage")),
    duration: v.optional(v.number()),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCreator(ctx);
    return await ctx.db.insert("contentItems", args);
  },
});

export const update = mutation({
  args: {
    contentId: v.id("contentItems"),
    title: v.string(),
    url: v.string(),
    type: v.union(
      v.literal("video"),
      v.literal("slideshow"),
      v.literal("link"),
      v.literal("pdf"),
    ),
    storageId: v.optional(v.id("_storage")),
    duration: v.optional(v.number()),
    order: v.number(),
  },
  handler: async (ctx, { contentId, ...fields }) => {
    await requireAdminOrCreator(ctx);
    await ctx.db.patch(contentId, fields);
  },
});

export const remove = mutation({
  args: { contentId: v.id("contentItems") },
  handler: async (ctx, { contentId }) => {
    await requireAdminOrCreator(ctx);
    await ctx.db.delete(contentId);
  },
});
