import { query } from "./_generated/server";
import { requireAdminOrCreator } from "./lib/auth";
import { isLive } from "./lib/softDelete";

/** One-shot diagnostic to confirm the analytics seed actually hit real certs / units. */
export const diagAnalyticsSeed = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCreator(ctx);

    const users = await ctx.db.query("users").collect();
    const seedUsers = users.filter((u) =>
      /^analytics-seed-\d+@seed\.ccia\.test$/i.test(u.email),
    );
    const seedUserIds = new Set(seedUsers.map((u) => u._id));

    const up = await ctx.db.query("userProgress").collect();
    const ucp = await ctx.db.query("userContentProgress").collect();
    const tr = await ctx.db.query("testResults").collect();
    const ev = await ctx.db.query("contentProgressEvents").collect();

    const seededUp = up.filter((r) => seedUserIds.has(r.userId));
    const seededUcp = ucp.filter((r) => seedUserIds.has(r.userId));
    const seededTr = tr.filter((r) => seedUserIds.has(r.userId));
    const seededEv = ev.filter((r) => seedUserIds.has(r.userId));

    const unitsTouched = new Set(seededUp.map((r) => String(r.unitId)));

    const levels = (await ctx.db.query("certificationLevels").collect()).filter(
      (l) => isLive(l),
    );
    const levelsWithCompany = levels.filter((l) => l.companyId != null).length;
    const allUnits = (await ctx.db.query("units").collect()).filter((u) =>
      isLive(u),
    );
    const unitsWithNoProgress = allUnits.filter(
      (u) => !unitsTouched.has(String(u._id)),
    );
    const allContent = (await ctx.db.query("contentItems").collect()).filter(
      (c) => isLive(c) && c.type !== "workshop_session",
    );
    const contentTouchedIds = new Set(seededUcp.map((r) => String(r.contentId)));
    const contentWithNoProgress = allContent.filter(
      (c) => !contentTouchedIds.has(String(c._id)),
    );

    // Pick one unit that has seeded progress and count rows for it (mirrors unitStatsAdmin).
    let sampleUnitId: string | null = null;
    let sampleUnitTitle: string | null = null;
    let sampleUnitProgressCount = 0;
    let sampleUnitContentProgressCount = 0;
    let sampleUnitEventsCount = 0;
    for (const r of seededUp) {
      const unit = await ctx.db.get(r.unitId);
      if (isLive(unit)) {
        sampleUnitId = String(r.unitId);
        sampleUnitTitle = unit.title;
        const upForUnit = await ctx.db
          .query("userProgress")
          .withIndex("by_unit", (q) => q.eq("unitId", r.unitId))
          .collect();
        const ucpForUnit = await ctx.db
          .query("userContentProgress")
          .withIndex("by_unit", (q) => q.eq("unitId", r.unitId))
          .collect();
        const evForUnit = await ctx.db
          .query("contentProgressEvents")
          .withIndex("by_unit", (q) => q.eq("unitId", r.unitId))
          .collect();
        sampleUnitProgressCount = upForUnit.length;
        sampleUnitContentProgressCount = ucpForUnit.length;
        sampleUnitEventsCount = evForUnit.length;
        break;
      }
    }

    return {
      seedUsers: seedUsers.length,
      totals: {
        userProgress: up.length,
        userContentProgress: ucp.length,
        testResults: tr.length,
        contentProgressEvents: ev.length,
      },
      seededTotals: {
        userProgress: seededUp.length,
        userContentProgress: seededUcp.length,
        testResults: seededTr.length,
        contentProgressEvents: seededEv.length,
      },
      uniqueUnitsSeededInto: unitsTouched.size,
      totalLiveUnits: allUnits.length,
      unitsWithoutProgress: unitsWithNoProgress.map((u) => ({
        unitId: String(u._id),
        title: u.title,
        deliveryMode: u.deliveryMode ?? "self_paced",
      })),
      totalLiveContent: allContent.length,
      contentWithoutProgress: contentWithNoProgress.length,
      liveLevelCount: levels.length,
      liveLevelsWithCompanyScoping: levelsWithCompany,
      perUnitCounts: allUnits.map((u) => {
        const ups = up.filter((r) => String(r.unitId) === String(u._id));
        const ucps = ucp.filter((r) => String(r.unitId) === String(u._id));
        const evs = ev.filter((r) => String(r.unitId) === String(u._id));
        const doneThisWeek = ups.filter(
          (r) => r.completed && r.completedAt != null,
        ).length;
        return {
          unitId: String(u._id),
          title: u.title,
          learners: ups.length,
          doneThisWeek,
          contentRows: ucps.length,
          events: evs.length,
        };
      }),
      sampleUnit: sampleUnitId
        ? {
            unitId: sampleUnitId,
            title: sampleUnitTitle,
            userProgressRows: sampleUnitProgressCount,
            userContentProgressRows: sampleUnitContentProgressCount,
            contentProgressEventsRows: sampleUnitEventsCount,
          }
        : null,
    };
  },
});
