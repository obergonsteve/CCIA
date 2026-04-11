import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  type MutationCtx,
  type QueryCtx,
  mutation,
  query,
} from "./_generated/server";
import { collectContentInUnit, type ContentInUnit } from "./content";
import { collectUnitsForLevel } from "./units";
import { requireUserId, userCanAccessLevel, userCanAccessUnit } from "./lib/auth";
import { getIncompletePrerequisites } from "./lib/prerequisites";

export type UnitStep =
  | {
      kind: "content";
      order: number;
      contentId: Id<"contentItems">;
      title: string;
      contentType: ContentInUnit["type"];
      isAssessment: boolean;
    }
  | {
      kind: "legacy_assignment";
      order: number;
      assignmentId: Id<"assignments">;
      title: string;
      isAssessment: true;
    };

function isAssessmentContent(c: ContentInUnit): boolean {
  return c.type === "test" || c.type === "assignment";
}

export async function getOrderedStepsForUnit(
  ctx: QueryCtx,
  unitId: Id<"units">,
): Promise<UnitStep[]> {
  const items = await collectContentInUnit(ctx, unitId);
  const assigns = await ctx.db
    .query("assignments")
    .filter((q) => q.eq(q.field("unitId"), unitId))
    .collect();
  assigns.sort((a, b) => a.title.localeCompare(b.title));
  const steps: UnitStep[] = items.map((c, i) => ({
    kind: "content" as const,
    order: i,
    contentId: c._id,
    title: c.title,
    contentType: c.type,
    isAssessment: isAssessmentContent(c),
  }));
  const base = items.length;
  for (let j = 0; j < assigns.length; j++) {
    const a = assigns[j]!;
    steps.push({
      kind: "legacy_assignment",
      order: base + j,
      assignmentId: a._id,
      title: a.title,
      isAssessment: true,
    });
  }
  return steps;
}

async function latestAssignmentResult(
  ctx: QueryCtx,
  userId: Id<"users">,
  assignmentId: Id<"assignments">,
) {
  const rows = await ctx.db
    .query("testResults")
    .withIndex("by_user_assignment", (q) =>
      q.eq("userId", userId).eq("assignmentId", assignmentId),
    )
    .collect();
  rows.sort((a, b) => b.completedAt - a.completedAt);
  return rows[0] ?? null;
}

async function latestAssessmentContentResult(
  ctx: QueryCtx,
  userId: Id<"users">,
  contentId: Id<"contentItems">,
) {
  const rows = await ctx.db
    .query("testResults")
    .withIndex("by_user_assessment_content", (q) =>
      q.eq("userId", userId).eq("assessmentContentId", contentId),
    )
    .collect();
  rows.sort((a, b) => b.completedAt - a.completedAt);
  return rows[0] ?? null;
}

async function contentStepDone(
  ctx: QueryCtx,
  userId: Id<"users">,
  unitId: Id<"units">,
  contentId: Id<"contentItems">,
  item: ContentInUnit,
): Promise<boolean> {
  if (isAssessmentContent(item)) {
    const last = await latestAssessmentContentResult(ctx, userId, contentId);
    return last?.passed === true;
  }
  const row = await ctx.db
    .query("userContentProgress")
    .withIndex("by_user_unit_content", (q) =>
      q.eq("userId", userId).eq("unitId", unitId).eq("contentId", contentId),
    )
    .unique();
  return (
    row?.completedAt != null &&
    (row.outcome === "completed" || row.outcome === "passed")
  );
}

async function legacyAssignmentStepDone(
  ctx: QueryCtx,
  userId: Id<"users">,
  assignmentId: Id<"assignments">,
): Promise<boolean> {
  const last = await latestAssignmentResult(ctx, userId, assignmentId);
  return last?.passed === true;
}

export async function assertPreviousStepsComplete(
  ctx: QueryCtx,
  userId: Id<"users">,
  unitId: Id<"units">,
  stepIndex: number,
) {
  const steps = await getOrderedStepsForUnit(ctx, unitId);
  const items = await collectContentInUnit(ctx, unitId);
  const byContentId = new Map(items.map((c) => [c._id, c] as const));
  for (let i = 0; i < stepIndex; i++) {
    const s = steps[i]!;
    if (s.kind === "content") {
      const doc = byContentId.get(s.contentId);
      if (!doc) {
        throw new Error("Invalid content step");
      }
      const ok = await contentStepDone(ctx, userId, unitId, s.contentId, doc);
      if (!ok) {
        throw new Error(`Complete step ${i + 1} (“${s.title}”) before continuing.`);
      }
    } else {
      const ok = await legacyAssignmentStepDone(ctx, userId, s.assignmentId);
      if (!ok) {
        throw new Error(`Complete step ${i + 1} (“${s.title}”) before continuing.`);
      }
    }
  }
}

export async function assertSequentialUnitAccess(
  ctx: QueryCtx,
  userId: Id<"users">,
  levelId: Id<"certificationLevels"> | undefined,
  unitId: Id<"units">,
) {
  if (!levelId) {
    return;
  }
  const units = await collectUnitsForLevel(ctx, levelId);
  const idx = units.findIndex((u) => u._id === unitId);
  if (idx <= 0) {
    return;
  }
  for (let i = 0; i < idx; i++) {
    const prev = units[i]!;
    const prog = await ctx.db
      .query("userProgress")
      .withIndex("by_user_unit", (q) =>
        q.eq("userId", userId).eq("unitId", prev._id),
      )
      .unique();
    if (!prog?.completed) {
      throw new Error(
        `Complete “${prev.title}” in this certification before this unit.`,
      );
    }
  }
}

async function logProgressEvent(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    unitId: Id<"units">;
    contentId?: Id<"contentItems">;
    assignmentId?: Id<"assignments">;
    kind: "start" | "complete" | "assessment_attempt";
    at: number;
    durationMs?: number;
    score?: number;
    passed?: boolean;
  },
) {
  await ctx.db.insert("contentProgressEvents", args);
}

export async function unitStepsFullyDone(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  unitId: Id<"units">,
): Promise<boolean> {
  const steps = await getOrderedStepsForUnit(ctx, unitId);
  if (steps.length === 0) {
    return true;
  }
  const items = await collectContentInUnit(ctx, unitId);
  const byContentId = new Map(items.map((c) => [c._id, c] as const));
  for (const s of steps) {
    if (s.kind === "content") {
      const doc = byContentId.get(s.contentId);
      if (!doc) {
        return false;
      }
      const ok = await contentStepDone(ctx, userId, unitId, s.contentId, doc);
      if (!ok) {
        return false;
      }
    } else {
      const ok = await legacyAssignmentStepDone(ctx, userId, s.assignmentId);
      if (!ok) {
        return false;
      }
    }
  }
  return true;
}

/** When all ordered steps are satisfied, mark the unit complete in `userProgress`. */
export async function syncUnitCompletion(
  ctx: MutationCtx,
  userId: Id<"users">,
  unitId: Id<"units">,
) {
  const steps = await getOrderedStepsForUnit(ctx, unitId);
  if (steps.length === 0) {
    return;
  }
  const items = await collectContentInUnit(ctx, unitId);
  const byContentId = new Map(items.map((c) => [c._id, c] as const));
  for (const s of steps) {
    if (s.kind === "content") {
      const doc = byContentId.get(s.contentId);
      if (!doc) {
        return;
      }
      const ok = await contentStepDone(ctx, userId, unitId, s.contentId, doc);
      if (!ok) {
        return;
      }
    } else {
      const ok = await legacyAssignmentStepDone(ctx, userId, s.assignmentId);
      if (!ok) {
        return;
      }
    }
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

export const roadmapForUnit = query({
  args: {
    unitId: v.id("units"),
    levelId: v.optional(v.id("certificationLevels")),
  },
  handler: async (ctx, { unitId, levelId }) => {
    const userId = await requireUserId(ctx);
    const ok = await userCanAccessUnit(ctx, unitId);
    if (!ok) {
      return null;
    }
    const prereqs = await getIncompletePrerequisites(ctx, userId, unitId);
    let sequentialUnitBlocked: string | null = null;
    if (levelId) {
      const levelOk = await userCanAccessLevel(ctx, levelId);
      if (!levelOk) {
        return null;
      }
      try {
        await assertSequentialUnitAccess(ctx, userId, levelId, unitId);
      } catch (e) {
        sequentialUnitBlocked =
          e instanceof Error ? e.message : "Previous unit not complete.";
      }
    }
    const steps = await getOrderedStepsForUnit(ctx, unitId);
    const items = await collectContentInUnit(ctx, unitId);
    const byContentId = new Map(items.map((c) => [c._id, c] as const));

    const progressRows = await ctx.db
      .query("userContentProgress")
      .withIndex("by_user_unit", (q) =>
        q.eq("userId", userId).eq("unitId", unitId),
      )
      .collect();
    const byContent = new Map(
      progressRows.map((r) => [r.contentId, r] as const),
    );

    const outerBlocked = prereqs.length > 0 || sequentialUnitBlocked !== null;

    const stepStates: Array<{
      step: UnitStep;
      done: boolean;
      locked: boolean;
      active: boolean;
      contentProgress: (typeof progressRows)[number] | null;
      assignmentProgress: {
        startedAt: number;
        completedAt?: number;
        durationMs?: number;
        outcome?: "passed" | "failed";
        score?: number;
      } | null;
      lastScore?: number;
      lastPassed?: boolean;
    }> = [];
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]!;
      let done = false;
      let locked = outerBlocked;
      let contentProgress: (typeof progressRows)[number] | null = null;
      let assignmentProgress: {
        startedAt: number;
        completedAt?: number;
        durationMs?: number;
        outcome?: "passed" | "failed";
        score?: number;
      } | null = null;
      let lastScore: number | undefined;
      let lastPassed: boolean | undefined;

      if (s.kind === "content") {
        const doc = byContentId.get(s.contentId)!;
        contentProgress = byContent.get(s.contentId) ?? null;
        done = await contentStepDone(ctx, userId, unitId, s.contentId, doc);
        if (isAssessmentContent(doc)) {
          const tr = await latestAssessmentContentResult(
            ctx,
            userId,
            s.contentId,
          );
          if (tr) {
            lastScore = tr.score;
            lastPassed = tr.passed;
          }
        }
      } else {
        const last = await latestAssignmentResult(ctx, userId, s.assignmentId);
        done = last?.passed === true;
        lastScore = last?.score;
        lastPassed = last?.passed;
        const ap = await ctx.db
          .query("userAssignmentProgress")
          .withIndex("by_user_unit_assignment", (q) =>
            q
              .eq("userId", userId)
              .eq("unitId", unitId)
              .eq("assignmentId", s.assignmentId),
          )
          .unique();
        assignmentProgress = ap
          ? {
              startedAt: ap.startedAt,
              completedAt: ap.completedAt,
              durationMs: ap.durationMs,
              outcome: ap.outcome,
              score: ap.score,
            }
          : null;
      }

      if (!outerBlocked && i > 0) {
        const prev = steps[i - 1]!;
        let prevDone = false;
        if (prev.kind === "content") {
          const pd = byContentId.get(prev.contentId)!;
          prevDone = await contentStepDone(
            ctx,
            userId,
            unitId,
            prev.contentId,
            pd,
          );
        } else {
          prevDone = await legacyAssignmentStepDone(
            ctx,
            userId,
            prev.assignmentId,
          );
        }
        locked = !prevDone;
      }

      stepStates.push({
        step: s,
        done,
        locked,
        active: false,
        contentProgress,
        assignmentProgress,
        lastScore,
        lastPassed,
      });
    }

    let activeIndex = -1;
    for (let i = 0; i < stepStates.length; i++) {
      const st = stepStates[i]!;
      if (!st.done && !st.locked) {
        activeIndex = i;
        break;
      }
    }
    for (let i = 0; i < stepStates.length; i++) {
      stepStates[i]!.active = i === activeIndex;
    }

    const unitProg = await ctx.db
      .query("userProgress")
      .withIndex("by_user_unit", (q) =>
        q.eq("userId", userId).eq("unitId", unitId),
      )
      .unique();

    const completedSteps = stepStates.filter((x) => x.done).length;
    const totalSteps = steps.length;
    const fraction =
      totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    return {
      prerequisitesIncomplete: prereqs.map((u) => ({
        unitId: u._id,
        title: u.title,
      })),
      sequentialUnitBlocked,
      steps: stepStates,
      unitProgress: unitProg,
      fraction,
      totalSteps,
      completedSteps,
    };
  },
});

export const roadmapForCertification = query({
  args: { levelId: v.id("certificationLevels") },
  handler: async (ctx, { levelId }) => {
    const userId = await requireUserId(ctx);
    const ok = await userCanAccessLevel(ctx, levelId);
    if (!ok) {
      return null;
    }
    const units = await collectUnitsForLevel(ctx, levelId);
    const out: Array<{
      unitId: Id<"units">;
      title: string;
      description: string;
      order: number;
      locked: boolean;
      lockReason: "prerequisite" | "previous_unit" | null;
      completed: boolean;
      stepTotal: number;
      stepsCompleted: number;
    }> = [];

    for (let i = 0; i < units.length; i++) {
      const unit = units[i]!;
      const prereqRows = await getIncompletePrerequisites(ctx, userId, unit._id);
      let lockReason: "prerequisite" | "previous_unit" | null = null;
      let locked = false;
      if (prereqRows.length > 0) {
        locked = true;
        lockReason = "prerequisite";
      } else if (i > 0) {
        const prev = units[i - 1]!;
        const prevProg = await ctx.db
          .query("userProgress")
          .withIndex("by_user_unit", (q) =>
            q.eq("userId", userId).eq("unitId", prev._id),
          )
          .unique();
        if (!prevProg?.completed) {
          locked = true;
          lockReason = "previous_unit";
        }
      }
      const prog = await ctx.db
        .query("userProgress")
        .withIndex("by_user_unit", (q) =>
          q.eq("userId", userId).eq("unitId", unit._id),
        )
        .unique();
      const steps = await getOrderedStepsForUnit(ctx, unit._id);
      let stepsCompleted = 0;
      if (!locked) {
        const items = await collectContentInUnit(ctx, unit._id);
        const byContentId = new Map(items.map((c) => [c._id, c] as const));
        for (const st of steps) {
          if (st.kind === "content") {
            const doc = byContentId.get(st.contentId)!;
            if (await contentStepDone(ctx, userId, unit._id, st.contentId, doc)) {
              stepsCompleted += 1;
            }
          } else if (
            await legacyAssignmentStepDone(ctx, userId, st.assignmentId)
          ) {
            stepsCompleted += 1;
          }
        }
      }
      out.push({
        unitId: unit._id,
        title: unit.title,
        description: unit.description,
        order: i,
        locked,
        lockReason,
        completed: prog?.completed ?? false,
        stepTotal: steps.length,
        stepsCompleted,
      });
    }
    return { units: out, levelId };
  },
});

export const recordContentStart = mutation({
  args: {
    unitId: v.id("units"),
    contentId: v.id("contentItems"),
    levelId: v.optional(v.id("certificationLevels")),
  },
  handler: async (ctx, { unitId, contentId, levelId }) => {
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
    await assertSequentialUnitAccess(ctx, userId, levelId, unitId);
    const steps = await getOrderedStepsForUnit(ctx, unitId);
    const stepIdx = steps.findIndex(
      (st) => st.kind === "content" && st.contentId === contentId,
    );
    if (stepIdx < 0) {
      throw new Error("Content is not part of this unit");
    }
    await assertPreviousStepsComplete(ctx, userId, unitId, stepIdx);
    const now = Date.now();
    const existing = await ctx.db
      .query("userContentProgress")
      .withIndex("by_user_unit_content", (q) =>
        q.eq("userId", userId).eq("unitId", unitId).eq("contentId", contentId),
      )
      .unique();
    if (existing) {
      return existing._id;
    }
    const id = await ctx.db.insert("userContentProgress", {
      userId,
      unitId,
      contentId,
      startedAt: now,
    });
    await logProgressEvent(ctx, {
      userId,
      unitId,
      contentId,
      kind: "start",
      at: now,
    });
    await touchUnitProgress(ctx, userId, unitId);
    return id;
  },
});

async function touchUnitProgress(
  ctx: MutationCtx,
  userId: Id<"users">,
  unitId: Id<"units">,
) {
  const now = Date.now();
  const row = await ctx.db
    .query("userProgress")
    .withIndex("by_user_unit", (q) =>
      q.eq("userId", userId).eq("unitId", unitId),
    )
    .unique();
  if (row) {
    await ctx.db.patch(row._id, { lastAccessed: now });
  } else {
    await ctx.db.insert("userProgress", {
      userId,
      unitId,
      completed: false,
      lastAccessed: now,
    });
  }
}

export const recordContentComplete = mutation({
  args: {
    unitId: v.id("units"),
    contentId: v.id("contentItems"),
    levelId: v.optional(v.id("certificationLevels")),
    /** Optional client-measured duration (e.g. video watch time). */
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, { unitId, contentId, levelId, durationMs }) => {
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
    await assertSequentialUnitAccess(ctx, userId, levelId, unitId);
    const items = await collectContentInUnit(ctx, unitId);
    const item = items.find((c) => c._id === contentId);
    if (!item) {
      throw new Error("Content is not part of this unit");
    }
    if (isAssessmentContent(item)) {
      throw new Error("Use the assessment submit flow for tests and assignments");
    }
    const steps = await getOrderedStepsForUnit(ctx, unitId);
    const stepIdx = steps.findIndex(
      (st) => st.kind === "content" && st.contentId === contentId,
    );
    await assertPreviousStepsComplete(ctx, userId, unitId, stepIdx);
    const now = Date.now();
    const existing = await ctx.db
      .query("userContentProgress")
      .withIndex("by_user_unit_content", (q) =>
        q.eq("userId", userId).eq("unitId", unitId).eq("contentId", contentId),
      )
      .unique();
    const started = existing?.startedAt ?? now;
    const wallMs =
      durationMs ??
      (existing?.startedAt ? now - existing.startedAt : undefined);
    if (existing) {
      await ctx.db.patch(existing._id, {
        completedAt: now,
        durationMs: wallMs,
        outcome: "completed",
      });
    } else {
      await ctx.db.insert("userContentProgress", {
        userId,
        unitId,
        contentId,
        startedAt: started,
        completedAt: now,
        durationMs: wallMs,
        outcome: "completed",
      });
    }
    await logProgressEvent(ctx, {
      userId,
      unitId,
      contentId,
      kind: "complete",
      at: now,
      durationMs: wallMs,
    });
    await touchUnitProgress(ctx, userId, unitId);
    await syncUnitCompletion(ctx, userId, unitId);
    return { ok: true as const };
  },
});

export const recordLegacyAssignmentStart = mutation({
  args: {
    unitId: v.id("units"),
    assignmentId: v.id("assignments"),
    levelId: v.optional(v.id("certificationLevels")),
  },
  handler: async (ctx, { unitId, assignmentId, levelId }) => {
    const userId = await requireUserId(ctx);
    const assignment = await ctx.db.get(assignmentId);
    if (!assignment || assignment.unitId !== unitId) {
      throw new Error("Assignment not found");
    }
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
    await assertSequentialUnitAccess(ctx, userId, levelId, unitId);
    const steps = await getOrderedStepsForUnit(ctx, unitId);
    const idx = steps.findIndex(
      (s) => s.kind === "legacy_assignment" && s.assignmentId === assignmentId,
    );
    if (idx < 0) {
      throw new Error("Assignment is not a step for this unit");
    }
    await assertPreviousStepsComplete(ctx, userId, unitId, idx);
    const now = Date.now();
    const existing = await ctx.db
      .query("userAssignmentProgress")
      .withIndex("by_user_unit_assignment", (q) =>
        q
          .eq("userId", userId)
          .eq("unitId", unitId)
          .eq("assignmentId", assignmentId),
      )
      .unique();
    if (existing) {
      return existing._id;
    }
    const rowId = await ctx.db.insert("userAssignmentProgress", {
      userId,
      unitId,
      assignmentId,
      startedAt: now,
    });
    await logProgressEvent(ctx, {
      userId,
      unitId,
      assignmentId,
      kind: "start",
      at: now,
    });
    await touchUnitProgress(ctx, userId, unitId);
    return rowId;
  },
});

/** Called from `progress.submitAssessmentContent` after inserting `testResults`. */
export async function applyAssessmentContentAfterSubmit(
  ctx: MutationCtx,
  userId: Id<"users">,
  unitId: Id<"units">,
  contentId: Id<"contentItems">,
  score: number,
  passed: boolean,
  completedAt: number,
) {
  const existing = await ctx.db
    .query("userContentProgress")
    .withIndex("by_user_unit_content", (q) =>
      q.eq("userId", userId).eq("unitId", unitId).eq("contentId", contentId),
    )
    .unique();
  const start = existing?.startedAt ?? completedAt;
  const durationMs = completedAt - start;
  if (existing) {
    await ctx.db.patch(existing._id, {
      completedAt: passed ? completedAt : existing.completedAt,
      durationMs,
      outcome: passed ? "passed" : "failed",
      score,
    });
  } else {
    await ctx.db.insert("userContentProgress", {
      userId,
      unitId,
      contentId,
      startedAt: start,
      completedAt: passed ? completedAt : undefined,
      durationMs,
      outcome: passed ? "passed" : "failed",
      score,
    });
  }
  await logProgressEvent(ctx, {
    userId,
    unitId,
    contentId,
    kind: "assessment_attempt",
    at: completedAt,
    durationMs,
    score,
    passed,
  });
  await touchUnitProgress(ctx, userId, unitId);
  if (passed) {
    await syncUnitCompletion(ctx, userId, unitId);
  }
}

/** Called from `progress.submitAssignment` after inserting `testResults`. */
export async function applyLegacyAssignmentAfterSubmit(
  ctx: MutationCtx,
  userId: Id<"users">,
  unitId: Id<"units">,
  assignmentId: Id<"assignments">,
  score: number,
  passed: boolean,
  completedAt: number,
) {
  const existing = await ctx.db
    .query("userAssignmentProgress")
    .withIndex("by_user_unit_assignment", (q) =>
      q
        .eq("userId", userId)
        .eq("unitId", unitId)
        .eq("assignmentId", assignmentId),
    )
    .unique();
  const start = existing?.startedAt ?? completedAt;
  const durationMs = completedAt - start;
  if (existing) {
    await ctx.db.patch(existing._id, {
      completedAt: passed ? completedAt : existing.completedAt,
      durationMs,
      outcome: passed ? "passed" : "failed",
      score,
    });
  } else {
    await ctx.db.insert("userAssignmentProgress", {
      userId,
      unitId,
      assignmentId,
      startedAt: start,
      completedAt: passed ? completedAt : undefined,
      durationMs,
      outcome: passed ? "passed" : "failed",
      score,
    });
  }
  await logProgressEvent(ctx, {
    userId,
    unitId,
    assignmentId,
    kind: "assessment_attempt",
    at: completedAt,
    durationMs,
    score,
    passed,
  });
  await touchUnitProgress(ctx, userId, unitId);
  if (passed) {
    await syncUnitCompletion(ctx, userId, unitId);
  }
}
