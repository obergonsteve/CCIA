import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  requireAdminOrCreator,
  requireUserId,
  userCanAccessUnit,
} from "./lib/auth";

const questionValidator = v.object({
  id: v.string(),
  question: v.string(),
  type: v.union(v.literal("multiple_choice"), v.literal("text")),
  options: v.optional(v.array(v.string())),
  correctAnswer: v.optional(v.string()),
});

export const listByUnit = query({
  args: { unitId: v.id("units") },
  handler: async (ctx, { unitId }) => {
    await requireUserId(ctx);
    const ok = await userCanAccessUnit(ctx, unitId);
    if (!ok) {
      return [];
    }
    return await ctx.db
      .query("assignments")
      .filter((q) => q.eq(q.field("unitId"), unitId))
      .collect();
  },
});

export const get = query({
  args: { assignmentId: v.id("assignments") },
  handler: async (ctx, { assignmentId }) => {
    await requireUserId(ctx);
    const a = await ctx.db.get(assignmentId);
    if (!a) {
      return null;
    }
    const ok = await userCanAccessUnit(ctx, a.unitId);
    return ok ? a : null;
  },
});

export const create = mutation({
  args: {
    unitId: v.id("units"),
    title: v.string(),
    description: v.string(),
    questions: v.array(questionValidator),
    passingScore: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCreator(ctx);
    return await ctx.db.insert("assignments", args);
  },
});

export const update = mutation({
  args: {
    assignmentId: v.id("assignments"),
    title: v.string(),
    description: v.string(),
    questions: v.array(questionValidator),
    passingScore: v.number(),
  },
  handler: async (ctx, { assignmentId, ...fields }) => {
    await requireAdminOrCreator(ctx);
    await ctx.db.patch(assignmentId, fields);
  },
});

export const remove = mutation({
  args: { assignmentId: v.id("assignments") },
  handler: async (ctx, { assignmentId }) => {
    await requireAdminOrCreator(ctx);
    await ctx.db.delete(assignmentId);
  },
});
