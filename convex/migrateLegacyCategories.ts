import { mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAdminOrCreator } from "./lib/auth";

async function nextSortStart(ctx: MutationCtx, table: "certificationCategories" | "unitCategories" | "contentCategories"): Promise<number> {
  const rows = await ctx.db.query(table).collect();
  return rows.reduce((m, r) => Math.max(m, r.sortOrder), -1) + 1;
}

async function getOrInsertCertCategory(
  ctx: MutationCtx,
  shortCode: string,
  longDescription: string,
  sortRef: { n: number },
): Promise<Id<"certificationCategories">> {
  const code = shortCode.trim();
  const desc = longDescription.trim() || code;
  const existing = await ctx.db
    .query("certificationCategories")
    .withIndex("by_short_code", (q) => q.eq("shortCode", code))
    .first();
  if (existing) {
    return existing._id;
  }
  return await ctx.db.insert("certificationCategories", {
    shortCode: code,
    longDescription: desc,
    sortOrder: sortRef.n++,
  });
}

async function getOrInsertUnitCategory(
  ctx: MutationCtx,
  shortCode: string,
  longDescription: string,
  sortRef: { n: number },
): Promise<Id<"unitCategories">> {
  const code = shortCode.trim();
  const desc = longDescription.trim() || code;
  const existing = await ctx.db
    .query("unitCategories")
    .withIndex("by_short_code", (q) => q.eq("shortCode", code))
    .first();
  if (existing) {
    return existing._id;
  }
  return await ctx.db.insert("unitCategories", {
    shortCode: code,
    longDescription: desc,
    sortOrder: sortRef.n++,
  });
}

async function getOrInsertContentCategory(
  ctx: MutationCtx,
  shortCode: string,
  longDescription: string,
  sortRef: { n: number },
): Promise<Id<"contentCategories">> {
  const code = shortCode.trim();
  const desc = longDescription.trim() || code;
  const existing = await ctx.db
    .query("contentCategories")
    .withIndex("by_short_code", (q) => q.eq("shortCode", code))
    .first();
  if (existing) {
    return existing._id;
  }
  return await ctx.db.insert("contentCategories", {
    shortCode: code,
    longDescription: desc,
    sortOrder: sortRef.n++,
  });
}

/**
 * One-time (idempotent): copies legacy string category fields into the category
 * tables, sets `*CategoryId` on each row, and removes the old string keys so
 * the schema can drop those fields later.
 *
 * Run from project root (uses deployment user / CONVEX_DEV_USER_ID / seeded admin):
 * `npx convex run migrateLegacyCategories:adminMigrateLegacyCategoryStrings`
 */
export const adminMigrateLegacyCategoryStrings = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCreator(ctx);

    const certSort = { n: await nextSortStart(ctx, "certificationCategories") };
    const unitSort = { n: await nextSortStart(ctx, "unitCategories") };
    const contentSort = { n: await nextSortStart(ctx, "contentCategories") };

    let certificationLevelsPatched = 0;
    for (const row of await ctx.db.query("certificationLevels").collect()) {
      const lab = row.certificationCategory?.trim();
      const hadLegacyStrings =
        row.certificationCategory !== undefined ||
        row.certificationCategoryShortDescription !== undefined;
      let nextCatId = row.certificationCategoryId;
      if (lab) {
        const id = await getOrInsertCertCategory(
          ctx,
          lab,
          row.certificationCategoryShortDescription?.trim() || lab,
          certSort,
        );
        nextCatId = nextCatId ?? id;
      }
      if (
        hadLegacyStrings ||
        (lab && nextCatId !== row.certificationCategoryId)
      ) {
        await ctx.db.patch(row._id, {
          ...(nextCatId !== row.certificationCategoryId
            ? { certificationCategoryId: nextCatId }
            : {}),
          certificationCategory: undefined,
          certificationCategoryShortDescription: undefined,
        });
        certificationLevelsPatched += 1;
      }
    }

    let unitsPatched = 0;
    for (const row of await ctx.db.query("units").collect()) {
      const lab = row.unitCategory?.trim();
      const hadLegacyStrings =
        row.unitCategory !== undefined ||
        row.unitCategoryShortDescription !== undefined;
      let nextCatId = row.unitCategoryId;
      if (lab) {
        const id = await getOrInsertUnitCategory(
          ctx,
          lab,
          row.unitCategoryShortDescription?.trim() || lab,
          unitSort,
        );
        nextCatId = nextCatId ?? id;
      }
      if (hadLegacyStrings || (lab && nextCatId !== row.unitCategoryId)) {
        await ctx.db.patch(row._id, {
          ...(nextCatId !== row.unitCategoryId
            ? { unitCategoryId: nextCatId }
            : {}),
          unitCategory: undefined,
          unitCategoryShortDescription: undefined,
        });
        unitsPatched += 1;
      }
    }

    let contentItemsPatched = 0;
    for (const row of await ctx.db.query("contentItems").collect()) {
      const lab = row.contentCategory?.trim();
      const hadLegacyStrings =
        row.contentCategory !== undefined ||
        row.contentCategoryShortDescription !== undefined;
      let nextCatId = row.contentCategoryId;
      if (lab) {
        const id = await getOrInsertContentCategory(
          ctx,
          lab,
          row.contentCategoryShortDescription?.trim() || lab,
          contentSort,
        );
        nextCatId = nextCatId ?? id;
      }
      if (hadLegacyStrings || (lab && nextCatId !== row.contentCategoryId)) {
        await ctx.db.patch(row._id, {
          ...(nextCatId !== row.contentCategoryId
            ? { contentCategoryId: nextCatId }
            : {}),
          contentCategory: undefined,
          contentCategoryShortDescription: undefined,
        });
        contentItemsPatched += 1;
      }
    }

    return {
      ok: true as const,
      certificationLevelsPatched,
      unitsPatched,
      contentItemsPatched,
    };
  },
});
