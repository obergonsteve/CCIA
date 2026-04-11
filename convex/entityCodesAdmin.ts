import { mutation } from "./_generated/server";
import {
  allocateUniqueCertificationCode,
  allocateUniqueContentCode,
  allocateUniqueUnitCode,
} from "./lib/entityCodes";
import { requireAdminOrCreator } from "./lib/auth";
import { isLive } from "./lib/softDelete";

/**
 * One-shot: assign `code` to any live certification, unit, or content row that
 * does not have one yet (e.g. after schema upgrade).
 */
export const backfillMissingEntityCodes = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCreator(ctx);
    const stats = { certifications: 0, units: 0, content: 0 };
    for (const l of await ctx.db.query("certificationLevels").collect()) {
      if (!isLive(l) || (l.code?.trim() ?? "").length > 0) {
        continue;
      }
      const code = await allocateUniqueCertificationCode(ctx, l.name);
      await ctx.db.patch(l._id, { code });
      stats.certifications += 1;
    }
    for (const u of await ctx.db.query("units").collect()) {
      if (!isLive(u) || (u.code?.trim() ?? "").length > 0) {
        continue;
      }
      const code = await allocateUniqueUnitCode(ctx, u.title);
      await ctx.db.patch(u._id, { code });
      stats.units += 1;
    }
    for (const c of await ctx.db.query("contentItems").collect()) {
      if (!isLive(c) || (c.code?.trim() ?? "").length > 0) {
        continue;
      }
      const code = await allocateUniqueContentCode(ctx, c.title);
      await ctx.db.patch(c._id, { code });
      stats.content += 1;
    }
    return stats;
  },
});
