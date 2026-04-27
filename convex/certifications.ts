import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  requireAdminOrCreator,
  requireUserId,
  userCanAccessLevel,
  userCanAccessLevelWithUser,
} from "./lib/auth";
import {
  allocateUniqueCertificationCode,
  assertUniqueCertificationCode,
  normalizeEntityCode,
  validateEntityCodeFormat,
} from "./lib/entityCodes";
import { isLive, nowDeletedAt } from "./lib/softDelete";
import { canStudentStartCertification } from "./lib/studentEntitlements";
import { countUnitStepProgress } from "./contentProgress";
import { collectUnitsForLevel } from "./units";

export type DashboardCertRow = {
  level: Doc<"certificationLevels">;
  unitTotal: number;
  completedCount: number;
  touchedCount: number;
  contentStepsTotal: number;
  contentStepsCompleted: number;
};

export type LearnerCertPathBuckets = {
  current: DashboardCertRow[];
  future: DashboardCertRow[];
  completed: DashboardCertRow[];
  planned: DashboardCertRow[];
};

type DashCtx = QueryCtx | MutationCtx;

async function buildDashboardCertRow(
  ctx: DashCtx,
  userId: Id<"users">,
  level: Doc<"certificationLevels">,
  progressByUnit: Map<Id<"units">, Doc<"userProgress">>,
  /** When false, skips per-unit `countUnitStepProgress` (huge read savings when only bucketing matters). */
  includeContentStepStats: boolean = true,
): Promise<DashboardCertRow | null> {
  const user = await ctx.db.get(userId);
  if (!user) {
    return null;
  }
  if (!userCanAccessLevelWithUser(user, level)) {
    return null;
  }
  const units = await collectUnitsForLevel(ctx, level._id);
  const unitIds = units.map((u) => u._id);
  let completedCount = 0;
  let touchedCount = 0;
  let contentStepsTotal = 0;
  let contentStepsCompleted = 0;
  for (const uid of unitIds) {
    const pr = progressByUnit.get(uid);
    if (pr) {
      touchedCount += 1;
      if (pr.completed) {
        completedCount += 1;
      }
    }
    if (includeContentStepStats) {
      const stepCounts = await countUnitStepProgress(ctx, userId, uid);
      contentStepsTotal += stepCounts.total;
      contentStepsCompleted += stepCounts.completed;
    }
  }
  return {
    level,
    unitTotal: unitIds.length,
    completedCount,
    touchedCount,
    contentStepsTotal,
    contentStepsCompleted,
  };
}

export const listAllAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCreator(ctx);
    const all = (await ctx.db.query("certificationLevels").collect()).filter(
      (l) => isLive(l),
    );
    return all.sort((a, b) => a.order - b.order);
  },
});

export const listForUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    if (!user) {
      return [];
    }
    const all = (await ctx.db.query("certificationLevels").collect()).filter(
      (l) => isLive(l),
    );
    if (user.role === "admin" || user.role === "content_creator") {
      return all.sort((a, b) => a.order - b.order);
    }
    const filtered = all.filter(
      (l) => l.companyId == null || l.companyId === user.companyId,
    );
    return filtered.sort((a, b) => a.order - b.order);
  },
});

/**
 * Optional tuning for {@link computeLearnerCertPathBuckets} (batch admin, notifications, etc.).
 */
export type LearnerCertPathBucketsOptions = {
  /**
   * When false, skips per-unit content-step reads. Buckets use the same `userProgress`-based
   * completed/touched rules; step counts on rows stay 0. Default true (learner dashboard).
   */
  includeContentStepStats?: boolean;
  /**
   * When set, avoids a full `certificationLevels` scan. Must be the live (non-deleted) levels;
   * the same per-user company filter is still applied. Use for `listByCompany`–style batch calls.
   */
  allLiveCertificationLevels?: Doc<"certificationLevels">[];
};

/**
 * Same bucketing as the learner dashboard (current / planned roadmap / future).
 * Exported for `workshops` to filter sessions to units on those certification paths.
 */
export async function computeLearnerCertPathBuckets(
  ctx: QueryCtx,
  userId: Id<"users">,
  options?: LearnerCertPathBucketsOptions,
): Promise<LearnerCertPathBuckets> {
  const user = await ctx.db.get(userId);
  if (!user) {
    return { current: [], future: [], completed: [], planned: [] };
  }
  const includeContentStepStats = options?.includeContentStepStats ?? true;
  const all = options?.allLiveCertificationLevels
    ? options.allLiveCertificationLevels
    : (await ctx.db.query("certificationLevels").collect()).filter(
        (l) => isLive(l),
      );
  const levels =
    user.role === "admin" || user.role === "content_creator"
      ? all
      : all.filter(
          (l) => l.companyId == null || l.companyId === user.companyId,
        );
  const sorted = levels.sort((a, b) => a.order - b.order);

  const allProgress = await ctx.db
    .query("userProgress")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const progressByUnit = new Map<
    Id<"units">,
    (typeof allProgress)[number]
  >();
  for (const p of allProgress) {
    progressByUnit.set(p.unitId, p);
  }

  const rows: DashboardCertRow[] = [];
  for (const level of sorted) {
    const row = await buildDashboardCertRow(
      ctx,
      userId,
      level,
      progressByUnit,
      includeContentStepStats,
    );
    if (row) {
      rows.push(row);
    }
  }

  const plannedIdSet = new Set(user.plannedCertificationLevelIds ?? []);

  const current: DashboardCertRow[] = [];
  const future: DashboardCertRow[] = [];
  const completed: DashboardCertRow[] = [];
  for (const row of rows) {
    const { unitTotal, completedCount, touchedCount, level } = row;
    if (unitTotal === 0) {
      if (!plannedIdSet.has(level._id)) {
        future.push(row);
      }
      continue;
    }
    if (completedCount === unitTotal) {
      completed.push(row);
    } else if (touchedCount > 0) {
      current.push(row);
    } else if (!plannedIdSet.has(level._id)) {
      future.push(row);
    }
  }

  const rowByLevelId = new Map(rows.map((r) => [r.level._id, r]));
  const planned: DashboardCertRow[] = [];
  for (const id of user.plannedCertificationLevelIds ?? []) {
    const row = rowByLevelId.get(id);
    if (!row) {
      continue;
    }
    if (row.unitTotal === 0) {
      continue;
    }
    if (row.completedCount === row.unitTotal) {
      continue;
    }
    if (row.touchedCount > 0) {
      continue;
    }
    planned.push(row);
  }

  return { current, future, completed, planned };
}

/** `live_workshop` units on certifications that are in progress, on the roadmap, or not yet started (future). */
export async function collectLiveWorkshopUnitIdsOnLearnerCertPaths(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<Id<"units">[]> {
  const { current, planned, future } = await computeLearnerCertPathBuckets(
    ctx,
    userId,
    { includeContentStepStats: false },
  );
  const levelIds = new Set<Id<"certificationLevels">>();
  for (const row of [...current, ...planned, ...future]) {
    levelIds.add(row.level._id);
  }
  const unitIdSet = new Set<Id<"units">>();
  for (const levelId of levelIds) {
    const units = await collectUnitsForLevel(ctx, levelId);
    for (const u of units) {
      if (isLive(u) && u.deliveryMode === "live_workshop") {
        unitIdSet.add(u._id);
      }
    }
  }
  return [...unitIdSet];
}

/**
 * Certifications grouped for the learner dashboard: in progress, not started, fully complete.
 */
export const listDashboardBucketsForUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return await computeLearnerCertPathBuckets(ctx, userId);
  },
});

export const addCertificationLevelToMyPlan = mutation({
  args: { levelId: v.id("certificationLevels") },
  handler: async (ctx, { levelId }) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("Unauthorized");
    }
    const level = await ctx.db.get(levelId);
    if (!isLive(level)) {
      throw new Error("Certification not found");
    }
    if (!canStudentStartCertification(user, levelId)) {
      throw new Error(
        "This certification is not assigned to your account. Browse the catalog to view details, or ask your administrator to assign it.",
      );
    }
    const allProgress = await ctx.db
      .query("userProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const progressByUnit = new Map<Id<"units">, (typeof allProgress)[number]>();
    for (const p of allProgress) {
      progressByUnit.set(p.unitId, p);
    }
    const row = await buildDashboardCertRow(
      ctx,
      userId,
      level,
      progressByUnit,
    );
    if (!row) {
      throw new Error("Forbidden");
    }
    if (row.unitTotal === 0) {
      throw new Error("This certification has no units yet");
    }
    if (row.touchedCount > 0) {
      throw new Error("Already started — open it from Current certifications");
    }
    if (row.completedCount === row.unitTotal) {
      throw new Error("Already completed");
    }
    const existing = user.plannedCertificationLevelIds ?? [];
    if (existing.includes(levelId)) {
      return { success: true as const };
    }
    await ctx.db.patch(userId, {
      plannedCertificationLevelIds: [...existing, levelId],
    });
    return { success: true as const };
  },
});

export const removeCertificationLevelFromMyPlan = mutation({
  args: { levelId: v.id("certificationLevels") },
  handler: async (ctx, { levelId }) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("Unauthorized");
    }
    const existing = user.plannedCertificationLevelIds ?? [];
    const next = existing.filter((id) => id !== levelId);
    if (next.length === existing.length) {
      return { success: true as const };
    }
    await ctx.db.patch(userId, {
      plannedCertificationLevelIds: next.length > 0 ? next : undefined,
    });
    return { success: true as const };
  },
});

/** Certification cards + counts for catalog UI (lessons = content items, assessments = assignments). */
export const listCatalogForUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    if (!user) {
      return [];
    }
    const all = (await ctx.db.query("certificationLevels").collect()).filter(
      (l) => isLive(l),
    );
    const levels =
      user.role === "admin" || user.role === "content_creator"
        ? all
        : all.filter(
            (l) => l.companyId == null || l.companyId === user.companyId,
          );
    const sorted = levels.sort((a, b) => a.order - b.order);
    const out: Array<
      Doc<"certificationLevels"> & {
        unitCount: number;
        lessonCount: number;
        assessmentCount: number;
      }
    > = [];
    for (const level of sorted) {
      const links = await ctx.db
        .query("certificationUnits")
        .withIndex("by_level", (q) => q.eq("levelId", level._id))
        .collect();
      links.sort((a, b) => a.order - b.order);
      const linkedUnitIds = new Set<Id<"units">>();
      const unitsOnLevel: Doc<"units">[] = [];
      for (const link of links) {
        const u = await ctx.db.get(link.unitId);
        if (isLive(u)) {
          linkedUnitIds.add(u._id);
          unitsOnLevel.push(u);
        }
      }
      const legacy = await ctx.db
        .query("units")
        .filter((q) => q.eq(q.field("levelId"), level._id))
        .collect();
      const legacyOnly = legacy
        .filter((u) => isLive(u) && !linkedUnitIds.has(u._id))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      unitsOnLevel.push(...legacyOnly);
      let lessonCount = 0;
      let assessmentCount = 0;
      for (const u of unitsOnLevel) {
        const uc = await ctx.db
          .query("unitContents")
          .withIndex("by_unit", (q) => q.eq("unitId", u._id))
          .collect();
        const linkedIds = new Set(uc.map((x) => x.contentId));
        const legacyAttached = await ctx.db
          .query("contentItems")
          .filter((q) => q.eq(q.field("unitId"), u._id))
          .collect();
        let lessons = 0;
        let unitAssessments = 0;
        for (const link of uc) {
          const cdoc = await ctx.db.get(link.contentId);
          if (!isLive(cdoc)) {
            continue;
          }
          if (cdoc.type === "test" || cdoc.type === "assignment") {
            unitAssessments += 1;
          } else {
            lessons += 1;
          }
        }
        for (const c of legacyAttached) {
          if (!isLive(c) || linkedIds.has(c._id)) {
            continue;
          }
          if (c.type === "test" || c.type === "assignment") {
            unitAssessments += 1;
          } else {
            lessons += 1;
          }
        }
        const assigns = await ctx.db
          .query("assignments")
          .filter((q) => q.eq(q.field("unitId"), u._id))
          .collect();
        lessonCount += lessons;
        assessmentCount += unitAssessments + assigns.length;
      }
      out.push({
        ...level,
        unitCount: unitsOnLevel.length,
        lessonCount,
        assessmentCount,
      });
    }
    return out;
  },
});

export const get = query({
  args: { levelId: v.id("certificationLevels") },
  handler: async (ctx, { levelId }) => {
    await requireUserId(ctx);
    const ok = await userCanAccessLevel(ctx, levelId);
    if (!ok) {
      return null;
    }
    const row = await ctx.db.get(levelId);
    return isLive(row) ? row : null;
  },
});

const certificationTierValidator = v.union(
  v.literal("bronze"),
  v.literal("silver"),
  v.literal("gold"),
);

export const create = mutation({
  args: {
    name: v.string(),
    /** Omit or leave blank to auto-allocate from the name. */
    code: v.optional(v.string()),
    certificationCategoryId: v.optional(v.id("certificationCategories")),
    summary: v.optional(v.string()),
    description: v.string(),
    order: v.number(),
    companyId: v.optional(v.id("companies")),
    tagline: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    certificationTier: v.optional(certificationTierValidator),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCreator(ctx);
    const { certificationCategoryId, code: codeRaw, certificationTier, ...rest } =
      args;
    const code =
      codeRaw !== undefined && String(codeRaw).trim() !== ""
        ? normalizeEntityCode(codeRaw)
        : await allocateUniqueCertificationCode(ctx, args.name);
    validateEntityCodeFormat(code);
    await assertUniqueCertificationCode(ctx, code);
    return await ctx.db.insert("certificationLevels", {
      ...rest,
      code,
      ...(certificationCategoryId
        ? { certificationCategoryId }
        : {}),
      certificationTier: certificationTier ?? "bronze",
    });
  },
});

export const update = mutation({
  args: {
    levelId: v.id("certificationLevels"),
    name: v.string(),
    code: v.string(),
    certificationCategoryId: v.optional(
      v.union(v.id("certificationCategories"), v.null()),
    ),
    summary: v.optional(v.string()),
    description: v.string(),
    order: v.number(),
    companyId: v.optional(v.id("companies")),
    tagline: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    certificationTier: v.optional(certificationTierValidator),
  },
  handler: async (ctx, {
    levelId,
    certificationCategoryId,
    code,
    certificationTier,
    ...fields
  }) => {
    await requireAdminOrCreator(ctx);
    const row = await ctx.db.get(levelId);
    if (!isLive(row)) {
      throw new Error("Certification not found");
    }
    const normalizedCode = normalizeEntityCode(code);
    validateEntityCodeFormat(normalizedCode);
    await assertUniqueCertificationCode(ctx, normalizedCode, levelId);
    await ctx.db.patch(levelId, {
      ...fields,
      code: normalizedCode,
      ...(certificationCategoryId !== undefined
        ? {
            certificationCategoryId:
              certificationCategoryId === null
                ? undefined
                : certificationCategoryId,
          }
        : {}),
      ...(certificationTier !== undefined ? { certificationTier } : {}),
    });
  },
});

export const reorderLevels = mutation({
  args: { orderedIds: v.array(v.id("certificationLevels")) },
  handler: async (ctx, { orderedIds }) => {
    await requireAdminOrCreator(ctx);
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      const lev = await ctx.db.get(id);
      if (!isLive(lev)) {
        throw new Error("Unknown or removed certification in order");
      }
      await ctx.db.patch(id, { order: i });
    }
  },
});

export const remove = mutation({
  args: { levelId: v.id("certificationLevels") },
  handler: async (ctx, { levelId }) => {
    await requireAdminOrCreator(ctx);
    const row = await ctx.db.get(levelId);
    if (!row) {
      throw new Error("Certification not found");
    }
    if (row.deletedAt != null) {
      return;
    }
    await ctx.db.patch(levelId, { deletedAt: nowDeletedAt() });
  },
});
