import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { userCanAccessUnit } from "./lib/auth";
import { getIncompletePrerequisites } from "./lib/prerequisites";

function normalize(s: string) {
  return s.trim().toLowerCase();
}

export const getForUserAndUnit = query({
  args: { unitId: v.id("units") },
  handler: async (ctx, { unitId }) => {
    const userId = await requireUserId(ctx);
    const ok = await userCanAccessUnit(ctx, unitId);
    if (!ok) {
      return null;
    }
    return await ctx.db
      .query("userProgress")
      .withIndex("by_user_unit", (q) =>
        q.eq("userId", userId).eq("unitId", unitId),
      )
      .unique();
  },
});

export const listForUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("userProgress")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
  },
});

export const markUnitComplete = mutation({
  args: { unitId: v.id("units") },
  handler: async (ctx, { unitId }) => {
    const userId = await requireUserId(ctx);
    const ok = await userCanAccessUnit(ctx, unitId);
    if (!ok) {
      throw new Error("Forbidden");
    }
    const missing = await getIncompletePrerequisites(ctx, userId, unitId);
    if (missing.length > 0) {
      throw new Error(
        `Complete prerequisites first: ${missing.map((u) => u.title).join(", ")}`,
      );
    }
    const now = Date.now();
    const existing = await ctx.db
      .query("userProgress")
      .withIndex("by_user_unit", (q) =>
        q.eq("userId", userId).eq("unitId", unitId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        completed: true,
        completedAt: now,
        lastAccessed: now,
      });
      return existing._id;
    }
    return await ctx.db.insert("userProgress", {
      userId,
      unitId,
      completed: true,
      completedAt: now,
      lastAccessed: now,
    });
  },
});

export const touchUnit = mutation({
  args: { unitId: v.id("units") },
  handler: async (ctx, { unitId }) => {
    const userId = await requireUserId(ctx);
    const ok = await userCanAccessUnit(ctx, unitId);
    if (!ok) {
      return;
    }
    const missing = await getIncompletePrerequisites(ctx, userId, unitId);
    if (missing.length > 0) {
      throw new Error(
        `Complete prerequisites first: ${missing.map((u) => u.title).join(", ")}`,
      );
    }
    const now = Date.now();
    const existing = await ctx.db
      .query("userProgress")
      .withIndex("by_user_unit", (q) =>
        q.eq("userId", userId).eq("unitId", unitId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { lastAccessed: now });
      return;
    }
    await ctx.db.insert("userProgress", {
      userId,
      unitId,
      completed: false,
      lastAccessed: now,
    });
  },
});

export const submitAssignment = mutation({
  args: {
    assignmentId: v.id("assignments"),
    answers: v.array(
      v.object({
        questionId: v.string(),
        value: v.string(),
      }),
    ),
  },
  handler: async (ctx, { assignmentId, answers }) => {
    const userId = await requireUserId(ctx);
    const assignment = await ctx.db.get(assignmentId);
    if (!assignment) {
      throw new Error("Assignment not found");
    }
    const ok = await userCanAccessUnit(ctx, assignment.unitId);
    if (!ok) {
      throw new Error("Forbidden");
    }
    const missing = await getIncompletePrerequisites(
      ctx,
      userId,
      assignment.unitId,
    );
    if (missing.length > 0) {
      throw new Error(
        `Complete prerequisites first: ${missing.map((u) => u.title).join(", ")}`,
      );
    }

    let correct = 0;
    let gradable = 0;
    for (const q of assignment.questions) {
      const ans = answers.find((a) => a.questionId === q.id);
      if (q.type === "multiple_choice" && q.correctAnswer) {
        gradable += 1;
        if (
          ans &&
          normalize(ans.value) === normalize(q.correctAnswer)
        ) {
          correct += 1;
        }
      } else if (q.type === "text" && q.correctAnswer) {
        gradable += 1;
        if (
          ans &&
          normalize(ans.value) === normalize(q.correctAnswer)
        ) {
          correct += 1;
        }
      }
    }

    const score =
      gradable > 0 ? Math.round((correct / gradable) * 100) : 100;
    const passed = score >= assignment.passingScore;

    await ctx.db.insert("testResults", {
      userId,
      assignmentId,
      score,
      answers,
      passed,
      completedAt: Date.now(),
    });

    if (passed) {
      const now = Date.now();
      const existing = await ctx.db
        .query("userProgress")
        .withIndex("by_user_unit", (q) =>
          q.eq("userId", userId).eq("unitId", assignment.unitId),
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          completed: true,
          completedAt: now,
          lastAccessed: now,
        });
      } else {
        await ctx.db.insert("userProgress", {
          userId,
          unitId: assignment.unitId,
          completed: true,
          completedAt: now,
          lastAccessed: now,
        });
      }
    }

    return { score, passed, passingScore: assignment.passingScore };
  },
});

export const myResultsForAssignment = query({
  args: { assignmentId: v.id("assignments") },
  handler: async (ctx, { assignmentId }) => {
    const userId = await requireUserId(ctx);
    const assignment = await ctx.db.get(assignmentId);
    if (!assignment) {
      return null;
    }
    const ok = await userCanAccessUnit(ctx, assignment.unitId);
    if (!ok) {
      return null;
    }
    const rows = await ctx.db
      .query("testResults")
      .withIndex("by_user_assignment", (q) =>
        q.eq("userId", userId).eq("assignmentId", assignmentId),
      )
      .collect();
    rows.sort((a, b) => b.completedAt - a.completedAt);
    return rows[0] ?? null;
  },
});
