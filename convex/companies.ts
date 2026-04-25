import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { requireAdminOrCreator } from "./lib/auth";

const companyStatusV = v.union(
  v.literal("active"),
  v.literal("inactive"),
  v.literal("pending"),
);

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

/** Public: used by session refresh to pick up admin timezone changes (ID-only arg). */
export const getTimezone = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    const c = await ctx.db.get(companyId);
    if (!c) {
      return null;
    }
    const t = c.timezone?.trim();
    return t && t.length > 0 ? t : null;
  },
});

export const getByIdInternal = internalQuery({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    return await ctx.db.get(companyId);
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    await requireAdminOrCreator(ctx);
    return await ctx.db.insert("companies", { name: name.trim() });
  },
});

export const update = mutation({
  args: {
    companyId: v.id("companies"),
    name: v.string(),
    address: v.string(),
    email: v.string(),
    phone: v.string(),
    status: companyStatusV,
    /** `null` clears the stored date */
    joinedAt: v.union(v.number(), v.null()),
    /** IANA zone (e.g. Australia/Sydney). Empty string clears. */
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCreator(ctx);
    const row = await ctx.db.get(args.companyId);
    if (!row) {
      throw new Error("Company not found");
    }
    const tz = args.timezone.trim();
    await ctx.db.patch(args.companyId, {
      name: args.name.trim(),
      address: args.address.trim() || undefined,
      email: args.email.trim().toLowerCase() || undefined,
      phone: args.phone.trim() || undefined,
      status: args.status,
      joinedAt: args.joinedAt,
      timezone: tz.length > 0 ? tz : undefined,
    });
  },
});

export const remove = mutation({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    await requireAdminOrCreator(ctx);
    const users = await ctx.db
      .query("users")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();
    if (users.length > 0) {
      throw new Error(
        `Remove or reassign ${users.length} user(s) before deleting this company`,
      );
    }
    await ctx.db.delete(companyId);
  },
});
