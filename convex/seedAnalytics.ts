import { v } from "convex/values";
import { mutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAdminOrCreator } from "./lib/auth";
import { isLive } from "./lib/softDelete";

/**
 * Analytics demo seed — populates the three admin stats sheets
 * (`adminStats.unitStatsAdmin`, `certificationStatsAdmin`, `contentStatsAdmin`)
 * with realistic traffic on existing certs / units / content.
 *
 * Safe to re-run. Identifies its own rows via:
 *   - users: email matches `ANALYTICS_SEED_EMAIL_RE`
 *   - company: name === ANALYTICS_SEED_COMPANY_NAME
 * `clearAnalyticsDemoData` removes exactly those + any progress rows owned by
 * those users. Real data (curriculum, admins, companies) is never touched.
 */

const ANALYTICS_SEED_COMPANY_NAME = "Analytics Seed Co";
const ANALYTICS_SEED_EMAIL_DOMAIN = "seed.ccia.test";
const ANALYTICS_SEED_EMAIL_PREFIX = "analytics-seed-";
const ANALYTICS_SEED_EMAIL_RE =
  /^analytics-seed-\d+@seed\.ccia\.test$/i;

/** Placeholder bcrypt hash — these accounts are analytics fixtures, not log-in accounts. */
const SEED_PASSWORD_HASH =
  "$2b$10$q9aiw4mBWZLc.OKxISlyeuQydcRVExVRFIX611C1V.1V0QStXkNn2";

const DEFAULT_USER_COUNT = 20;
const DEFAULT_WEEKS_BACK = 10;
const MS_WEEK = 7 * 24 * 60 * 60 * 1000;

const SEED_FIRST_NAMES = [
  "Avery", "Blake", "Casey", "Dana", "Elliot", "Frankie", "Gabe", "Harper",
  "Indie", "Jules", "Kai", "Logan", "Morgan", "Noor", "Ollie", "Parker",
  "Quinn", "Riley", "Sage", "Tatum",
];
const SEED_LAST_NAMES = [
  "Hartley", "Brennan", "Cole", "Drummond", "Easton", "Flynn", "Grove",
  "Halliday", "Isaacs", "Jameson", "Keane", "Lindgren", "Mercer", "Nash",
  "Oakes", "Price", "Quincey", "Ramos", "Sinclair", "Tindall",
];

/** Deterministic PRNG so repeated runs distribute traffic similarly. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
function pickInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}
function pickOne<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}
function chance(rng: () => number, p: number): boolean {
  return rng() < p;
}
function shuffled<T>(rng: () => number, arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Returns a random timestamp within the last `weeksBack` weeks, biased slightly toward more recent. */
function randomRecentTs(
  rng: () => number,
  now: number,
  weeksBack: number,
): number {
  const ageMs = Math.floor(rng() * weeksBack * MS_WEEK);
  return now - ageMs;
}

async function getOrInsertSeedCompany(
  ctx: MutationCtx,
  now: number,
): Promise<Id<"companies">> {
  const existing = await ctx.db
    .query("companies")
    .withIndex("by_name", (q) => q.eq("name", ANALYTICS_SEED_COMPANY_NAME))
    .first();
  if (existing) {
    return existing._id;
  }
  return await ctx.db.insert("companies", {
    name: ANALYTICS_SEED_COMPANY_NAME,
    status: "active",
    joinedAt: now,
  });
}

async function listOtherRealCompanies(
  ctx: MutationCtx,
): Promise<Id<"companies">[]> {
  const all = await ctx.db.query("companies").collect();
  return all
    .filter((c) => c.name !== ANALYTICS_SEED_COMPANY_NAME)
    .map((c) => c._id);
}

async function ensureSeedUsers(
  ctx: MutationCtx,
  count: number,
  seedCompanyId: Id<"companies">,
  otherCompanyIds: Id<"companies">[],
  rng: () => number,
): Promise<Doc<"users">[]> {
  const existing = await ctx.db.query("users").collect();
  const byEmail = new Map(existing.map((u) => [u.email.toLowerCase(), u]));

  const result: Doc<"users">[] = [];
  for (let i = 1; i <= count; i++) {
    const num = String(i).padStart(2, "0");
    const email = `${ANALYTICS_SEED_EMAIL_PREFIX}${num}@${ANALYTICS_SEED_EMAIL_DOMAIN}`;
    const first = pickOne(rng, SEED_FIRST_NAMES);
    const last = pickOne(rng, SEED_LAST_NAMES);
    const name = `${first} ${last} (seed ${num})`;
    // ~60% in the dedicated seed company, ~40% spread across existing companies
    // (so cert-level company filters can still match real operator companies).
    const companyId =
      otherCompanyIds.length > 0 && chance(rng, 0.4)
        ? pickOne(rng, otherCompanyIds)
        : seedCompanyId;
    const hit = byEmail.get(email.toLowerCase());
    if (hit) {
      if (hit.companyId !== companyId || hit.name !== name) {
        await ctx.db.patch(hit._id, {
          companyId,
          name,
          accountType: "member",
        });
      }
      const refreshed = (await ctx.db.get(hit._id)) as Doc<"users">;
      result.push(refreshed);
    } else {
      const id = await ctx.db.insert("users", {
        email,
        name,
        passwordHash: SEED_PASSWORD_HASH,
        companyId,
        accountType: "member",
        role: "operator",
      });
      const created = (await ctx.db.get(id)) as Doc<"users">;
      result.push(created);
    }
  }
  return result;
}

async function listLiveLevels(
  ctx: MutationCtx,
): Promise<Doc<"certificationLevels">[]> {
  const all = await ctx.db.query("certificationLevels").collect();
  return all.filter((l) => isLive(l));
}

async function listLevelUnits(
  ctx: MutationCtx,
  levelId: Id<"certificationLevels">,
): Promise<Doc<"units">[]> {
  const links = await ctx.db
    .query("certificationUnits")
    .withIndex("by_level", (q) => q.eq("levelId", levelId))
    .collect();
  const units: Doc<"units">[] = [];
  for (const l of links) {
    const u = await ctx.db.get(l.unitId);
    if (isLive(u)) {
      units.push(u);
    }
  }
  return units;
}

async function listUnitContents(
  ctx: MutationCtx,
  unitId: Id<"units">,
): Promise<Doc<"contentItems">[]> {
  const links = await ctx.db
    .query("unitContents")
    .withIndex("by_unit", (q) => q.eq("unitId", unitId))
    .collect();
  const items: Doc<"contentItems">[] = [];
  for (const l of links) {
    const c = await ctx.db.get(l.contentId);
    if (isLive(c) && c.type !== "workshop_session") {
      items.push(c);
    }
  }
  return items;
}

type PerUserSummary = {
  userId: Id<"users">;
  unitProgressInserted: number;
  contentProgressInserted: number;
  eventsInserted: number;
  testResultsInserted: number;
};

export async function wipeProgressForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  // userProgress + userContentProgress via `by_user_unit` require unitId arg,
  // so we fall back to full-table queries filtered by userId. Seed data volumes
  // are small so this is fine.
  const up = await ctx.db
    .query("userProgress")
    .filter((q) => q.eq(q.field("userId"), userId))
    .collect();
  for (const row of up) {
    await ctx.db.delete(row._id);
  }
  const ucp = await ctx.db
    .query("userContentProgress")
    .filter((q) => q.eq(q.field("userId"), userId))
    .collect();
  for (const row of ucp) {
    await ctx.db.delete(row._id);
  }
  const uap = await ctx.db
    .query("userAssignmentProgress")
    .filter((q) => q.eq(q.field("userId"), userId))
    .collect();
  for (const row of uap) {
    await ctx.db.delete(row._id);
  }
  const tr = await ctx.db
    .query("testResults")
    .filter((q) => q.eq(q.field("userId"), userId))
    .collect();
  for (const row of tr) {
    await ctx.db.delete(row._id);
  }
  const ev = await ctx.db
    .query("contentProgressEvents")
    .filter((q) => q.eq(q.field("userId"), userId))
    .collect();
  for (const row of ev) {
    await ctx.db.delete(row._id);
  }
}

async function seedForUser(args: {
  ctx: MutationCtx;
  user: Doc<"users">;
  levels: Doc<"certificationLevels">[];
  weeksBack: number;
  now: number;
  rng: () => number;
  /** Optional explicit unit list (used by the coverage pass). */
  forcedUnits?: Doc<"units">[];
}): Promise<PerUserSummary> {
  const { ctx, user, levels, weeksBack, now, rng, forcedUnits } = args;
  const summary: PerUserSummary = {
    userId: user._id,
    unitProgressInserted: 0,
    contentProgressInserted: 0,
    eventsInserted: 0,
    testResultsInserted: 0,
  };

  const accessible = levels.filter(
    (l) => l.companyId == null || l.companyId === user.companyId,
  );
  if (accessible.length === 0 && !forcedUnits) {
    return summary;
  }

  type UnitGroup = {
    cert: Doc<"certificationLevels"> | null;
    units: Doc<"units">[];
  };
  let groups: UnitGroup[];
  if (forcedUnits && forcedUnits.length > 0) {
    groups = [{ cert: null, units: forcedUnits }];
  } else {
    // Broad coverage: each user touches ~75-100% of accessible certs, and ~65-100% of units within each.
    const certSubsetSize = Math.max(
      1,
      Math.floor(accessible.length * (0.75 + rng() * 0.25)),
    );
    const certs = shuffled(rng, accessible).slice(0, certSubsetSize);
    groups = [];
    for (const cert of certs) {
      const units = await listLevelUnits(ctx, cert._id);
      if (units.length === 0) {
        continue;
      }
      const unitSubsetSize = Math.max(
        1,
        Math.floor(units.length * (0.65 + rng() * 0.35)),
      );
      groups.push({
        cert,
        units: shuffled(rng, units).slice(0, unitSubsetSize),
      });
    }
  }

  for (const group of groups) {
    const chosenUnits = group.units;
    if (chosenUnits.length === 0) {
      continue;
    }

    for (const unit of chosenUnits) {
      const unitStartedAt = randomRecentTs(rng, now, weeksBack);
      const unitRoll = rng();
      // 55% complete unit, 35% in-progress, 10% barely started.
      const unitCompleted = unitRoll < 0.55;
      const unitInProgress = !unitCompleted && unitRoll < 0.9;

      const contents = await listUnitContents(ctx, unit._id);

      let maxCompletedAt = 0;
      let lastAccessed = unitStartedAt;

      for (const content of contents) {
        const startedAt =
          unitStartedAt + pickInt(rng, 0, 3) * 24 * 60 * 60 * 1000 + pickInt(rng, 0, 60 * 60 * 1000);
        lastAccessed = Math.max(lastAccessed, startedAt);

        await ctx.db.insert("contentProgressEvents", {
          userId: user._id,
          unitId: unit._id,
          contentId: content._id,
          kind: "start",
          at: startedAt,
        });
        summary.eventsInserted += 1;

        const isAssessment =
          content.type === "test" || content.type === "assignment";

        // Engagement rules differ for assessments (may have multiple attempts)
        // vs passive content (start + optional complete).
        if (!isAssessment) {
          const completeRoll = rng();
          const doComplete =
            unitCompleted || (unitInProgress && completeRoll < 0.75);
          if (doComplete) {
            const durationMs = pickInt(rng, 90_000, 45 * 60 * 1000);
            const completedAt = startedAt + durationMs;
            await ctx.db.insert("userContentProgress", {
              userId: user._id,
              unitId: unit._id,
              contentId: content._id,
              startedAt,
              completedAt,
              durationMs,
              outcome: "completed",
            });
            summary.contentProgressInserted += 1;
            await ctx.db.insert("contentProgressEvents", {
              userId: user._id,
              unitId: unit._id,
              contentId: content._id,
              kind: "complete",
              at: completedAt,
              durationMs,
            });
            summary.eventsInserted += 1;
            maxCompletedAt = Math.max(maxCompletedAt, completedAt);
            lastAccessed = Math.max(lastAccessed, completedAt);
          } else {
            await ctx.db.insert("userContentProgress", {
              userId: user._id,
              unitId: unit._id,
              contentId: content._id,
              startedAt,
            });
            summary.contentProgressInserted += 1;
          }
          continue;
        }

        // Assessment content: 1-3 attempts; eventual pass depends on unit state.
        const passingScore = content.assessment?.passingScore ?? 70;
        const willEventuallyPass =
          unitCompleted || (unitInProgress && chance(rng, 0.6));
        const attempts = willEventuallyPass ? pickInt(rng, 1, 3) : pickInt(rng, 1, 2);
        let attemptAt = startedAt;
        let finalPassed = false;
        let finalScore = 0;
        let finalCompletedAt: number | undefined;
        let finalDurationMs: number | undefined;
        for (let i = 0; i < attempts; i++) {
          attemptAt += pickInt(rng, 2 * 60_000, 60 * 60 * 1000);
          const isLast = i === attempts - 1;
          const passed = willEventuallyPass && isLast;
          const score = passed
            ? pickInt(rng, passingScore, 100)
            : pickInt(rng, Math.max(0, passingScore - 40), passingScore - 5);
          const durationMs = pickInt(rng, 3 * 60_000, 25 * 60 * 1000);
          await ctx.db.insert("testResults", {
            userId: user._id,
            assessmentContentId: content._id,
            score,
            answers: [],
            passed,
            completedAt: attemptAt,
          });
          summary.testResultsInserted += 1;
          await ctx.db.insert("contentProgressEvents", {
            userId: user._id,
            unitId: unit._id,
            contentId: content._id,
            kind: "assessment_attempt",
            at: attemptAt,
            durationMs,
            score,
            passed,
          });
          summary.eventsInserted += 1;
          finalPassed = passed;
          finalScore = score;
          finalDurationMs = durationMs;
          if (passed) {
            finalCompletedAt = attemptAt;
          }
        }
        await ctx.db.insert("userContentProgress", {
          userId: user._id,
          unitId: unit._id,
          contentId: content._id,
          startedAt,
          completedAt: finalCompletedAt,
          durationMs: finalDurationMs,
          outcome: finalPassed ? "passed" : "failed",
          score: finalScore,
        });
        summary.contentProgressInserted += 1;
        if (finalCompletedAt != null) {
          maxCompletedAt = Math.max(maxCompletedAt, finalCompletedAt);
          lastAccessed = Math.max(lastAccessed, finalCompletedAt);
        } else {
          lastAccessed = Math.max(lastAccessed, attemptAt);
        }
      }

      const unitCompletedAt =
        unitCompleted && maxCompletedAt > 0 ? maxCompletedAt : undefined;
      await ctx.db.insert("userProgress", {
        userId: user._id,
        unitId: unit._id,
        completed: unitCompleted && unitCompletedAt != null,
        completedAt: unitCompletedAt,
        lastAccessed,
      });
      summary.unitProgressInserted += 1;
    }
  }

  return summary;
}

export type SeedAnalyticsDemoCoreArgs = {
  userCount?: number;
  weeksBack?: number;
  reset?: boolean;
};

/** Shared body for `seed:seedAnalyticsDemo` and `seed:seedFullDemo` (no auth check). */
export async function runSeedAnalyticsDemoCore(
  ctx: MutationCtx,
  args: SeedAnalyticsDemoCoreArgs,
) {
  const userCount = Math.max(1, args.userCount ?? DEFAULT_USER_COUNT);
  const weeksBack = Math.max(1, args.weeksBack ?? DEFAULT_WEEKS_BACK);
  const reset = args.reset === true;
  const now = Date.now();
  const rng = makeRng(0xc01a | userCount);

  const seedCompanyId = await getOrInsertSeedCompany(ctx, now);
  const otherCompanyIds = await listOtherRealCompanies(ctx);
  const users = await ensureSeedUsers(
    ctx,
    userCount,
    seedCompanyId,
    otherCompanyIds,
    rng,
  );

  if (reset) {
    for (const u of users) {
      await wipeProgressForUser(ctx, u._id);
    }
  }

  const levels = await listLiveLevels(ctx);
  if (levels.length === 0) {
    return {
      ok: false as const,
      reason:
        "No live certification levels found. Run seed:seedLandLeaseCurriculum first.",
      userCount: users.length,
    };
  }

  const summaries: PerUserSummary[] = [];
  for (const u of users) {
    const s = await seedForUser({
      ctx,
      user: u,
      levels,
      weeksBack,
      now,
      rng,
    });
    summaries.push(s);
  }

  // Coverage pass: every live unit across every cert should have at least
  // `MIN_LEARNERS_PER_UNIT` seeded learners, otherwise admins who open a
  // cold unit still see empty charts.
  const MIN_LEARNERS_PER_UNIT = 4;
  const allUnitDocs: Doc<"units">[] = [];
  const seenUnitIds = new Set<string>();
  for (const level of levels) {
    const units = await listLevelUnits(ctx, level._id);
    for (const u of units) {
      const k = String(u._id);
      if (seenUnitIds.has(k)) {
        continue;
      }
      seenUnitIds.add(k);
      allUnitDocs.push(u);
    }
  }

  for (const unit of allUnitDocs) {
    const existing = await ctx.db
      .query("userProgress")
      .withIndex("by_unit", (q) => q.eq("unitId", unit._id))
      .collect();
    const existingUserIds = new Set(existing.map((r) => String(r.userId)));
    const shortfall = Math.max(0, MIN_LEARNERS_PER_UNIT - existingUserIds.size);
    if (shortfall === 0) {
      continue;
    }
    const candidates = users.filter(
      (u) => !existingUserIds.has(String(u._id)),
    );
    if (candidates.length === 0) {
      continue;
    }
    const picks = shuffled(rng, candidates).slice(0, shortfall);
    for (const picked of picks) {
      const s = await seedForUser({
        ctx,
        user: picked,
        levels,
        weeksBack,
        now,
        rng,
        forcedUnits: [unit],
      });
      const agg = summaries.find((row) => row.userId === picked._id);
      if (agg) {
        agg.unitProgressInserted += s.unitProgressInserted;
        agg.contentProgressInserted += s.contentProgressInserted;
        agg.eventsInserted += s.eventsInserted;
        agg.testResultsInserted += s.testResultsInserted;
      } else {
        summaries.push(s);
      }
    }
  }

  const totals = summaries.reduce(
    (acc, s) => {
      acc.unitProgressInserted += s.unitProgressInserted;
      acc.contentProgressInserted += s.contentProgressInserted;
      acc.eventsInserted += s.eventsInserted;
      acc.testResultsInserted += s.testResultsInserted;
      return acc;
    },
    {
      unitProgressInserted: 0,
      contentProgressInserted: 0,
      eventsInserted: 0,
      testResultsInserted: 0,
    },
  );

  return {
    ok: true as const,
    userCount: users.length,
    weeksBack,
    reset,
    ...totals,
  };
}

export const seedAnalyticsDemo = mutation({
  args: {
    userCount: v.optional(v.number()),
    weeksBack: v.optional(v.number()),
    /** If true, wipes progress/results/events for previously seeded users before reseeding. */
    reset: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCreator(ctx);
    return await runSeedAnalyticsDemoCore(ctx, args);
  },
});

export const clearAnalyticsDemoData = mutation({
  args: {
    /** Also delete the demo company (only if no non-seeded users remain on it). */
    removeDemoCompany: v.optional(v.boolean()),
  },
  handler: async (ctx, { removeDemoCompany }) => {
    await requireAdminOrCreator(ctx);

    const allUsers = await ctx.db.query("users").collect();
    const seedUsers = allUsers.filter((u) =>
      ANALYTICS_SEED_EMAIL_RE.test(u.email),
    );
    let deletedUsers = 0;
    for (const u of seedUsers) {
      await wipeProgressForUser(ctx, u._id);
      await ctx.db.delete(u._id);
      deletedUsers += 1;
    }

    let deletedCompany = false;
    if (removeDemoCompany) {
      const company = await ctx.db
        .query("companies")
        .withIndex("by_name", (q) =>
          q.eq("name", ANALYTICS_SEED_COMPANY_NAME),
        )
        .first();
      if (company) {
        const remaining = await ctx.db
          .query("users")
          .withIndex("by_company", (q) => q.eq("companyId", company._id))
          .first();
        if (!remaining) {
          await ctx.db.delete(company._id);
          deletedCompany = true;
        }
      }
    }

    return { ok: true as const, deletedUsers, deletedCompany };
  },
});
