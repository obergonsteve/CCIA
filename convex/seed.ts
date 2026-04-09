import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
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
export const seedCommunityOperatorsAndAdmins = mutation({
  args: {},
  handler: async (ctx) => {
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

    return {
      ok: true as const,
      companyIds: Object.fromEntries(companyByName),
      admins: admins.map((a) => a.email.toLowerCase()),
    };
  },
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
      description:
        "Introduction to residential land lease community operations in Australia.",
      order: 0,
      companyId: undefined,
    });
    const unitId = await ctx.db.insert("units", {
      levelId,
      title: "Compliance orientation",
      description:
        "Key obligations under the Residential (Land Lease) Communities Act and operator duties.",
      order: 0,
    });
    await ctx.db.insert("contentItems", {
      unitId,
      type: "link",
      title: "NSW Fair Trading — Land lease communities",
      url: "https://www.fairtrading.nsw.gov.au/",
      order: 0,
    });
    await ctx.db.insert("assignments", {
      unitId,
      title: "Orientation checkpoint",
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
    });
    return { companyId, levelId, unitId };
  },
});
