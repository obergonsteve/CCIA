import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { type MutationCtx, mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { userCanAccessUnit } from "./lib/auth";
import { getIncompletePrerequisites } from "./lib/prerequisites";

function normalize(s: string) {
  return s.trim().toLowerCase();
}

type GradableQuestion = {
  id: string;
  type: "multiple_choice" | "text";
  correctAnswer?: string;
};

function scoreFromAnswers(
  questions: GradableQuestion[],
  answers: { questionId: string; value: string }[],
  passingScore: number,
) {
  let correct = 0;
  let gradable = 0;
  for (const q of questions) {
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
  const passed = score >= passingScore;
  return { score, passed, passingScore };
}

async function markUnitCompleteIfPassed(
  ctx: MutationCtx,
  userId: Id<"users">,
  unitId: Id<"units">,
) {
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
  } else {
    await ctx.db.insert("userProgress", {
      userId,
      unitId,
      completed: true,
      completedAt: now,
      lastAccessed: now,
    });
  }
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

    const { score, passed, passingScore } = scoreFromAnswers(
      assignment.questions,
      answers,
      assignment.passingScore,
    );

    await ctx.db.insert("testResults", {
      userId,
      assignmentId,
      score,
      answers,
      passed,
      completedAt: Date.now(),
    });

    if (passed) {
      await markUnitCompleteIfPassed(ctx, userId, assignment.unitId);
    }

    return { score, passed, passingScore };
  },
});

export const submitAssessmentContent = mutation({
  args: {
    unitId: v.id("units"),
    assessmentContentId: v.id("contentItems"),
    answers: v.array(
      v.object({
        questionId: v.string(),
        value: v.string(),
      }),
    ),
  },
  handler: async (ctx, { unitId, assessmentContentId, answers }) => {
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
    const link = await ctx.db
      .query("unitContents")
      .withIndex("by_unit_and_content", (q) =>
        q.eq("unitId", unitId).eq("contentId", assessmentContentId),
      )
      .unique();
    if (!link) {
      throw new Error("This assessment is not part of this unit");
    }
    const content = await ctx.db.get(assessmentContentId);
    if (
      !content ||
      (content.type !== "test" && content.type !== "assignment") ||
      !content.assessment
    ) {
      throw new Error("Invalid assessment content");
    }
    const { score, passed, passingScore } = scoreFromAnswers(
      content.assessment.questions,
      answers,
      content.assessment.passingScore,
    );
    await ctx.db.insert("testResults", {
      userId,
      assessmentContentId,
      score,
      answers,
      passed,
      completedAt: Date.now(),
    });
    if (passed) {
      await markUnitCompleteIfPassed(ctx, userId, unitId);
    }
    return { score, passed, passingScore };
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

export const myResultsForAssessmentContent = query({
  args: {
    unitId: v.id("units"),
    assessmentContentId: v.id("contentItems"),
  },
  handler: async (ctx, { unitId, assessmentContentId }) => {
    const userId = await requireUserId(ctx);
    const ok = await userCanAccessUnit(ctx, unitId);
    if (!ok) {
      return null;
    }
    const link = await ctx.db
      .query("unitContents")
      .withIndex("by_unit_and_content", (q) =>
        q.eq("unitId", unitId).eq("contentId", assessmentContentId),
      )
      .unique();
    if (!link) {
      return null;
    }
    const rows = await ctx.db
      .query("testResults")
      .withIndex("by_user_assessment_content", (q) =>
        q.eq("userId", userId).eq("assessmentContentId", assessmentContentId),
      )
      .collect();
    rows.sort((a, b) => b.completedAt - a.completedAt);
    return rows[0] ?? null;
  },
});
