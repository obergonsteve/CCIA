import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/** Append each entitlement id to planned roadmap if missing (learner “add to my plan” semantics). */
function mergeEntitledIdsIntoPlanned(
  planned: Id<"certificationLevels">[] | undefined,
  entitled: Id<"certificationLevels">[],
): {
  nextPlanned: Id<"certificationLevels">[] | undefined;
  changed: boolean;
} {
  if (entitled.length === 0) {
    return { nextPlanned: planned?.length ? planned : undefined, changed: false };
  }
  const existing = planned ?? [];
  const inPlan = new Set(existing.map((x) => String(x)));
  const merged: Id<"certificationLevels">[] = [...existing];
  let changed = false;
  for (const id of entitled) {
    if (!inPlan.has(String(id))) {
      inPlan.add(String(id));
      merged.push(id);
      changed = true;
    }
  }
  return {
    nextPlanned: merged.length > 0 ? merged : undefined,
    changed,
  };
}
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import {
  requireAdminOrCreator,
  requireUserId,
  resolveDeploymentUserId,
} from "./lib/auth";
import { isLive } from "./lib/softDelete";
import { computeLearnerCertPathBuckets } from "./certifications";

export const resolveDeploymentUserIdInternal = internalQuery({
  args: {},
  handler: async (ctx) => resolveDeploymentUserId(ctx),
});

export const getByEmailInternal = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const key = email.toLowerCase().trim();
    const rows = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", key))
      .collect();
    if (rows.length === 0) {
      return null;
    }
    if (rows.length > 1) {
      throw new ConvexError(
        `Multiple users share email "${key}". Open Convex Dashboard → Data → users and delete duplicate rows.`,
      );
    }
    return rows[0] ?? null;
  },
});

export const getByIdInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db.get(userId);
  },
});

export const createInternal = internalMutation({
  args: {
    email: v.string(),
    name: v.string(),
    passwordHash: v.string(),
    companyId: v.optional(v.id("companies")),
    role: v.union(
      v.literal("operator"),
      v.literal("supervisor"),
      v.literal("admin"),
      v.literal("content_creator"),
    ),
  },
  handler: async (ctx, args) => {
    const accountType: "member" | "student" =
      args.companyId != null ? "member" : "student";
    return await ctx.db.insert("users", {
      email: args.email.toLowerCase().trim(),
      name: args.name.trim(),
      passwordHash: args.passwordHash,
      accountType,
      ...(args.companyId !== undefined
        ? { companyId: args.companyId }
        : {}),
      ...(accountType === "student"
        ? { studentEntitledCertificationLevelIds: [] }
        : {}),
      role: args.role,
    });
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }
    /* omit passwordHash from client-facing payload */
    const { passwordHash: _omitPw, ...safe } = user;
    void _omitPw;
    return safe;
  },
});

export const recordLogin = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    await ctx.db.patch(userId, { lastLogin: Date.now() });
  },
});

/** Called from Next.js after login/register so `lastLogin` matches the signed-in user. */
export const recordLoginDev = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const row = await ctx.db.get(userId);
    if (!row) {
      throw new Error("Not found");
    }
    await ctx.db.patch(userId, { lastLogin: Date.now() });
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCreator(ctx);
    const users = await ctx.db.query("users").collect();
    return users.map(({ passwordHash, ...u }) => {
      void passwordHash;
      return u;
    });
  },
});

export const listByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    await requireAdminOrCreator(ctx);
    const rows = await ctx.db
      .query("users")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();
    const base = rows
      .map(({ passwordHash, ...u }) => {
        void passwordHash;
        return u;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return await Promise.all(
      base.map(async (u) => {
        const { current, completed } = await computeLearnerCertPathBuckets(
          ctx,
          u._id,
        );
        return {
          ...u,
          inProgressCertificationLevelIds: current.map((r) => r.level._id),
          completedCertificationLevelIds: completed.map((r) => r.level._id),
        };
      }),
    );
  },
});

/** Admin: **student** accounts (tagged `accountType: "student"` and/or legacy no `companyId`). */
export const listWithoutCompany = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCreator(ctx);
    const fromIndex = await ctx.db
      .query("users")
      .withIndex("by_account_type", (q) => q.eq("accountType", "student"))
      .collect();
    const byId = new Map<Id<"users">, (typeof fromIndex)[0]>();
    for (const u of fromIndex) {
      byId.set(u._id, u);
    }
    for (const u of await ctx.db.query("users").collect()) {
      if (u.accountType == null && u.companyId == null && !byId.has(u._id)) {
        byId.set(u._id, u);
      }
    }
    const base = [...byId.values()]
      .map(({ passwordHash, ...u }) => {
        void passwordHash;
        return u;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return await Promise.all(
      base.map(async (u) => {
        const { current, completed } = await computeLearnerCertPathBuckets(
          ctx,
          u._id,
        );
        return {
          ...u,
          inProgressCertificationLevelIds: current.map((r) => r.level._id),
          completedCertificationLevelIds: completed.map((r) => r.level._id),
        };
      }),
    );
  },
});

/** Admin/creator: name and email for “view as student” UI (no sensitive fields). */
export const getForViewAsLabel = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireAdminOrCreator(ctx);
    const row = await ctx.db.get(userId);
    if (!row) {
      return null;
    }
    return { name: row.name, email: row.email };
  },
});

/** Set which certifications a **student** (no company) may start. Replaces the full list. */
export const adminSetStudentCertificationEntitlements = mutation({
  args: {
    userId: v.id("users"),
    levelIds: v.array(v.id("certificationLevels")),
  },
  handler: async (ctx, { userId, levelIds }) => {
    await requireAdminOrCreator(ctx);
    const row = await ctx.db.get(userId);
    if (!row) {
      throw new Error("User not found");
    }
    if (row.companyId != null) {
      throw new Error("Entitlements apply only to student (non-member) accounts");
    }
    const seen = new Set<string>();
    const unique: Id<"certificationLevels">[] = [];
    for (const id of levelIds) {
      const k = String(id);
      if (seen.has(k)) {
        continue;
      }
      seen.add(k);
      const level = await ctx.db.get(id);
      if (!level || !isLive(level)) {
        throw new Error("Invalid or deleted certification");
      }
      if (
        level.companyId != null
      ) {
        throw new Error("Only public certifications can be assigned to students");
      }
      unique.push(id);
    }
    const { nextPlanned } = mergeEntitledIdsIntoPlanned(
      row.plannedCertificationLevelIds,
      unique,
    );
    await ctx.db.patch(userId, {
      studentEntitledCertificationLevelIds: unique,
      plannedCertificationLevelIds: nextPlanned,
    });
  },
});

/**
 * For each user: ensure `plannedCertificationLevelIds` includes every id in
 * `studentEntitledCertificationLevelIds` (backfill for data saved before
 * entitlements → roadmap sync, e.g. seed or older builds).
 */
export const adminReconcilePlannedToEntitledForUsers = mutation({
  args: { userIds: v.array(v.id("users")) },
  handler: async (ctx, { userIds }) => {
    await requireAdminOrCreator(ctx);
    let patched = 0;
    for (const userId of userIds) {
      const row = await ctx.db.get(userId);
      if (!row || row.companyId != null) {
        continue;
      }
      const entitled = row.studentEntitledCertificationLevelIds;
      if (entitled == null || entitled.length === 0) {
        continue;
      }
      const { nextPlanned, changed } = mergeEntitledIdsIntoPlanned(
        row.plannedCertificationLevelIds,
        entitled,
      );
      if (!changed) {
        continue;
      }
      await ctx.db.patch(userId, { plannedCertificationLevelIds: nextPlanned });
      patched += 1;
    }
    return { patched };
  },
});

/** Remove one certification from a **student**’s personal roadmap (planned list). */
export const adminRemoveStudentPlannedCertification = mutation({
  args: {
    userId: v.id("users"),
    levelId: v.id("certificationLevels"),
  },
  handler: async (ctx, { userId, levelId }) => {
    await requireAdminOrCreator(ctx);
    const row = await ctx.db.get(userId);
    if (!row) {
      throw new Error("User not found");
    }
    if (row.companyId != null) {
      throw new Error("This action applies only to student (non-member) accounts");
    }
    const existing = row.plannedCertificationLevelIds ?? [];
    const next = existing.filter((id) => id !== levelId);
    if (next.length === existing.length) {
      return;
    }
    await ctx.db.patch(userId, {
      plannedCertificationLevelIds: next.length > 0 ? next : undefined,
    });
  },
});

export const adminUpdateProfile = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    email: v.string(),
    role: v.union(
      v.literal("operator"),
      v.literal("supervisor"),
      v.literal("admin"),
      v.literal("content_creator"),
    ),
    companyId: v.union(v.id("companies"), v.null()),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCreator(ctx);
    const row = await ctx.db.get(args.userId);
    if (!row) {
      throw new Error("User not found");
    }
    const email = args.email.toLowerCase().trim();
    if (email !== row.email) {
      const clash = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();
      if (clash && clash._id !== args.userId) {
        throw new Error("Another user already uses that email");
      }
    }
    await ctx.db.patch(args.userId, {
      name: args.name.trim(),
      email,
      role: args.role,
      ...(args.companyId == null
        ? { companyId: undefined, accountType: "student" as const }
        : { companyId: args.companyId, accountType: "member" as const }),
    });
  },
});

/** One-time: set `accountType` from `companyId` for all existing user rows. */
export const backfillAccountType = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCreator(ctx);
    const all = await ctx.db.query("users").collect();
    let updated = 0;
    for (const u of all) {
      const next: "member" | "student" =
        u.companyId == null ? "student" : "member";
      if (u.accountType !== next) {
        await ctx.db.patch(u._id, { accountType: next });
        updated += 1;
      }
    }
    return { updated, total: all.length };
  },
});

export const patchPasswordInternal = internalMutation({
  args: {
    userId: v.id("users"),
    passwordHash: v.string(),
  },
  handler: async (ctx, { userId, passwordHash }) => {
    await ctx.db.patch(userId, { passwordHash });
  },
});

export const adminDelete = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requireAdminOrCreator(ctx);
    const row = await ctx.db.get(userId);
    if (!row) {
      throw new Error("User not found");
    }
    for (const p of await ctx.db
      .query("userProgress")
      .withIndex("by_user_unit", (q) => q.eq("userId", userId))
      .collect()) {
      await ctx.db.delete(p._id);
    }
    for (const t of await ctx.db
      .query("testResults")
      .withIndex("by_user_assignment", (q) => q.eq("userId", userId))
      .collect()) {
      await ctx.db.delete(t._id);
    }
    await ctx.db.delete(userId);
  },
});
