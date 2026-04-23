// User-facing stack notifications (not toasts). Enqueue with:
//   import { internal } from "./_generated/api"
//   await ctx.runMutation(internal.userNotifications.createOrSkipForUser, { ... })
//
// Public list/dismiss use `forUserId` from the browser session (this app has no
// per-session Convex JWT; `lib/auth` resolveDeploymentUserId is not the logged-in user).
import { ConvexError, v } from "convex/values";
import {
  type MutationCtx,
  type QueryCtx,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";

const kindValidator = v.union(
  v.literal("webinar_reminder"),
  v.literal("unit_progress_nudge"),
  v.literal("content_update"),
  v.literal("new_unit"),
  v.literal("new_webinar"),
  v.literal("general"),
);

const createArgs = {
  userId: v.id("users"),
  kind: kindValidator,
  title: v.string(),
  body: v.optional(v.string()),
  linkHref: v.optional(v.string()),
  dedupeKey: v.string(),
  createdAt: v.optional(v.number()),
};

type CreateOrSkipResult =
  | { status: "skipped_dismissed" }
  | { status: "skipped_active"; id: Id<"userNotifications"> }
  | { status: "created"; id: Id<"userNotifications"> };

async function tryCreateOrSkip(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    kind:
      | "webinar_reminder"
      | "unit_progress_nudge"
      | "content_update"
      | "new_unit"
      | "new_webinar"
      | "general";
    title: string;
    body?: string;
    linkHref?: string;
    dedupeKey: string;
    createdAt?: number;
  },
): Promise<CreateOrSkipResult> {
  const createdAt = args.createdAt ?? Date.now();
  const existing = await ctx.db
    .query("userNotifications")
    .withIndex("by_user_dedupe", (q) =>
      q.eq("userId", args.userId).eq("dedupeKey", args.dedupeKey),
    )
    .first();

  if (existing) {
    if (existing.dismissed) {
      return { status: "skipped_dismissed" };
    }
    return { status: "skipped_active", id: existing._id };
  }

  const id = await ctx.db.insert("userNotifications", {
    userId: args.userId,
    kind: args.kind,
    title: args.title.trim(),
    body: args.body?.trim() ? args.body.trim() : undefined,
    linkHref: args.linkHref?.trim() ? args.linkHref.trim() : undefined,
    dedupeKey: args.dedupeKey,
    createdAt,
    dismissed: false,
  });
  return { status: "created", id };
}

/** Browser passes session `users` id (see `useSessionUser` / `/api/auth/session`). */
export const listActiveForUser = query({
  args: {
    /** Omitted or undefined after JSON — return []. */
    forUserId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { forUserId, limit = 20 }) => {
    if (forUserId == null) {
      return [];
    }
    if (!(await ctx.db.get(forUserId))) {
      return [];
    }
    const cap = Math.min(50, Math.max(1, limit));
    const rows = await ctx.db
      .query("userNotifications")
      .withIndex("by_user_dismissed", (q) =>
        q.eq("userId", forUserId).eq("dismissed", false),
      )
      .collect();
    rows.sort((a, b) => b.createdAt - a.createdAt);
    return rows.slice(0, cap);
  },
});

/**
 * Dismiss a single notification. `forUserId` must match the notification row’s userId
 * and the client session user.
 */
export const dismiss = mutation({
  args: {
    forUserId: v.id("users"),
    notificationId: v.id("userNotifications"),
  },
  handler: async (ctx, { forUserId, notificationId }) => {
    const row = await ctx.db.get(notificationId);
    if (!row || row.userId !== forUserId) {
      return { ok: false as const, reason: "not_found" as const };
    }
    if (row.dismissed) {
      return { ok: true as const, already: true as const };
    }
    const now = Date.now();
    await ctx.db.patch(notificationId, {
      dismissed: true,
      dismissedAt: now,
    });
    return { ok: true as const, already: false as const };
  },
});

/**
 * Dismiss all active notifications for `forUserId` (session user).
 */
export const dismissAll = mutation({
  args: { forUserId: v.id("users") },
  handler: async (ctx, { forUserId }) => {
    const rows = await ctx.db
      .query("userNotifications")
      .withIndex("by_user_dismissed", (q) =>
        q.eq("userId", forUserId).eq("dismissed", false),
      )
      .collect();
    const now = Date.now();
    for (const r of rows) {
      await ctx.db.patch(r._id, { dismissed: true, dismissedAt: now });
    }
    return { count: rows.length };
  },
});

async function assertIsAdminOrCreator(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
) {
  const u = await ctx.db.get(userId);
  if (!u) {
    throw new ConvexError("User not found");
  }
  if (u.role !== "admin" && u.role !== "content_creator") {
    throw new ConvexError("Forbidden");
  }
}

/**
 * TEMP: Settings page test only. Inserts into `userNotifications` for `forUserId`
 * (the logged-in user’s Convex `users` _id from the session). Remove when no longer needed.
 */
export const createTestForCurrentUser = mutation({
  args: {
    forUserId: v.id("users"),
    title: v.string(),
    body: v.optional(v.string()),
  },
  handler: async (ctx, { forUserId, title, body }) => {
    await assertIsAdminOrCreator(ctx, forUserId);
    const dedupeKey = `test:settings:${Date.now()}:${Math.random().toString(36).slice(2, 12)}`;
    const t = title.trim() || "Test notification";
    return tryCreateOrSkip(ctx, {
      userId: forUserId,
      kind: "general",
      title: t,
      body: body?.trim() ? body.trim() : undefined,
      dedupeKey,
    });
  },
});

/**
 * Internal: create a notification for one user, or no-op if an equivalent
 * already exists (active) or the user has already dismissed this dedupe key.
 * Call from crons, other internal mutations, or `ctx.scheduler` / triggers.
 */
export const createOrSkipForUser = internalMutation({
  args: createArgs,
  handler: async (ctx, args) => {
    return tryCreateOrSkip(ctx, args);
  },
});

/**
 * Internal: insert the same notification for many users, each with create-or-skip logic.
 * Useful for broadcast (e.g. "new content published") from an internal job.
 */
export const createOrSkipForUsers = internalMutation({
  args: {
    userIds: v.array(v.id("users")),
    kind: kindValidator,
    title: v.string(),
    body: v.optional(v.string()),
    linkHref: v.optional(v.string()),
    /**
     * Base key; per user we store `${baseDedupeKey}:user` so one user dismissing
     * does not block others, while a repeat broadcast can use the same base+version.
     */
    dedupeKey: v.string(),
  },
  handler: async (ctx, args) => {
    let created = 0;
    let skippedDismissed = 0;
    let skippedActive = 0;
    for (const userId of args.userIds) {
      const res = await tryCreateOrSkip(ctx, {
        userId,
        kind: args.kind,
        title: args.title,
        body: args.body,
        linkHref: args.linkHref,
        dedupeKey: `${args.dedupeKey}:${userId}`,
      });
      if (res.status === "created") {
        created += 1;
      } else if (res.status === "skipped_dismissed") {
        skippedDismissed += 1;
      } else {
        skippedActive += 1;
      }
    }
    return { created, skippedDismissed, skippedActive };
  },
});
