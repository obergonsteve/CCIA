import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdminOrCreator } from "./lib/auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCreator(ctx);
    return await ctx.db.query("companies").collect();
  },
});

export const listForRegister = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("companies").collect();
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    await requireAdminOrCreator(ctx);
    return await ctx.db.insert("companies", { name: name.trim() });
  },
});
