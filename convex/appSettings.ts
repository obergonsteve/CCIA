import { v } from "convex/values";
import {
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { authModeValidator, getEffectiveAuthModeInConvex } from "./lib/authMode";
import { requireAdminOrCreator, requireUserId } from "./lib/auth";

export const getAppSettingsRow = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("appSettings").first();
  },
});

export const getEffectiveModeInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("appSettings").first();
    return getEffectiveAuthModeInConvex(ctx, row);
  },
});

export const getAuthModeForUi = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("appSettings").first();
    const effective = await getEffectiveAuthModeInConvex(ctx, row);
    return {
      effectiveMode: effective,
      storedMode: row?.authMode ?? null,
      updatedAt: row?.updatedAt ?? null,
    };
  },
});

export const setAuthMode = mutation({
  args: { authMode: authModeValidator },
  handler: async (ctx, { authMode }) => {
    await requireAdminOrCreator(ctx);
    const userId = await requireUserId(ctx);
    const existing = await ctx.db.query("appSettings").first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        authMode,
        updatedAt: now,
        updatedByUserId: userId,
      });
    } else {
      await ctx.db.insert("appSettings", {
        authMode,
        updatedAt: now,
        updatedByUserId: userId,
      });
    }
  },
});
