import { mutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  LAND_LEASE_CURRICULUM,
  seedUnitKey,
  type SeedContent,
} from "./curriculumSeedData";
import {
  allocateUniqueCertificationCode,
  allocateUniqueContentCode,
  allocateUniqueUnitCode,
  SEED_CODE_BASE_MAX_LEN,
} from "./lib/entityCodes";
import { requireAdminOrCreator } from "./lib/auth";
import { isLive } from "./lib/softDelete";

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

const SEED_CONTENT_CATEGORY_ASSESSMENT = "Quizzes & assessments";

function seededShortDescriptionForLessonContent(args: {
  unitTitle: string;
  contentTitle: string;
  type: SeedContent["type"];
}): string {
  const u = args.unitTitle.trim();
  const t = args.contentTitle.trim();
  const kind =
    args.type === "video"
      ? "Video"
      : args.type === "slideshow"
        ? "Slide deck"
        : args.type === "pdf"
          ? "PDF reference"
          : "Link";
  return `${kind} for “${u}”: ${t}.`;
}

function seededShortDescriptionForAssessment(
  title: string,
  description: string,
): string {
  const line = description.split(/\r?\n/)[0]?.trim() ?? "";
  if (line.length > 0) {
    return line.length > 220 ? `${line.slice(0, 217)}…` : line;
  }
  return `Graded step — ${title.trim()}.`;
}

function shortDescriptionFromContentRow(row: Doc<"contentItems">): string {
  const title = row.title.trim();
  if (row.type === "test" || row.type === "assignment") {
    const intro = row.assessment?.description?.trim() ?? "";
    return seededShortDescriptionForAssessment(title, intro);
  }
  if (row.type === "workshop_session") {
    return `${title} — register for a scheduled live workshop session.`;
  }
  const kind =
    row.type === "video"
      ? "Video"
      : row.type === "slideshow"
        ? "Slide deck"
        : row.type === "pdf"
          ? "PDF"
          : "Link";
  return `${kind}: ${title}`;
}

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
    const certSort = { n: 0 };
    const unitSort = { n: 0 };
    const contentSort = { n: 0 };
    const demoCertCat = await getOrInsertCertCategory(
      ctx,
      "Demo & onboarding",
      "Demo & onboarding — sample certification grouping",
      certSort,
    );
    const demoUnitCat = await getOrInsertUnitCategory(
      ctx,
      "Law & compliance basics",
      "Law & compliance basics — sample unit grouping",
      unitSort,
    );
    const demoContentCatLink = await getOrInsertContentCategory(
      ctx,
      "Regulators & web resources",
      "Regulators & web resources — links and references",
      contentSort,
    );
    const demoContentCatAssess = await getOrInsertContentCategory(
      ctx,
      SEED_CONTENT_CATEGORY_ASSESSMENT,
      "Quizzes & assessments — tests and assignments",
      contentSort,
    );
    const levelId = await ctx.db.insert("certificationLevels", {
      code: await allocateUniqueCertificationCode(
        ctx,
        "Level 1 — Foundations",
        { maxBaseLen: SEED_CODE_BASE_MAX_LEN },
      ),
      name: "Level 1 — Foundations",
      certificationCategoryId: demoCertCat,
      summary:
        "Introduction to residential land lease community operations in Australia.",
      description:
        "Introduction to residential land lease community operations in Australia — governance, site models, and how legislation shapes day-to-day management.",
      order: 0,
      companyId: undefined,
      certificationTier: "bronze",
    });
    const unitId = await ctx.db.insert("units", {
      code: await allocateUniqueUnitCode(ctx, "Compliance orientation", {
        maxBaseLen: SEED_CODE_BASE_MAX_LEN,
      }),
      title: "Compliance orientation",
      description:
        "Key obligations under the Residential (Land Lease) Communities Act and operator duties.",
      unitCategoryId: demoUnitCat,
    });
    await ctx.db.insert("certificationUnits", {
      levelId,
      unitId,
      order: 0,
    });
    const contentId = await ctx.db.insert("contentItems", {
      code: await allocateUniqueContentCode(
        ctx,
        "NSW Fair Trading — Land lease communities",
      ),
      type: "link",
      title: "NSW Fair Trading — Land lease communities",
      url: "https://www.fairtrading.nsw.gov.au/",
      contentCategoryId: demoContentCatLink,
      shortDescription:
        "NSW regulator hub for land lease community rules, forms, and publications.",
    });
    await ctx.db.insert("unitContents", {
      unitId,
      contentId,
      order: 0,
    });
    const assessId = await ctx.db.insert("contentItems", {
      code: await allocateUniqueContentCode(ctx, "Orientation checkpoint"),
      type: "assignment",
      title: "Orientation checkpoint",
      url: "",
      contentCategoryId: demoContentCatAssess,
      shortDescription:
        "Confirm you have reviewed the orientation materials before moving on.",
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

/** Matches admin unit-category chips — one bucket per certification theme. */
function seededUnitCategoryForCourse(courseName: string): string {
  switch (courseName) {
    case "Land Lease 101":
      return "Foundations & day-to-day";
    case "Compliance & the Act":
      return "Law, agreements & disclosure";
    case "Site Safety & WHS":
      return "Hazards, controls & contractors";
    case "Resident Experience & Fair Dealing":
      return "Communications & complaints";
    case "Commercials, Fees & Asset Care":
      return "Fees, transparency & upkeep";
    default:
      return "Learning modules";
  }
}

/** Matches admin content-category chips — by lesson media type. */
function seededContentCategoryForLesson(type: SeedContent["type"]): string {
  switch (type) {
    case "video":
      return "Video lessons";
    case "slideshow":
      return "Slide decks & walkthroughs";
    case "link":
      return "Regulators & web resources";
    case "pdf":
      return "PDFs & templates";
    default:
      return "Learning resources";
  }
}

function certificationTierForCourseName(
  name: string,
): "bronze" | "silver" | "gold" {
  if (name === "Land Lease 101") {
    return "bronze";
  }
  if (name === "Commercials, Fees & Asset Care") {
    return "gold";
  }
  return "silver";
}

/** Same short demo clip as `curriculumSeedData` (HTML5-friendly). */
const SEED_WORKSHOP_DEMO_VIDEO_URL =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

function maxSeedUnitOrderInCourse(courseName: string): number {
  const course = LAND_LEASE_CURRICULUM.find((c) => c.name === courseName);
  if (!course?.units.length) {
    return -1;
  }
  return Math.max(...course.units.map((u) => u.order));
}

type SeededWorkshopUnitSpec = {
  courseName: string;
  title: string;
  description: string;
  videoTitle: string;
  linkTitle: string;
  linkUrl: string;
  sessionStepTitle: string;
  /** ISO 8601 — fixed times so the admin timetable shows predictable dots. */
  sessionStartIso: string;
  sessionEndIso: string;
  assignmentTitle: string;
};

/**
 * One live-workshop unit per listed certification: pre-read video + link,
 * scheduled `workshopSessions` row + `workshop_session` content step, and a
 * short graded assignment (mirrors learner path expectations).
 */
const SEEDED_WORKSHOP_UNIT_SPECS: SeededWorkshopUnitSpec[] = [
  {
    courseName: "Land Lease 101",
    title: "Live community orientation workshop",
    description:
      "Facilitated orientation: on-site expectations, resident touchpoints, and Q&A. Watch the short pre-record, review the checklist, register for a session via the workshop step, then submit the reflection.",
    videoTitle: "Before you attend: how live workshops run",
    linkTitle: "Workshop participant checklist",
    linkUrl: "https://www.ccia.com.au/",
    sessionStepTitle: "Register for a scheduled orientation session",
    sessionStartIso: "2026-05-20T09:00:00+10:00",
    sessionEndIso: "2026-05-20T11:30:00+10:00",
    assignmentTitle: "Reflection — live orientation",
  },
  {
    courseName: "Compliance & the Act",
    title: "Compliance briefing (live workshop)",
    description:
      "Walkthrough of disclosure themes and common enquiries with a facilitator. Complete the pre-read, book a session, then confirm takeaways in the short assignment.",
    videoTitle: "Pre-read: how compliance workshops are structured",
    linkTitle: "National Cabinet — disclosure reform (context)",
    linkUrl: "https://www.nationalcabinet.gov.au/",
    sessionStepTitle: "Book a scheduled compliance briefing",
    sessionStartIso: "2026-06-10T13:00:00+10:00",
    sessionEndIso: "2026-06-10T15:00:00+10:00",
    assignmentTitle: "Checkpoint — compliance briefing takeaways",
  },
  {
    courseName: "Site Safety & WHS",
    title: "Site safety roundtable (live workshop)",
    description:
      "Interactive session on hazard reporting, contractor controls, and incident escalation. Review the primer link, attend a scheduled roundtable, then complete the knowledge check.",
    videoTitle: "Safety culture — what we cover in the live roundtable",
    linkTitle: "Safe Work Australia — WHS duties overview",
    linkUrl: "https://www.safeworkaustralia.gov.au/",
    sessionStepTitle: "Register for a site safety roundtable",
    sessionStartIso: "2026-07-08T09:30:00+10:00",
    sessionEndIso: "2026-07-08T12:00:00+10:00",
    assignmentTitle: "Roundtable follow-up — site safety",
  },
];

async function insertSeededWorkshopUnits(
  ctx: MutationCtx,
  opts: {
    levelIdByCourseName: Map<string, Id<"certificationLevels">>;
    unitSort: { n: number };
    contentSort: { n: number };
  },
): Promise<number> {
  let inserted = 0;
  for (const spec of SEEDED_WORKSHOP_UNIT_SPECS) {
    const levelId = opts.levelIdByCourseName.get(spec.courseName);
    if (!levelId) {
      throw new Error(`Seed workshop: missing level for ${spec.courseName}`);
    }
    const nextOrder = maxSeedUnitOrderInCourse(spec.courseName) + 1;
    const unitCatLabel = seededUnitCategoryForCourse(spec.courseName);
    const unitCatId = await getOrInsertUnitCategory(
      ctx,
      unitCatLabel,
      `${unitCatLabel} — units in ${spec.courseName}`,
      opts.unitSort,
    );
    const unitId = await ctx.db.insert("units", {
      code: await allocateUniqueUnitCode(ctx, spec.title, {
        maxBaseLen: SEED_CODE_BASE_MAX_LEN,
      }),
      title: spec.title,
      description: spec.description,
      unitCategoryId: unitCatId,
      deliveryMode: "live_workshop",
    });
    await ctx.db.insert("certificationUnits", {
      levelId,
      unitId,
      order: nextOrder,
    });

    let stepOrder = 0;
    const videoCatId = await getOrInsertContentCategory(
      ctx,
      seededContentCategoryForLesson("video"),
      `${seededContentCategoryForLesson("video")} — library content`,
      opts.contentSort,
    );
    const videoId = await ctx.db.insert("contentItems", {
      code: await allocateUniqueContentCode(ctx, spec.videoTitle),
      type: "video",
      title: spec.videoTitle,
      url: SEED_WORKSHOP_DEMO_VIDEO_URL,
      contentCategoryId: videoCatId,
      duration: 150,
      shortDescription: `Pre-work video — how the live “${spec.title.trim()}” session is structured.`,
    });
    await ctx.db.insert("unitContents", {
      unitId,
      contentId: videoId,
      order: stepOrder++,
    });

    const linkCatId = await getOrInsertContentCategory(
      ctx,
      seededContentCategoryForLesson("link"),
      `${seededContentCategoryForLesson("link")} — library content`,
      opts.contentSort,
    );
    const linkId = await ctx.db.insert("contentItems", {
      code: await allocateUniqueContentCode(ctx, spec.linkTitle),
      type: "link",
      title: spec.linkTitle,
      url: spec.linkUrl,
      contentCategoryId: linkCatId,
      shortDescription: `Reading before ${spec.courseName} — context and checklists for facilitators.`,
    });
    await ctx.db.insert("unitContents", {
      unitId,
      contentId: linkId,
      order: stepOrder++,
    });

    const startsAt = new Date(spec.sessionStartIso).getTime();
    const endsAt = new Date(spec.sessionEndIso).getTime();
    const sessionId = await ctx.db.insert("workshopSessions", {
      workshopUnitId: unitId,
      startsAt,
      endsAt,
      status: "scheduled",
      capacity: 24,
    });
    const liveWorkshopCatId = await getOrInsertContentCategory(
      ctx,
      "Live workshops",
      "Live workshops — scheduled sessions & registration",
      opts.contentSort,
    );
    const sessionContentId = await ctx.db.insert("contentItems", {
      code: await allocateUniqueContentCode(ctx, spec.sessionStepTitle),
      type: "workshop_session",
      title: spec.sessionStepTitle,
      url: "",
      contentCategoryId: liveWorkshopCatId,
      workshopSessionId: sessionId,
      shortDescription:
        "Pick a scheduled time and register — this step completes when you are booked in.",
    });
    await ctx.db.insert("unitContents", {
      unitId,
      contentId: sessionContentId,
      order: stepOrder++,
    });

    const assignCatId = await getOrInsertContentCategory(
      ctx,
      SEED_CONTENT_CATEGORY_ASSESSMENT,
      "Quizzes & assessments — formal checks",
      opts.contentSort,
    );
    const assignId = await ctx.db.insert("contentItems", {
      code: await allocateUniqueContentCode(ctx, spec.assignmentTitle),
      type: "assignment",
      title: spec.assignmentTitle,
      url: "",
      contentCategoryId: assignCatId,
      shortDescription:
        "Short reflection after the live workshop step to capture takeaways for your site file.",
      assessment: {
        description:
          "Short confirmation after you have used the workshop session step (register or mark complete as directed by your facilitator).",
        passingScore: 70,
        questions: [
          {
            id: `ws-${inserted}-reflect`,
            question:
              "After the live workshop step, which statement best matches what you should do next?",
            type: "multiple_choice",
            options: [
              "Ignore the session tile — it is optional decoration",
              "Keep evidence of attendance or registration as directed for your site records",
              "Delete the unit from your training plan",
              "Skip all remaining certification units",
            ],
            correctAnswer:
              "Keep evidence of attendance or registration as directed for your site records",
          },
        ],
      },
    });
    await ctx.db.insert("unitContents", {
      unitId,
      contentId: assignId,
      order: stepOrder,
    });
    inserted += 1;
  }
  return inserted;
}

async function runInsertLandLeaseCurriculum(ctx: MutationCtx) {
  const levelIds: Id<"certificationLevels">[] = [];
  const levelIdByCourseName = new Map<string, Id<"certificationLevels">>();
  const unitIdBySeedKey = new Map<string, Id<"units">>();
  const certSort = { n: 0 };
  const unitSort = { n: 0 };
  const contentSort = { n: 0 };

  for (const course of LAND_LEASE_CURRICULUM) {
    const certCatId = await getOrInsertCertCategory(
      ctx,
      course.certificationCategory,
      `${course.certificationCategory} — ${course.name}`,
      certSort,
    );
    const levelId = await ctx.db.insert("certificationLevels", {
      code: await allocateUniqueCertificationCode(ctx, course.name, {
        maxBaseLen: SEED_CODE_BASE_MAX_LEN,
      }),
      name: course.name,
      certificationCategoryId: certCatId,
      summary: course.summary,
      description: course.description,
      tagline: course.tagline,
      thumbnailUrl: course.thumbnailUrl,
      order: course.order,
      companyId: undefined,
      certificationTier: certificationTierForCourseName(course.name),
    });
    levelIds.push(levelId);
    levelIdByCourseName.set(course.name, levelId);

    for (const unit of course.units) {
      const unitCatLabel = seededUnitCategoryForCourse(course.name);
      const unitCatId = await getOrInsertUnitCategory(
        ctx,
        unitCatLabel,
        `${unitCatLabel} — units in ${course.name}`,
        unitSort,
      );
      const unitId = await ctx.db.insert("units", {
        code: await allocateUniqueUnitCode(ctx, unit.title, {
          maxBaseLen: SEED_CODE_BASE_MAX_LEN,
        }),
        title: unit.title,
        description: unit.description,
        unitCategoryId: unitCatId,
      });
      await ctx.db.insert("certificationUnits", {
        levelId,
        unitId,
        order: unit.order,
      });
      unitIdBySeedKey.set(seedUnitKey(course.name, unit.title), unitId);
      for (const c of unit.content) {
        const contentLabel = seededContentCategoryForLesson(c.type);
        const contentCatId = await getOrInsertContentCategory(
          ctx,
          contentLabel,
          `${contentLabel} — library content`,
          contentSort,
        );
        const contentId = await ctx.db.insert("contentItems", {
          code: await allocateUniqueContentCode(ctx, c.title),
          type: c.type,
          title: c.title,
          url: c.url,
          contentCategoryId: contentCatId,
          shortDescription: seededShortDescriptionForLessonContent({
            unitTitle: unit.title,
            contentTitle: c.title,
            type: c.type,
          }),
          ...(c.duration !== undefined ? { duration: c.duration } : {}),
        });
        await ctx.db.insert("unitContents", {
          unitId,
          contentId,
          order: c.order,
        });
      }
      let assessOrder = unit.content.length;
      if (unit.test) {
        const assessCatId = await getOrInsertContentCategory(
          ctx,
          SEED_CONTENT_CATEGORY_ASSESSMENT,
          "Quizzes & assessments — formal checks",
          contentSort,
        );
        const testContentId = await ctx.db.insert("contentItems", {
          code: await allocateUniqueContentCode(ctx, unit.test.title),
          type: "test",
          title: unit.test.title,
          url: "",
          contentCategoryId: assessCatId,
          shortDescription: seededShortDescriptionForAssessment(
            unit.test.title,
            unit.test.description,
          ),
          assessment: {
            description: unit.test.description,
            passingScore: unit.test.passingScore,
            questions: unit.test.questions,
          },
        });
        await ctx.db.insert("unitContents", {
          unitId,
          contentId: testContentId,
          order: assessOrder,
        });
        assessOrder += 1;
      }
      const assignCatId = await getOrInsertContentCategory(
        ctx,
        SEED_CONTENT_CATEGORY_ASSESSMENT,
        "Quizzes & assessments — formal checks",
        contentSort,
      );
      const assessContentId = await ctx.db.insert("contentItems", {
        code: await allocateUniqueContentCode(ctx, unit.assignment.title),
        type: "assignment",
        title: unit.assignment.title,
        url: "",
        contentCategoryId: assignCatId,
        shortDescription: seededShortDescriptionForAssessment(
          unit.assignment.title,
          unit.assignment.description,
        ),
        assessment: {
          description: unit.assignment.description,
          passingScore: unit.assignment.passingScore,
          questions: unit.assignment.questions,
        },
      });
      await ctx.db.insert("unitContents", {
        unitId,
        contentId: assessContentId,
        order: assessOrder,
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

  const selfPacedUnitCount = LAND_LEASE_CURRICULUM.reduce(
    (n, c) => n + c.units.length,
    0,
  );
  const workshopUnitsInserted = await insertSeededWorkshopUnits(ctx, {
    levelIdByCourseName,
    unitSort,
    contentSort,
  });

  return {
    levelCount: levelIds.length,
    unitCount: selfPacedUnitCount + workshopUnitsInserted,
    prerequisiteCount,
    workshopUnitsInserted,
  };
}

async function landLeaseCurriculumAlreadySeeded(ctx: MutationCtx) {
  const allLevels = await ctx.db.query("certificationLevels").collect();
  return allLevels.some(
    (l) => l.name === CURRICULUM_MARKER && l.companyId === undefined,
  );
}

/**
 * Admin: fill `contentItems.shortDescription` when missing (e.g. rows created before this field existed).
 * Safe to re-run; skips rows that already have non-empty text.
 * Run: `npx convex run seed:backfillContentShortDescriptions`
 */
export const backfillContentShortDescriptions = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCreator(ctx);
    let patched = 0;
    for (const row of await ctx.db.query("contentItems").collect()) {
      if (!isLive(row)) {
        continue;
      }
      if (row.shortDescription?.trim()) {
        continue;
      }
      await ctx.db.patch(row._id, {
        shortDescription: shortDescriptionFromContentRow(row),
      });
      patched += 1;
    }
    return { ok: true as const, patched };
  },
});

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
      certificationCategories: 0,
      unitCategories: 0,
      contentCategories: 0,
      certificationWorkshopAttendees: 0,
      workshopSessionWhiteboardStrokes: 0,
      workshopSessionChatMessages: 0,
      workshopRegistrations: 0,
      workshopSessions: 0,
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
    for (const row of await ctx.db.query("certificationWorkshopAttendees").collect()) {
      await ctx.db.delete(row._id);
      counts.certificationWorkshopAttendees += 1;
    }
    for (const row of await ctx.db.query("workshopSessionWhiteboardStrokes").collect()) {
      await ctx.db.delete(row._id);
      counts.workshopSessionWhiteboardStrokes += 1;
    }
    for (const row of await ctx.db.query("workshopSessionChatMessages").collect()) {
      await ctx.db.delete(row._id);
      counts.workshopSessionChatMessages += 1;
    }
    for (const row of await ctx.db.query("workshopRegistrations").collect()) {
      await ctx.db.delete(row._id);
      counts.workshopRegistrations += 1;
    }
    for (const row of await ctx.db.query("workshopSessions").collect()) {
      await ctx.db.delete(row._id);
      counts.workshopSessions += 1;
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
    for (const row of await ctx.db.query("certificationCategories").collect()) {
      await ctx.db.delete(row._id);
      counts.certificationCategories += 1;
    }
    for (const row of await ctx.db.query("unitCategories").collect()) {
      await ctx.db.delete(row._id);
      counts.unitCategories += 1;
    }
    for (const row of await ctx.db.query("contentCategories").collect()) {
      await ctx.db.delete(row._id);
      counts.contentCategories += 1;
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
          "Curriculum already present («Land Lease 101»). Use Clear test data first to re-seed.",
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
