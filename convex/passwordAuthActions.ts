"use node";

import { v } from "convex/values";
import bcrypt from "bcryptjs";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

/** §4 — register (bcrypt in Convex action). Legacy + Convex Auth registration flows. */
export const register = action({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
    companyId: v.id("companies"),
  },
  handler: async (ctx, args): Promise<Id<"users">> => {
    const existing = await ctx.runQuery(internal.users.getByEmailInternal, {
      email: args.email,
    });
    if (existing) {
      throw new Error("User with this email already exists");
    }
    const passwordHash = await bcrypt.hash(args.password, 10);
    return await ctx.runMutation(internal.users.createInternal, {
      email: args.email,
      name: args.name,
      passwordHash,
      companyId: args.companyId,
      role: "operator",
    });
  },
});

export type LoginResult = {
  userId: Id<"users">;
  email: string;
  name: string;
  /** Omitted for student (non-member) accounts. */
  companyId?: Id<"companies">;
  role: "operator" | "supervisor" | "admin" | "content_creator";
  avatarUrl?: string;
  lastLogin?: number;
  /** IANA time zone from `companies.timezone` for session display. */
  companyTimezone?: string;
} | null;

/** §4 — login (credential check; cookie set in Next.js API route when in legacy mode). */
export const login = action({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { email, password }): Promise<LoginResult> => {
    const user = (await ctx.runQuery(internal.users.getByEmailInternal, {
      email,
    })) as Doc<"users"> | null;
    if (!user) {
      return null;
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return null;
    }
    const company = user.companyId
      ? await ctx.runQuery(internal.companies.getByIdInternal, {
          companyId: user.companyId,
        })
      : null;
    const companyTimezone =
      company?.timezone && typeof company.timezone === "string"
        ? company.timezone.trim() || undefined
        : undefined;
    return {
      userId: user._id,
      email: user.email,
      name: user.name,
      ...(user.companyId != null ? { companyId: user.companyId } : {}),
      role: user.role,
      avatarUrl: user.avatarUrl,
      lastLogin: user.lastLogin,
      companyTimezone,
    };
  },
});

export const adminCreateUser = action({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
    /** Omit for a **student** (non-member) account. */
    companyId: v.optional(v.id("companies")),
    role: v.union(
      v.literal("operator"),
      v.literal("supervisor"),
      v.literal("admin"),
      v.literal("content_creator"),
    ),
  },
  handler: async (ctx, args): Promise<Id<"users">> => {
    const mode = await ctx.runQuery(internal.appSettings.getEffectiveModeInternal, {});
    let admin: Doc<"users"> | null;
    if (mode === "convex") {
      const uid = await getAuthUserId(ctx);
      if (uid === null) {
        throw new Error("Forbidden");
      }
      admin = await ctx.runQuery(internal.users.getByIdInternal, { userId: uid });
    } else {
      const adminUserId = await ctx.runQuery(
        internal.users.resolveDeploymentUserIdInternal,
        {},
      );
      admin = await ctx.runQuery(internal.users.getByIdInternal, {
        userId: adminUserId,
      });
    }
    if (
      !admin ||
      (admin.role !== "admin" && admin.role !== "content_creator")
    ) {
      throw new Error("Forbidden");
    }
    const existing = await ctx.runQuery(internal.users.getByEmailInternal, {
      email: args.email,
    });
    if (existing) {
      throw new Error("User with this email already exists");
    }
    const passwordHash = await bcrypt.hash(args.password, 10);
    return await ctx.runMutation(internal.users.createInternal, {
      email: args.email,
      name: args.name,
      passwordHash,
      role: args.role,
      ...(args.companyId != null ? { companyId: args.companyId } : {}),
    });
  },
});

export const adminSetPassword = action({
  args: { userId: v.id("users"), password: v.string() },
  handler: async (ctx, { userId, password }): Promise<void> => {
    const mode = await ctx.runQuery(internal.appSettings.getEffectiveModeInternal, {});
    let admin: Doc<"users"> | null;
    if (mode === "convex") {
      const uid = await getAuthUserId(ctx);
      if (uid === null) {
        throw new Error("Forbidden");
      }
      admin = await ctx.runQuery(internal.users.getByIdInternal, { userId: uid });
    } else {
      const adminUserId = await ctx.runQuery(
        internal.users.resolveDeploymentUserIdInternal,
        {},
      );
      admin = await ctx.runQuery(internal.users.getByIdInternal, {
        userId: adminUserId,
      });
    }
    if (
      !admin ||
      (admin.role !== "admin" && admin.role !== "content_creator")
    ) {
      throw new Error("Forbidden");
    }
    const target = await ctx.runQuery(internal.users.getByIdInternal, {
      userId,
    });
    if (!target) {
      throw new Error("User not found");
    }
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await ctx.runMutation(internal.users.patchPasswordInternal, {
      userId,
      passwordHash,
    });
  },
});
