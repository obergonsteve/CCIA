import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireAdminOrCreator, requireUserId } from "./lib/auth";

export const getByEmailInternal = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase().trim()))
      .unique();
  },
});

export const getByIdInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db.get(userId);
  },
});

export const createInternal = internalMutation({
  args: {
    email: v.string(),
    name: v.string(),
    passwordHash: v.string(),
    companyId: v.id("companies"),
    role: v.union(
      v.literal("operator"),
      v.literal("supervisor"),
      v.literal("admin"),
      v.literal("content_creator"),
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", {
      email: args.email.toLowerCase().trim(),
      name: args.name.trim(),
      passwordHash: args.passwordHash,
      companyId: args.companyId,
      role: args.role,
    });
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }
    /* omit passwordHash from client-facing payload */
    const { passwordHash: _omitPw, ...safe } = user;
    void _omitPw;
    return safe;
  },
});

export const recordLogin = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await ctx.db.patch(userId, { lastLogin: Date.now() });
  },
});

/** Used by Next.js login when JWT to Convex is off (no Convex JWT). */
export const recordLoginDev = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    if (process.env.JWT_AUTH_ENABLED === "true") {
      throw new Error("Forbidden");
    }
    const row = await ctx.db.get(userId);
    if (!row) {
      throw new Error("Not found");
    }
    await ctx.db.patch(userId, { lastLogin: Date.now() });
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCreator(ctx);
    const users = await ctx.db.query("users").collect();
    return users.map(({ passwordHash, ...u }) => {
      void passwordHash;
      return u;
    });
  },
});
