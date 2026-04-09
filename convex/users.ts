import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  requireAdminOrCreator,
  requireUserId,
  resolveDeploymentUserId,
} from "./lib/auth";

export const resolveDeploymentUserIdInternal = internalQuery({
  args: {},
  handler: async (ctx) => resolveDeploymentUserId(ctx),
});

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

/** Called from Next.js after login/register so `lastLogin` matches the signed-in user. */
export const recordLoginDev = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
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

export const listByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    await requireAdminOrCreator(ctx);
    const rows = await ctx.db
      .query("users")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();
    return rows
      .map(({ passwordHash, ...u }) => {
        void passwordHash;
        return u;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const adminUpdateProfile = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    email: v.string(),
    role: v.union(
      v.literal("operator"),
      v.literal("supervisor"),
      v.literal("admin"),
      v.literal("content_creator"),
    ),
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCreator(ctx);
    const row = await ctx.db.get(args.userId);
    if (!row) {
      throw new Error("User not found");
    }
    const email = args.email.toLowerCase().trim();
    if (email !== row.email) {
      const clash = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();
      if (clash && clash._id !== args.userId) {
        throw new Error("Another user already uses that email");
      }
    }
    await ctx.db.patch(args.userId, {
      name: args.name.trim(),
      email,
      role: args.role,
      companyId: args.companyId,
    });
  },
});

export const patchPasswordInternal = internalMutation({
  args: {
    userId: v.id("users"),
    passwordHash: v.string(),
  },
  handler: async (ctx, { userId, passwordHash }) => {
    await ctx.db.patch(userId, { passwordHash });
  },
});

export const adminDelete = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireAdminOrCreator(ctx);
    const row = await ctx.db.get(userId);
    if (!row) {
      throw new Error("User not found");
    }
    for (const p of await ctx.db
      .query("userProgress")
      .withIndex("by_user_unit", (q) => q.eq("userId", userId))
      .collect()) {
      await ctx.db.delete(p._id);
    }
    for (const t of await ctx.db
      .query("testResults")
      .withIndex("by_user_assignment", (q) => q.eq("userId", userId))
      .collect()) {
      await ctx.db.delete(t._id);
    }
    await ctx.db.delete(userId);
  },
});
