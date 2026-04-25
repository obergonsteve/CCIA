import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
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
    const key = email.toLowerCase().trim();
    const rows = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", key))
      .collect();
    if (rows.length === 0) {
      return null;
    }
    if (rows.length > 1) {
      throw new ConvexError(
        `Multiple users share email "${key}". Open Convex Dashboard → Data → users and delete duplicate rows.`,
      );
    }
    return rows[0] ?? null;
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
    companyId: v.optional(v.id("companies")),
    role: v.union(
      v.literal("operator"),
      v.literal("supervisor"),
      v.literal("admin"),
      v.literal("content_creator"),
    ),
  },
  handler: async (ctx, args) => {
    const accountType: "member" | "student" =
      args.companyId != null ? "member" : "student";
    return await ctx.db.insert("users", {
      email: args.email.toLowerCase().trim(),
      name: args.name.trim(),
      passwordHash: args.passwordHash,
      accountType,
      ...(args.companyId !== undefined
        ? { companyId: args.companyId }
        : {}),
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

/** Admin: **student** accounts (tagged `accountType: "student"` and/or legacy no `companyId`). */
export const listWithoutCompany = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCreator(ctx);
    const fromIndex = await ctx.db
      .query("users")
      .withIndex("by_account_type", (q) => q.eq("accountType", "student"))
      .collect();
    const byId = new Map<Id<"users">, (typeof fromIndex)[0]>();
    for (const u of fromIndex) {
      byId.set(u._id, u);
    }
    for (const u of await ctx.db.query("users").collect()) {
      if (u.accountType == null && u.companyId == null && !byId.has(u._id)) {
        byId.set(u._id, u);
      }
    }
    return [...byId.values()]
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
    companyId: v.union(v.id("companies"), v.null()),
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
      ...(args.companyId == null
        ? { companyId: undefined, accountType: "student" as const }
        : { companyId: args.companyId, accountType: "member" as const }),
    });
  },
});

/** One-time: set `accountType` from `companyId` for all existing user rows. */
export const backfillAccountType = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCreator(ctx);
    const all = await ctx.db.query("users").collect();
    let updated = 0;
    for (const u of all) {
      const next: "member" | "student" =
        u.companyId == null ? "student" : "member";
      if (u.accountType !== next) {
        await ctx.db.patch(u._id, { accountType: next });
        updated += 1;
      }
    }
    return { updated, total: all.length };
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
