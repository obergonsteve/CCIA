import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  type QueryCtx,
  query,
} from "./_generated/server";
import {
  requireAdminOrCreator,
  requireUserId,
  userCanAccessLevel,
  userCanAccessUnit,
} from "./lib/auth";
import {
  allocateUniqueUnitCode,
  assertUniqueUnitCode,
  normalizeEntityCode,
  validateEntityCodeFormat,
} from "./lib/entityCodes";
import { webinarizeForLiveWorkshopUnit } from "./lib/webinarDisplayText";
import { isLive, nowDeletedAt } from "./lib/softDelete";

/** Soft-delete a unit (no auth); used internally. */
export const removeInternal = internalMutation({
  args: { unitId: v.id("units") },
  handler: async (ctx, { unitId }) => {
    const row = await ctx.db.get(unitId);
    if (!row || row.deletedAt != null) {
      return;
    }
    await ctx.db.patch(unitId, { deletedAt: nowDeletedAt() });
  },
});

export type UnitAdminListRow = Doc<"units"> & {
  certificationSummary: string;
  /** Certification levels this unit belongs to (links + legacy levelId). */
  certificationLevelIds: Id<"certificationLevels">[];
};

export const listAllAdmin = query({
  args: {},
  handler: async (ctx): Promise<UnitAdminListRow[]> => {
    await requireAdminOrCreator(ctx);
    const all = (await ctx.db.query("units").collect()).filter((u) =>
      isLive(u),
    );
    const out: UnitAdminListRow[] = [];
    for (const u of all) {
      const links = await ctx.db
        .query("certificationUnits")
        .withIndex("by_unit", (q) => q.eq("unitId", u._id))
        .collect();
      const names: string[] = [];
      const levelIds: Id<"certificationLevels">[] = [];
      for (const link of links) {
        const lev = await ctx.db.get(link.levelId);
        if (isLive(lev)) {
          names.push(lev.name);
          levelIds.push(link.levelId);
        }
      }
      if (links.length === 0 && u.levelId) {
        const lev = await ctx.db.get(u.levelId);
        if (isLive(lev)) {
          names.push(lev.name);
          if (!levelIds.includes(u.levelId)) {
            levelIds.push(u.levelId);
          }
        }
      }
      names.sort((a, b) => a.localeCompare(b));
      /** Spread full `units` row so admin UI can read legacy `unitCategory` until FK-only. */
      out.push({
        ...u,
        certificationSummary: names.length ? names.join(", ") : "—",
        certificationLevelIds: levelIds,
      });
    }
    out.sort((a, b) => a.title.localeCompare(b.title));
    return out;
  },
});

/**
 * Units linked to a level (junction + legacy `units.levelId`). No auth — caller
 * must verify `userCanAccessLevel` when exposing to learners.
 */
export async function collectUnitsForLevel(
  ctx: QueryCtx,
  levelId: Id<"certificationLevels">,
): Promise<Doc<"units">[]> {
  const links = await ctx.db
    .query("certificationUnits")
    .withIndex("by_level", (q) => q.eq("levelId", levelId))
    .collect();
  links.sort((a, b) => a.order - b.order);
  const linkedUnitIds = new Set<Id<"units">>();
  const fromLinks: Doc<"units">[] = [];
  for (const link of links) {
    const u = await ctx.db.get(link.unitId);
    if (isLive(u)) {
      linkedUnitIds.add(u._id);
      fromLinks.push(u);
    }
  }
  const legacy = await ctx.db
    .query("units")
    .withIndex("by_cert_level", (q) => q.eq("levelId", levelId))
    .collect();
  const legacyOnly = legacy
    .filter((u) => isLive(u) && !linkedUnitIds.has(u._id))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return [...fromLinks, ...legacyOnly];
}

export const listByLevel = query({
  args: { levelId: v.id("certificationLevels") },
  handler: async (ctx, { levelId }) => {
    await requireUserId(ctx);
    const ok = await userCanAccessLevel(ctx, levelId);
    if (!ok) {
      return [];
    }
    return collectUnitsForLevel(ctx, levelId);
  },
});

export const get = query({
  args: { unitId: v.id("units") },
  handler: async (ctx, { unitId }) => {
    await requireUserId(ctx);
    const ok = await userCanAccessUnit(ctx, unitId);
    if (!ok) {
      return null;
    }
    const row = await ctx.db.get(unitId);
    if (!row) {
      return null;
    }
    if (row.deliveryMode === "live_workshop") {
      return {
        ...row,
        title: webinarizeForLiveWorkshopUnit(row.title, row.deliveryMode),
        description: webinarizeForLiveWorkshopUnit(
          row.description,
          row.deliveryMode,
        ),
      };
    }
    return row;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    /** Omit or leave blank to auto-allocate from the title. */
    code: v.optional(v.string()),
    description: v.string(),
    unitCategoryId: v.optional(v.id("unitCategories")),
    deliveryMode: v.optional(
      v.union(v.literal("self_paced"), v.literal("live_workshop")),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCreator(ctx);
    const { unitCategoryId, code: codeRaw, deliveryMode, ...rest } = args;
    const code =
      codeRaw !== undefined && String(codeRaw).trim() !== ""
        ? normalizeEntityCode(codeRaw)
        : await allocateUniqueUnitCode(ctx, args.title);
    validateEntityCodeFormat(code);
    await assertUniqueUnitCode(ctx, code);
    return await ctx.db.insert("units", {
      ...rest,
      code,
      ...(unitCategoryId ? { unitCategoryId } : {}),
      ...(deliveryMode ? { deliveryMode } : {}),
    });
  },
});

export const update = mutation({
  args: {
    unitId: v.id("units"),
    title: v.string(),
    code: v.string(),
    description: v.string(),
    unitCategoryId: v.optional(
      v.union(v.id("unitCategories"), v.null()),
    ),
    deliveryMode: v.optional(
      v.union(
        v.literal("self_paced"),
        v.literal("live_workshop"),
        v.null(),
      ),
    ),
  },
  handler: async (ctx, { unitId, unitCategoryId, deliveryMode, code, ...fields }) => {
    await requireAdminOrCreator(ctx);
    const row = await ctx.db.get(unitId);
    if (!isLive(row)) {
      throw new Error("Unit not found");
    }
    const normalizedCode = normalizeEntityCode(code);
    validateEntityCodeFormat(normalizedCode);
    await assertUniqueUnitCode(ctx, normalizedCode, unitId);
    await ctx.db.patch(unitId, {
      ...fields,
      code: normalizedCode,
      ...(unitCategoryId !== undefined
        ? {
            unitCategoryId:
              unitCategoryId === null ? undefined : unitCategoryId,
          }
        : {}),
      ...(deliveryMode !== undefined
        ? {
            deliveryMode:
              deliveryMode === null ? undefined : deliveryMode,
          }
        : {}),
    });
  },
});

export const addUnitToLevel = mutation({
  args: {
    levelId: v.id("certificationLevels"),
    unitId: v.id("units"),
  },
  handler: async (ctx, { levelId, unitId }) => {
    await requireAdminOrCreator(ctx);
    const level = await ctx.db.get(levelId);
    const unit = await ctx.db.get(unitId);
    if (!isLive(level)) {
      throw new Error("Certification not found");
    }
    if (!isLive(unit)) {
      throw new Error("Unit not found");
    }
    const existing = await ctx.db
      .query("certificationUnits")
      .withIndex("by_level_and_unit", (q) =>
        q.eq("levelId", levelId).eq("unitId", unitId),
      )
      .unique();
    if (existing) {
      return { id: existing._id, alreadyPresent: true as const };
    }
    const inLevel = await ctx.db
      .query("certificationUnits")
      .withIndex("by_level", (q) => q.eq("levelId", levelId))
      .collect();
    const nextOrder =
      inLevel.length === 0
        ? 0
        : Math.max(...inLevel.map((r) => r.order)) + 1;
    const id = await ctx.db.insert("certificationUnits", {
      levelId,
      unitId,
      order: nextOrder,
    });
    return { id, alreadyPresent: false as const };
  },
});

export const removeUnitFromLevel = mutation({
  args: {
    levelId: v.id("certificationLevels"),
    unitId: v.id("units"),
  },
  handler: async (ctx, { levelId, unitId }) => {
    await requireAdminOrCreator(ctx);
    const row = await ctx.db
      .query("certificationUnits")
      .withIndex("by_level_and_unit", (q) =>
        q.eq("levelId", levelId).eq("unitId", unitId),
      )
      .unique();
    if (!row) {
      return;
    }
    await ctx.db.delete(row._id);
    const rest = await ctx.db
      .query("certificationUnits")
      .withIndex("by_level", (q) => q.eq("levelId", levelId))
      .collect();
    rest.sort((a, b) => a.order - b.order);
    for (let i = 0; i < rest.length; i++) {
      await ctx.db.patch(rest[i]!._id, { order: i });
    }
  },
});

export const reorderUnitsInLevel = mutation({
  args: {
    levelId: v.id("certificationLevels"),
    orderedUnitIds: v.array(v.id("units")),
  },
  handler: async (ctx, { levelId, orderedUnitIds }) => {
    await requireAdminOrCreator(ctx);
    const links = await ctx.db
      .query("certificationUnits")
      .withIndex("by_level", (q) => q.eq("levelId", levelId))
      .collect();
    const byUnit = new Map(links.map((l) => [l.unitId, l] as const));
    for (let i = 0; i < orderedUnitIds.length; i++) {
      const uid = orderedUnitIds[i]!;
      const u = await ctx.db.get(uid);
      if (!isLive(u)) {
        throw new Error("Unknown or removed unit in order");
      }
      const link = byUnit.get(uid);
      if (link) {
        await ctx.db.patch(link._id, { order: i });
      }
    }
  },
});

export const remove = mutation({
  args: { unitId: v.id("units") },
  handler: async (ctx, { unitId }) => {
    await requireAdminOrCreator(ctx);
    const row = await ctx.db.get(unitId);
    if (!row) {
      throw new Error("Unit not found");
    }
    if (row.deletedAt != null) {
      return;
    }
    await ctx.db.patch(unitId, { deletedAt: nowDeletedAt() });
  },
});

/** Admin Courses: prerequisite and assignment counts per unit (unit row chips). */
export const adminPrereqAndAssignmentCounts = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCreator(ctx);
    const units = (await ctx.db.query("units").collect()).filter((u) =>
      isLive(u),
    );
    const out: Array<{
      unitId: Id<"units">;
      prereqCount: number;
      assignmentCount: number;
    }> = [];
    for (const u of units) {
      const prereqRows = await ctx.db
        .query("unitPrerequisites")
        .withIndex("by_unit", (q) => q.eq("unitId", u._id))
        .collect();
      /**
       * Match `content.listByUnit`: assessments = contentItems (test/assignment)
       * linked via unitContents or legacy contentItems.unitId — not the old
       * `assignments` table (those rows are not shown in the admin Content list).
       */
      const ucLinks = await ctx.db
        .query("unitContents")
        .withIndex("by_unit", (q) => q.eq("unitId", u._id))
        .collect();
      const linkedContentIds = new Set(ucLinks.map((l) => l.contentId));
      let assessmentCount = 0;
      for (const link of ucLinks) {
        const doc = await ctx.db.get(link.contentId);
        if (!isLive(doc)) {
          continue;
        }
        if (doc.type === "test" || doc.type === "assignment") {
          assessmentCount += 1;
        }
      }
      const legacyAttached = await ctx.db
        .query("contentItems")
        .filter((q) => q.eq(q.field("unitId"), u._id))
        .collect();
      for (const doc of legacyAttached) {
        if (linkedContentIds.has(doc._id)) {
          continue;
        }
        if (
          isLive(doc) &&
          (doc.type === "test" || doc.type === "assignment")
        ) {
          assessmentCount += 1;
        }
      }
      out.push({
        unitId: u._id,
        prereqCount: prereqRows.length,
        assignmentCount: assessmentCount,
      });
    }
    return out;
  },
});
