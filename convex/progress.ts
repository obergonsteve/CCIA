import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { collectContentInUnit } from "./content";
import {
  applyAssessmentContentAfterSubmit,
  applyLegacyAssignmentAfterSubmit,
  assertPreviousStepsComplete,
  assertSequentialUnitAccessForProgress,
  getOrderedStepsForUnit,
  unitStepsFullyDone,
} from "./contentProgress";
import { requireUserId } from "./lib/auth";
import { userCanAccessUnit } from "./lib/auth";
import { getIncompletePrerequisites } from "./lib/prerequisites";
import { webinarizeForLiveWorkshopUnit } from "./lib/webinarDisplayText";

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
        `Complete prerequisites first: ${missing
          .map((u) => webinarizeForLiveWorkshopUnit(u.title, u.deliveryMode))
          .join(", ")}`,
      );
    }
    const stepsOk = await unitStepsFullyDone(ctx, userId, unitId);
    if (!stepsOk) {
      throw new Error(
        "Complete every step in this unit in order (including assessments) before marking complete.",
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
        `Complete prerequisites first: ${missing
          .map((u) => webinarizeForLiveWorkshopUnit(u.title, u.deliveryMode))
          .join(", ")}`,
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
    levelId: v.optional(v.id("certificationLevels")),
  },
  handler: async (ctx, { assignmentId, answers, levelId }) => {
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
        `Complete prerequisites first: ${missing
          .map((u) => webinarizeForLiveWorkshopUnit(u.title, u.deliveryMode))
          .join(", ")}`,
      );
    }
    const steps = await getOrderedStepsForUnit(ctx, assignment.unitId);
    const stepIdx = steps.findIndex(
      (s) =>
        s.kind === "legacy_assignment" && s.assignmentId === assignmentId,
    );
    if (stepIdx < 0) {
      throw new Error("This assessment is not part of this unit’s sequence");
    }
    await assertSequentialUnitAccessForProgress(
      ctx,
      userId,
      levelId,
      assignment.unitId,
    );
    await assertPreviousStepsComplete(ctx, userId, assignment.unitId, stepIdx);

    const { score, passed, passingScore } = scoreFromAnswers(
      assignment.questions,
      answers,
      assignment.passingScore,
    );

    const completedAt = Date.now();
    await ctx.db.insert("testResults", {
      userId,
      assignmentId,
      score,
      answers,
      passed,
      completedAt,
    });

    await applyLegacyAssignmentAfterSubmit(
      ctx,
      userId,
      assignment.unitId,
      assignmentId,
      score,
      passed,
      completedAt,
    );

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
    levelId: v.optional(v.id("certificationLevels")),
  },
  handler: async (ctx, { unitId, assessmentContentId, answers, levelId }) => {
    const userId = await requireUserId(ctx);
    const ok = await userCanAccessUnit(ctx, unitId);
    if (!ok) {
      throw new Error("Forbidden");
    }
    const missing = await getIncompletePrerequisites(ctx, userId, unitId);
    if (missing.length > 0) {
      throw new Error(
        `Complete prerequisites first: ${missing
          .map((u) => webinarizeForLiveWorkshopUnit(u.title, u.deliveryMode))
          .join(", ")}`,
      );
    }
    const itemsOnUnit = await collectContentInUnit(ctx, unitId);
    if (!itemsOnUnit.some((c) => c._id === assessmentContentId)) {
      throw new Error("This assessment is not part of this unit");
    }
    const steps = await getOrderedStepsForUnit(ctx, unitId);
    const stepIdx = steps.findIndex(
      (s) => s.kind === "content" && s.contentId === assessmentContentId,
    );
    if (stepIdx < 0) {
      throw new Error("This assessment is not part of this unit’s sequence");
    }
    await assertSequentialUnitAccessForProgress(ctx, userId, levelId, unitId);
    await assertPreviousStepsComplete(ctx, userId, unitId, stepIdx);
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
    const completedAt = Date.now();
    await ctx.db.insert("testResults", {
      userId,
      assessmentContentId,
      score,
      answers,
      passed,
      completedAt,
    });
    await applyAssessmentContentAfterSubmit(
      ctx,
      userId,
      unitId,
      assessmentContentId,
      score,
      passed,
      completedAt,
    );
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
    const itemsOnUnit = await collectContentInUnit(ctx, unitId);
    if (!itemsOnUnit.some((c) => c._id === assessmentContentId)) {
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
