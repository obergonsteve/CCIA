import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { requireAdminOrCreator } from "./lib/auth";
import { isLive } from "./lib/softDelete";

const WEEKS = 10;
const MS_WEEK = 7 * 24 * 60 * 60 * 1000;

function weekLabels(now: number): string[] {
  const labels: string[] = [];
  for (let i = WEEKS - 1; i >= 0; i--) {
    const d = new Date(now - i * MS_WEEK);
    labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
  }
  return labels;
}

function bumpWeekBucket(
  now: number,
  at: number | undefined,
  buckets: number[],
): void {
  if (at == null) {
    return;
  }
  const w = Math.min(WEEKS - 1, Math.max(0, Math.floor((now - at) / MS_WEEK)));
  buckets[WEEKS - 1 - w] += 1;
}

export const unitStatsAdmin = query({
  args: { unitId: v.id("units") },
  handler: async (ctx, { unitId }) => {
    await requireAdminOrCreator(ctx);
    const unit = await ctx.db.get(unitId);
    if (!isLive(unit)) {
      return null;
    }
    const now = Date.now();
    const labels = weekLabels(now);

    const progresses = await ctx.db
      .query("userProgress")
      .withIndex("by_unit", (q) => q.eq("unitId", unitId))
      .collect();

    const events = await ctx.db
      .query("contentProgressEvents")
      .withIndex("by_unit", (q) => q.eq("unitId", unitId))
      .collect();

    const contentRows = await ctx.db
      .query("userContentProgress")
      .withIndex("by_unit", (q) => q.eq("unitId", unitId))
      .collect();

    const startsWeekly = Array.from({ length: WEEKS }, () => 0);
    const completesWeekly = Array.from({ length: WEEKS }, () => 0);
    for (const e of events) {
      if (e.kind === "start") {
        bumpWeekBucket(now, e.at, startsWeekly);
      } else if (e.kind === "complete") {
        bumpWeekBucket(now, e.at, completesWeekly);
      }
    }

    const contentStartedWeekly = Array.from({ length: WEEKS }, () => 0);
    const contentCompletedWeekly = Array.from({ length: WEEKS }, () => 0);
    for (const r of contentRows) {
      bumpWeekBucket(now, r.startedAt, contentStartedWeekly);
      bumpWeekBucket(now, r.completedAt, contentCompletedWeekly);
    }

    const unitCompleteWeekly = Array.from({ length: WEEKS }, () => 0);
    for (const p of progresses) {
      if (p.completed && p.completedAt != null) {
        bumpWeekBucket(now, p.completedAt, unitCompleteWeekly);
      }
    }

    const completedCount = progresses.filter((p) => p.completed).length;
    const inProgressCount = progresses.filter((p) => !p.completed).length;

    const learners: {
      userId: Id<"users">;
      name: string;
      email: string;
      companyName: string | null;
      completed: boolean;
      lastAccessed: number;
      completedAt: number | null;
    }[] = [];

    for (const p of progresses) {
      const u = await ctx.db.get(p.userId);
      if (!u) {
        continue;
      }
      const company = u.companyId ? await ctx.db.get(u.companyId) : null;
      learners.push({
        userId: p.userId,
        name: u.name,
        email: u.email,
        companyName: company?.name ?? null,
        completed: p.completed,
        lastAccessed: p.lastAccessed,
        completedAt: p.completedAt ?? null,
      });
    }
    learners.sort((a, b) => b.lastAccessed - a.lastAccessed);

    return {
      kind: "unit" as const,
      title: unit.title,
      uniqueLearners: progresses.length,
      completedCount,
      inProgressCount,
      weekLabels: labels,
      contentStartsWeekly: startsWeekly,
      contentCompletesWeekly: completesWeekly,
      userContentStartedWeekly: contentStartedWeekly,
      userContentCompletedWeekly: contentCompletedWeekly,
      unitCompletesWeekly: unitCompleteWeekly,
      learners,
    };
  },
});

export const certificationStatsAdmin = query({
  args: { levelId: v.id("certificationLevels") },
  handler: async (ctx, { levelId }) => {
    await requireAdminOrCreator(ctx);
    const level = await ctx.db.get(levelId);
    if (!isLive(level)) {
      return null;
    }
    const now = Date.now();
    const labels = weekLabels(now);

    const links = await ctx.db
      .query("certificationUnits")
      .withIndex("by_level", (q) => q.eq("levelId", levelId))
      .collect();
    const unitIds = links.map((l) => l.unitId);

    const userSet = new Set<Id<"users">>();
    let completedInstances = 0;
    const unitSummaries: {
      unitId: Id<"units">;
      title: string;
      learners: number;
      completed: number;
    }[] = [];

    const startsWeekly = Array.from({ length: WEEKS }, () => 0);
    const completesWeekly = Array.from({ length: WEEKS }, () => 0);
    const unitCompleteWeekly = Array.from({ length: WEEKS }, () => 0);
    const contentStartedWeekly = Array.from({ length: WEEKS }, () => 0);
    const contentCompletedWeekly = Array.from({ length: WEEKS }, () => 0);

    for (const uid of unitIds) {
      const unit = await ctx.db.get(uid);
      const title = isLive(unit) ? unit.title : "(removed unit)";
      const progresses = await ctx.db
        .query("userProgress")
        .withIndex("by_unit", (q) => q.eq("unitId", uid))
        .collect();
      for (const p of progresses) {
        userSet.add(p.userId);
        if (p.completed) {
          completedInstances += 1;
        }
      }
      unitSummaries.push({
        unitId: uid,
        title,
        learners: progresses.length,
        completed: progresses.filter((p) => p.completed).length,
      });

      const events = await ctx.db
        .query("contentProgressEvents")
        .withIndex("by_unit", (q) => q.eq("unitId", uid))
        .collect();
      for (const e of events) {
        if (e.kind === "start") {
          bumpWeekBucket(now, e.at, startsWeekly);
        } else if (e.kind === "complete") {
          bumpWeekBucket(now, e.at, completesWeekly);
        }
      }

      const contentRows = await ctx.db
        .query("userContentProgress")
        .withIndex("by_unit", (q) => q.eq("unitId", uid))
        .collect();
      for (const r of contentRows) {
        bumpWeekBucket(now, r.startedAt, contentStartedWeekly);
        bumpWeekBucket(now, r.completedAt, contentCompletedWeekly);
      }

      for (const p of progresses) {
        if (p.completed && p.completedAt != null) {
          bumpWeekBucket(now, p.completedAt, unitCompleteWeekly);
        }
      }
    }

    unitSummaries.sort((a, b) => a.title.localeCompare(b.title));

    return {
      kind: "certification" as const,
      title: level.name,
      unitCount: unitIds.length,
      uniqueLearners: userSet.size,
      completedUnitRows: completedInstances,
      weekLabels: labels,
      contentStartsWeekly: startsWeekly,
      contentCompletesWeekly: completesWeekly,
      userContentStartedWeekly: contentStartedWeekly,
      userContentCompletedWeekly: contentCompletedWeekly,
      unitCompletesWeekly: unitCompleteWeekly,
      units: unitSummaries,
    };
  },
});

export const contentStatsAdmin = query({
  args: { contentId: v.id("contentItems") },
  handler: async (ctx, { contentId }) => {
    await requireAdminOrCreator(ctx);
    const item = await ctx.db.get(contentId);
    if (!isLive(item)) {
      return null;
    }
    const now = Date.now();
    const labels = weekLabels(now);

    const ucpRows = await ctx.db
      .query("userContentProgress")
      .withIndex("by_content", (q) => q.eq("contentId", contentId))
      .collect();

    const events = await ctx.db
      .query("contentProgressEvents")
      .withIndex("by_content", (q) => q.eq("contentId", contentId))
      .collect();

    const eventStartsWeekly = Array.from({ length: WEEKS }, () => 0);
    const eventCompletesWeekly = Array.from({ length: WEEKS }, () => 0);
    const assessmentAttemptsWeekly = Array.from({ length: WEEKS }, () => 0);
    for (const e of events) {
      if (e.kind === "start") {
        bumpWeekBucket(now, e.at, eventStartsWeekly);
      } else if (e.kind === "complete") {
        bumpWeekBucket(now, e.at, eventCompletesWeekly);
      } else if (e.kind === "assessment_attempt") {
        bumpWeekBucket(now, e.at, assessmentAttemptsWeekly);
      }
    }

    const ucpStartedWeekly = Array.from({ length: WEEKS }, () => 0);
    const ucpCompletedWeekly = Array.from({ length: WEEKS }, () => 0);
    for (const r of ucpRows) {
      bumpWeekBucket(now, r.startedAt, ucpStartedWeekly);
      bumpWeekBucket(now, r.completedAt, ucpCompletedWeekly);
    }

    const testResultsWeekly = Array.from({ length: WEEKS }, () => 0);
    if (item.type === "test" || item.type === "assignment") {
      const results = await ctx.db
        .query("testResults")
        .withIndex("by_assessment_content", (q) =>
          q.eq("assessmentContentId", contentId),
        )
        .collect();
      for (const tr of results) {
        bumpWeekBucket(now, tr.completedAt, testResultsWeekly);
      }
    }

    const userSet = new Set<Id<"users">>();
    for (const r of ucpRows) {
      userSet.add(r.userId);
    }

    const failedOutcome = ucpRows.filter((r) => r.outcome === "failed").length;
    const completedStep = ucpRows.filter(
      (r) =>
        r.completedAt != null &&
        (r.outcome === "completed" || r.outcome === "passed"),
    ).length;

    const learners: {
      userId: Id<"users">;
      name: string;
      email: string;
      companyName: string | null;
      unitId: Id<"units">;
      unitTitle: string;
      startedAt: number;
      completedAt: number | null;
      outcome: string | null;
      score: number | null;
    }[] = [];

    for (const r of ucpRows) {
      const u = await ctx.db.get(r.userId);
      const unitDoc = await ctx.db.get(r.unitId);
      if (!u) {
        continue;
      }
      const company = u.companyId ? await ctx.db.get(u.companyId) : null;
      learners.push({
        userId: r.userId,
        name: u.name,
        email: u.email,
        companyName: company?.name ?? null,
        unitId: r.unitId,
        unitTitle: isLive(unitDoc) ? unitDoc.title : "(unit)",
        startedAt: r.startedAt,
        completedAt: r.completedAt ?? null,
        outcome: r.outcome ?? null,
        score: r.score ?? null,
      });
    }
    learners.sort((a, b) => b.startedAt - a.startedAt);

    return {
      kind: "content" as const,
      title: item.title,
      contentType: item.type,
      uniqueLearners: userSet.size,
      progressRows: ucpRows.length,
      completedOrPassed: completedStep,
      failedOutcome,
      weekLabels: labels,
      eventStartsWeekly,
      eventCompletesWeekly,
      assessmentAttemptsWeekly,
      userContentStartedWeekly: ucpStartedWeekly,
      userContentCompletedWeekly: ucpCompletedWeekly,
      testResultsWeekly,
      learners,
    };
  },
});
