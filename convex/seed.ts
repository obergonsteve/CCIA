import { mutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { LAND_LEASE_CURRICULUM, seedUnitKey } from "./curriculumSeedData";
import { requireAdminOrCreator } from "./lib/auth";

/** bcrypt cost 10 via bcryptjs — hashes for stevemoore / gillmoore (must match `auth.login`). */
const HASH_STEVE = "$2b$10$q9aiw4mBWZLc.OKxISlyeuQydcRVExVRFIX611C1V.1V0QStXkNn2";
const HASH_GILL = "$2b$10$y7dUJPgoY/l.QKIT1VtPY.Z31O7SKHS5zBbdq4lv81bGntZQrCTpG";

const CCIA_COMPANY_NAME = "CCIA";

const OPERATOR_COMPANIES = [
  CCIA_COMPANY_NAME,
  "Greenfield Land Lease Communities",
  "Riverside Community Operators",
  "Peninsula Land Lease Ltd",
  "Aurora Park Communities",
] as const;

/**
 * Idempotent: creates community-operator companies (including CCIA) and two admin users.
 * Run once: `npx convex run seed:seedCommunityOperatorsAndAdmins` (no auth required).
 * Re-run safely: updates password hashes and roles for the two emails if rows already exist.
 */
async function runSeedCommunityOperatorsAndAdmins(ctx: MutationCtx) {
  const companyByName = new Map<string, Id<"companies">>();
  for (const name of OPERATOR_COMPANIES) {
    const existing = await ctx.db
      .query("companies")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();
    const id =
      existing?._id ??
      (await ctx.db.insert("companies", {
        name,
      }));
    companyByName.set(name, id);
  }
  const cciaId = companyByName.get(CCIA_COMPANY_NAME)!;

  const admins = [
    {
      email: "steve.moore@ccia-landlease.com",
      name: "Steve Moore",
      passwordHash: HASH_STEVE,
    },
    {
      email: "gill.moore@ccia-landlease.com",
      name: "Gill Moore",
      passwordHash: HASH_GILL,
    },
  ] as const;

  for (const a of admins) {
    const email = a.email.toLowerCase().trim();
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        passwordHash: a.passwordHash,
        name: a.name,
        role: "admin",
        companyId: cciaId,
      });
    } else {
      await ctx.db.insert("users", {
        email,
        name: a.name,
        passwordHash: a.passwordHash,
        companyId: cciaId,
        role: "admin",
      });
    }
  }

  const adminUserIds = {} as Record<string, Id<"users">>;
  for (const a of admins) {
    const email = a.email.toLowerCase().trim();
    const row = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (row) {
      adminUserIds[email] = row._id;
    }
  }

  const steveEmail = "steve.moore@ccia-landlease.com";
  const steveId = adminUserIds[steveEmail];

  return {
    ok: true as const,
    companyIds: Object.fromEntries(companyByName),
    admins: admins.map((a) => a.email.toLowerCase()),
    adminUserIds,
    /** Optional: npx convex env set CONVEX_DEV_USER_ID "<id>" to pin identity; otherwise seed admin is used. */
    convexDevUserId: steveId ?? null,
  };
}

export const seedCommunityOperatorsAndAdmins = mutation({
  args: {},
  handler: async (ctx) => runSeedCommunityOperatorsAndAdmins(ctx),
});

/** One-click demo structure for local testing (admin only). */
export const bootstrapDemo = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCreator(ctx);
    const companies = await ctx.db.query("companies").take(1);
    const companyId =
      companies.length > 0
        ? companies[0]!._id
        : await ctx.db.insert("companies", {
            name: "Demo Land Lease Operator",
          });
    const levelId = await ctx.db.insert("certificationLevels", {
      name: "Level 1 — Foundations",
      summary:
        "Introduction to residential land lease community operations in Australia.",
      description:
        "Introduction to residential land lease community operations in Australia — governance, site models, and how legislation shapes day-to-day management.",
      order: 0,
      companyId: undefined,
    });
    const unitId = await ctx.db.insert("units", {
      title: "Compliance orientation",
      description:
        "Key obligations under the Residential (Land Lease) Communities Act and operator duties.",
    });
    await ctx.db.insert("certificationUnits", {
      levelId,
      unitId,
      order: 0,
    });
    const contentId = await ctx.db.insert("contentItems", {
      type: "link",
      title: "NSW Fair Trading — Land lease communities",
      url: "https://www.fairtrading.nsw.gov.au/",
    });
    await ctx.db.insert("unitContents", {
      unitId,
      contentId,
      order: 0,
    });
    const assessId = await ctx.db.insert("contentItems", {
      type: "assignment",
      title: "Orientation checkpoint",
      url: "",
      assessment: {
        description: "Confirm you have reviewed the supporting material.",
        passingScore: 80,
        questions: [
          {
            id: "q1",
            question:
              "Operators should stay informed of legislative and industry standards.",
            type: "multiple_choice",
            options: ["True", "False"],
            correctAnswer: "True",
          },
        ],
      },
    });
    await ctx.db.insert("unitContents", {
      unitId,
      contentId: assessId,
      order: 1,
    });
    return { companyId, levelId, unitId };
  },
});

const CURRICULUM_MARKER = "Land Lease 101";

async function runInsertLandLeaseCurriculum(ctx: MutationCtx) {
  const levelIds: Id<"certificationLevels">[] = [];
  const unitIdBySeedKey = new Map<string, Id<"units">>();

  for (const course of LAND_LEASE_CURRICULUM) {
    const levelId = await ctx.db.insert("certificationLevels", {
      name: course.name,
      summary: course.summary,
      description: course.description,
      tagline: course.tagline,
      thumbnailUrl: course.thumbnailUrl,
      order: course.order,
      companyId: undefined,
    });
    levelIds.push(levelId);

    for (const unit of course.units) {
      const unitId = await ctx.db.insert("units", {
        title: unit.title,
        description: unit.description,
      });
      await ctx.db.insert("certificationUnits", {
        levelId,
        unitId,
        order: unit.order,
      });
      unitIdBySeedKey.set(seedUnitKey(course.name, unit.title), unitId);
      for (const c of unit.content) {
        const contentId = await ctx.db.insert("contentItems", {
          type: c.type,
          title: c.title,
          url: c.url,
          ...(c.duration !== undefined ? { duration: c.duration } : {}),
        });
        await ctx.db.insert("unitContents", {
          unitId,
          contentId,
          order: c.order,
        });
      }
      const assessContentId = await ctx.db.insert("contentItems", {
        type: "assignment",
        title: unit.assignment.title,
        url: "",
        assessment: {
          description: unit.assignment.description,
          passingScore: unit.assignment.passingScore,
          questions: unit.assignment.questions,
        },
      });
      await ctx.db.insert("unitContents", {
        unitId,
        contentId: assessContentId,
        order: unit.content.length,
      });
    }
  }

  let prerequisiteCount = 0;
  for (const course of LAND_LEASE_CURRICULUM) {
    for (const unit of course.units) {
      const unitId = unitIdBySeedKey.get(seedUnitKey(course.name, unit.title));
      if (!unitId || !unit.prerequisites?.length) {
        continue;
      }
      for (const p of unit.prerequisites) {
        const prerequisiteUnitId = unitIdBySeedKey.get(
          seedUnitKey(p.courseName, p.unitTitle),
        );
        if (!prerequisiteUnitId) {
          throw new Error(
            `Seed prerequisite missing: ${p.courseName} — ${p.unitTitle}`,
          );
        }
        await ctx.db.insert("unitPrerequisites", {
          unitId,
          prerequisiteUnitId,
        });
        prerequisiteCount += 1;
      }
    }
  }

  return {
    levelCount: levelIds.length,
    unitCount: LAND_LEASE_CURRICULUM.reduce((n, c) => n + c.units.length, 0),
    prerequisiteCount,
  };
}

async function landLeaseCurriculumAlreadySeeded(ctx: MutationCtx) {
  const allLevels = await ctx.db.query("certificationLevels").collect();
  return allLevels.some(
    (l) => l.name === CURRICULUM_MARKER && l.companyId === undefined,
  );
}

/**
 * Dummy certifications, units, lessons (video/slideshow/link), and quizzes for land lease managers.
 * Idempotent: skips if a global level named «Land Lease 101» already exists.
 * Run: `npx convex run seed:seedLandLeaseCurriculum` (and `--prod` for production).
 */
export const seedLandLeaseCurriculum = mutation({
  args: {},
  handler: async (ctx) => {
    const exists = await landLeaseCurriculumAlreadySeeded(ctx);
    if (exists) {
      return {
        ok: true as const,
        skipped: true as const,
        message:
          "Already seeded (global «Land Lease 101» exists). Remove those levels in dashboard to re-run.",
      };
    }
    const stats = await runInsertLandLeaseCurriculum(ctx);
    return {
      ok: true as const,
      skipped: false as const,
      ...stats,
    };
  },
});

/**
 * Admin: delete all certification levels, units, content, assignments, prerequisites, and learner progress/results.
 * Preserves companies and users.
 */
export const adminClearTrainingData = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCreator(ctx);
    const counts = {
      testResults: 0,
      userProgress: 0,
      unitPrerequisites: 0,
      unitContents: 0,
      certificationUnits: 0,
      contentItems: 0,
      assignments: 0,
      units: 0,
      certificationLevels: 0,
    };
    for (const row of await ctx.db.query("testResults").collect()) {
      await ctx.db.delete(row._id);
      counts.testResults += 1;
    }
    for (const row of await ctx.db.query("userProgress").collect()) {
      await ctx.db.delete(row._id);
      counts.userProgress += 1;
    }
    for (const row of await ctx.db.query("unitPrerequisites").collect()) {
      await ctx.db.delete(row._id);
      counts.unitPrerequisites += 1;
    }
    for (const row of await ctx.db.query("unitContents").collect()) {
      await ctx.db.delete(row._id);
      counts.unitContents += 1;
    }
    for (const row of await ctx.db.query("certificationUnits").collect()) {
      await ctx.db.delete(row._id);
      counts.certificationUnits += 1;
    }
    for (const row of await ctx.db.query("contentItems").collect()) {
      await ctx.db.delete(row._id);
      counts.contentItems += 1;
    }
    for (const row of await ctx.db.query("assignments").collect()) {
      await ctx.db.delete(row._id);
      counts.assignments += 1;
    }
    for (const row of await ctx.db.query("units").collect()) {
      await ctx.db.delete(row._id);
      counts.units += 1;
    }
    for (const row of await ctx.db.query("certificationLevels").collect()) {
      await ctx.db.delete(row._id);
      counts.certificationLevels += 1;
    }
    return { ok: true as const, counts };
  },
});

/**
 * Admin: ensure demo companies + admin accounts, then insert Land Lease curriculum if missing.
 */
export const adminSeedTrainingDatabase = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCreator(ctx);
    const operators = await runSeedCommunityOperatorsAndAdmins(ctx);
    const exists = await landLeaseCurriculumAlreadySeeded(ctx);
    if (exists) {
      return {
        ok: true as const,
        operators,
        curriculumSkipped: true as const,
        message:
          "Curriculum already present («Land Lease 101»). Use Clear training data first to re-seed.",
      };
    }
    const stats = await runInsertLandLeaseCurriculum(ctx);
    return {
      ok: true as const,
      operators,
      curriculumSkipped: false as const,
      ...stats,
    };
  },
});
