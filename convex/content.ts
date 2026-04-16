import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  requireAdminOrCreator,
  requireUserId,
  userCanAccessUnit,
} from "./lib/auth";
import {
  allocateUniqueContentCode,
  assertUniqueContentCode,
  normalizeEntityCode,
  validateEntityCodeFormat,
} from "./lib/entityCodes";
import { isLive, nowDeletedAt } from "./lib/softDelete";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const assessmentQuestionValidator = v.object({
  id: v.string(),
  question: v.string(),
  type: v.union(v.literal("multiple_choice"), v.literal("text")),
  options: v.optional(v.array(v.string())),
  correctAnswer: v.optional(v.string()),
});

const assessmentPayloadValidator = v.object({
  description: v.string(),
  questions: v.array(assessmentQuestionValidator),
  passingScore: v.number(),
});

const contentTypeValidator = v.union(
  v.literal("video"),
  v.literal("slideshow"),
  v.literal("link"),
  v.literal("pdf"),
  v.literal("test"),
  v.literal("assignment"),
  v.literal("workshop_session"),
);

export type ContentInUnit = Doc<"contentItems"> & {
  order: number;
  /** Null when the row still uses legacy `contentItems.unitId` (no `unitContents` link). */
  unitContentId: Id<"unitContents"> | null;
};

/** Ordered content for a unit (junction + legacy). Caller must enforce access. */
export async function collectContentInUnit(
  ctx: QueryCtx,
  unitId: Id<"units">,
): Promise<ContentInUnit[]> {
  const links = await ctx.db
    .query("unitContents")
    .withIndex("by_unit", (q) => q.eq("unitId", unitId))
    .collect();
  links.sort((a, b) => a.order - b.order);
  const out: ContentInUnit[] = [];
  const linkedContentIds = new Set<Id<"contentItems">>();
  for (const link of links) {
    const doc = await ctx.db.get(link.contentId);
    if (isLive(doc)) {
      linkedContentIds.add(doc._id);
      out.push({
        ...doc,
        order: link.order,
        unitContentId: link._id,
      });
    }
  }
  const legacyRows = await ctx.db
    .query("contentItems")
    .filter((q) => q.eq(q.field("unitId"), unitId))
    .collect();
  for (const doc of legacyRows) {
    if (!isLive(doc) || linkedContentIds.has(doc._id)) {
      continue;
    }
    out.push({
      ...doc,
      order: doc.order ?? 0,
      unitContentId: null,
    });
  }
  out.sort((a, b) => a.order - b.order);
  return out;
}

export const listByUnit = query({
  args: { unitId: v.id("units") },
  handler: async (ctx, { unitId }): Promise<ContentInUnit[]> => {
    await requireUserId(ctx);
    const ok = await userCanAccessUnit(ctx, unitId);
    if (!ok) {
      return [];
    }
    return collectContentInUnit(ctx, unitId);
  },
});

export const listAllAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCreator(ctx);
    const all = (await ctx.db.query("contentItems").collect()).filter((c) =>
      isLive(c),
    );
    return all.sort((a, b) => a.title.localeCompare(b.title));
  },
});

export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    await requireUserId(ctx);
    return await ctx.storage.getUrl(storageId);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCreator(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

function isAssessmentType(
  t: Doc<"contentItems">["type"],
): t is "test" | "assignment" {
  return t === "test" || t === "assignment";
}

async function assertValidWorkshopSessionRef(
  ctx: MutationCtx,
  workshopSessionId: Doc<"contentItems">["workshopSessionId"],
  type: Doc<"contentItems">["type"],
) {
  if (type !== "workshop_session") {
    return;
  }
  if (!workshopSessionId) {
    throw new Error("workshop_session content requires a linked session");
  }
  const session = await ctx.db.get(workshopSessionId);
  if (!session) {
    throw new Error("Workshop session not found");
  }
  const unit = await ctx.db.get(session.workshopUnitId);
  if (!isLive(unit) || unit.deliveryMode !== "live_workshop") {
    throw new Error("Session must belong to a live workshop unit");
  }
}

/** Create a reusable library item (attach to units with `attachToUnit`). */
export const create = mutation({
  args: {
    type: contentTypeValidator,
    title: v.string(),
    /** Omit or leave blank to auto-allocate from the title. */
    code: v.optional(v.string()),
    url: v.string(),
    contentCategoryId: v.optional(v.id("contentCategories")),
    storageId: v.optional(v.id("_storage")),
    duration: v.optional(v.number()),
    assessment: v.optional(assessmentPayloadValidator),
    workshopSessionId: v.optional(v.id("workshopSessions")),
    shortDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCreator(ctx);
    const {
      assessment,
      type,
      contentCategoryId,
      code: codeRaw,
      workshopSessionId,
      shortDescription: shortDescriptionRaw,
      ...rest
    } = args;
    const shortDescription =
      shortDescriptionRaw !== undefined &&
      String(shortDescriptionRaw).trim() !== ""
        ? String(shortDescriptionRaw).trim()
        : undefined;
    const code =
      codeRaw !== undefined && String(codeRaw).trim() !== ""
        ? normalizeEntityCode(codeRaw)
        : await allocateUniqueContentCode(ctx, args.title);
    validateEntityCodeFormat(code);
    await assertUniqueContentCode(ctx, code);
    const categoryFields = contentCategoryId
      ? { contentCategoryId }
      : {};
    if (isAssessmentType(type)) {
      if (!assessment) {
        throw new Error("test and assignment content requires assessment data");
      }
      return await ctx.db.insert("contentItems", {
        type,
        ...rest,
        code,
        ...categoryFields,
        ...(shortDescription ? { shortDescription } : {}),
        assessment,
      });
    }
    if (assessment !== undefined) {
      throw new Error("assessment is only valid for test or assignment type");
    }
    await assertValidWorkshopSessionRef(ctx, workshopSessionId, type);
    if (type === "workshop_session") {
      return await ctx.db.insert("contentItems", {
        type,
        ...rest,
        code,
        ...categoryFields,
        ...(shortDescription ? { shortDescription } : {}),
        workshopSessionId,
      });
    }
    return await ctx.db.insert("contentItems", {
      type,
      ...rest,
      code,
      ...categoryFields,
      ...(shortDescription ? { shortDescription } : {}),
    });
  },
});

export const update = mutation({
  args: {
    contentId: v.id("contentItems"),
    title: v.string(),
    code: v.string(),
    url: v.string(),
    type: contentTypeValidator,
    contentCategoryId: v.optional(
      v.union(v.id("contentCategories"), v.null()),
    ),
    storageId: v.optional(v.union(v.id("_storage"), v.null())),
    duration: v.optional(v.number()),
    assessment: v.optional(assessmentPayloadValidator),
    workshopSessionId: v.optional(
      v.union(v.id("workshopSessions"), v.null()),
    ),
    shortDescription: v.optional(v.string()),
  },
  handler: async (ctx, {
    contentId,
    assessment,
    type,
    contentCategoryId,
    code,
    workshopSessionId,
    shortDescription: shortDescriptionRaw,
    storageId,
    ...fields
  }) => {
    await requireAdminOrCreator(ctx);
    const existing = await ctx.db.get(contentId);
    if (!isLive(existing)) {
      throw new Error("Content not found");
    }
    const normalizedCode = normalizeEntityCode(code);
    validateEntityCodeFormat(normalizedCode);
    await assertUniqueContentCode(ctx, normalizedCode, contentId);
    const cat =
      contentCategoryId !== undefined
        ? {
            contentCategoryId:
              contentCategoryId === null ? undefined : contentCategoryId,
          }
        : {};
    const shortDescExtras =
      shortDescriptionRaw !== undefined
        ? {
            shortDescription: String(shortDescriptionRaw).trim(),
          }
        : {};
    const storageExtras =
      storageId !== undefined
        ? {
            storageId: storageId === null ? undefined : storageId,
          }
        : {};
    if (isAssessmentType(type)) {
      if (!assessment) {
        throw new Error("test and assignment content requires assessment data");
      }
      await ctx.db.patch(contentId, {
        ...fields,
        ...shortDescExtras,
        ...storageExtras,
        code: normalizedCode,
        ...cat,
        type,
        assessment,
        workshopSessionId: undefined,
      });
      return;
    }
    const nextWorkshopSessionId =
      type === "workshop_session"
        ? workshopSessionId !== undefined
          ? workshopSessionId === null
            ? undefined
            : workshopSessionId
          : existing.workshopSessionId
        : undefined;
    await assertValidWorkshopSessionRef(ctx, nextWorkshopSessionId, type);
    await ctx.db.patch(contentId, {
      ...fields,
      ...shortDescExtras,
      ...storageExtras,
      code: normalizedCode,
      ...cat,
      type,
      assessment: undefined,
      workshopSessionId:
        type === "workshop_session" ? nextWorkshopSessionId : undefined,
    });
  },
});

export const patchUnitContentOrder = mutation({
  args: {
    unitContentId: v.id("unitContents"),
    order: v.number(),
  },
  handler: async (ctx, { unitContentId, order }) => {
    await requireAdminOrCreator(ctx);
    await ctx.db.patch(unitContentId, { order });
  },
});

/** For items still using legacy `contentItems.unitId` / `order`. */
export const patchLegacyContentOrder = mutation({
  args: {
    contentId: v.id("contentItems"),
    order: v.number(),
  },
  handler: async (ctx, { contentId, order }) => {
    await requireAdminOrCreator(ctx);
    await ctx.db.patch(contentId, { order });
  },
});

/**
 * Apply lesson order in one transaction (avoids parallel patch races and keeps
 * listByUnit’s merged junction + legacy sort consistent).
 */
export const reorderContentOnUnit = mutation({
  args: {
    unitId: v.id("units"),
    orderedContentIds: v.array(v.id("contentItems")),
  },
  handler: async (ctx, { unitId, orderedContentIds }) => {
    await requireAdminOrCreator(ctx);
    const links = await ctx.db
      .query("unitContents")
      .withIndex("by_unit", (q) => q.eq("unitId", unitId))
      .collect();
    const linkByContentId = new Map(
      links.map((l) => [l.contentId, l] as const),
    );
    for (let i = 0; i < orderedContentIds.length; i++) {
      const contentId = orderedContentIds[i]!;
      const link = linkByContentId.get(contentId);
      if (link) {
        await ctx.db.patch(link._id, { order: i });
        continue;
      }
      const doc = await ctx.db.get(contentId);
      if (isLive(doc) && doc.unitId === unitId) {
        await ctx.db.patch(contentId, { order: i });
        continue;
      }
      throw new Error("Content not on this unit");
    }
  },
});

export const attachToUnit = mutation({
  args: {
    unitId: v.id("units"),
    contentId: v.id("contentItems"),
  },
  handler: async (ctx, { unitId, contentId }) => {
    await requireAdminOrCreator(ctx);
    const unit = await ctx.db.get(unitId);
    if (!isLive(unit)) {
      throw new Error("Unit not found");
    }
    const doc = await ctx.db.get(contentId);
    if (!isLive(doc)) {
      throw new Error("Content not found");
    }
    if (doc.unitId !== undefined) {
      await ctx.db.patch(contentId, {
        unitId: undefined,
        order: undefined,
      });
    }
    const existing = await ctx.db
      .query("unitContents")
      .withIndex("by_unit_and_content", (q) =>
        q.eq("unitId", unitId).eq("contentId", contentId),
      )
      .unique();
    /** Idempotent: confirm / double-drop / retries must not error. */
    if (existing) {
      return existing._id;
    }
    const links = await ctx.db
      .query("unitContents")
      .withIndex("by_unit", (q) => q.eq("unitId", unitId))
      .collect();
    const nextOrder =
      links.length === 0 ? 0 : Math.max(...links.map((l) => l.order)) + 1;
    return await ctx.db.insert("unitContents", {
      unitId,
      contentId,
      order: nextOrder,
    });
  },
});

export const legacyDetachFromUnit = mutation({
  args: {
    unitId: v.id("units"),
    contentId: v.id("contentItems"),
  },
  handler: async (ctx, { unitId, contentId }) => {
    await requireAdminOrCreator(ctx);
    const doc = await ctx.db.get(contentId);
    if (!doc || doc.unitId !== unitId) {
      throw new Error("Content is not attached to this unit (legacy)");
    }
    await ctx.db.patch(contentId, {
      unitId: undefined,
      order: undefined,
    });
  },
});

export const detachFromUnit = mutation({
  args: { unitContentId: v.id("unitContents") },
  handler: async (ctx, { unitContentId }) => {
    await requireAdminOrCreator(ctx);
    const row = await ctx.db.get(unitContentId);
    if (!row) {
      return;
    }
    const unitId = row.unitId;
    await ctx.db.delete(unitContentId);
    const rest = await ctx.db
      .query("unitContents")
      .withIndex("by_unit", (q) => q.eq("unitId", unitId))
      .collect();
    rest.sort((a, b) => a.order - b.order);
    for (let i = 0; i < rest.length; i++) {
      await ctx.db.patch(rest[i]!._id, { order: i });
    }
  },
});

export const reorderInUnit = mutation({
  args: {
    unitId: v.id("units"),
    orderedContentIds: v.array(v.id("contentItems")),
  },
  handler: async (ctx, { unitId, orderedContentIds }) => {
    await requireAdminOrCreator(ctx);
    const links = await ctx.db
      .query("unitContents")
      .withIndex("by_unit", (q) => q.eq("unitId", unitId))
      .collect();
    const byContent = new Map(links.map((l) => [l.contentId, l] as const));
    for (let i = 0; i < orderedContentIds.length; i++) {
      const link = byContent.get(orderedContentIds[i]!);
      if (link) {
        await ctx.db.patch(link._id, { order: i });
      }
    }
  },
});

export const remove = mutation({
  args: { contentId: v.id("contentItems") },
  handler: async (ctx, { contentId }) => {
    await requireAdminOrCreator(ctx);
    const row = await ctx.db.get(contentId);
    if (!row) {
      throw new Error("Content not found");
    }
    if (row.deletedAt != null) {
      return;
    }
    await ctx.db.patch(contentId, { deletedAt: nowDeletedAt() });
  },
});
