// User-facing stack notifications (not toasts). Enqueue with:
//   import { internal } from "./_generated/api"
//   await ctx.runMutation(internal.userNotifications.createOrSkipForUser, { ... })
//   await ctx.runMutation(internal.userNotifications.createOrSkipForAll, { ... })
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
import type { Doc, Id } from "./_generated/dataModel";

/** Stored in `userIdKey` when `userId` is omitted = broadcast to all users. */
export const NOTIFICATIONS_ALL_USER_KEY = "_all_";

const kindValidator = v.union(
  v.literal("webinar_reminder"),
  v.literal("unit_progress_nudge"),
  v.literal("content_update"),
  v.literal("new_unit"),
  v.literal("new_webinar"),
  v.literal("general"),
);

const importanceValidator = v.optional(
  v.union(
    v.literal("low"),
    v.literal("normal"),
    v.literal("high"),
    v.literal("urgent"),
  ),
);

export const userNotificationLinkRef = v.union(
  v.object({
    kind: v.literal("certificationLevel"),
    levelId: v.id("certificationLevels"),
  }),
  v.object({
    kind: v.literal("unit"),
    unitId: v.id("units"),
    levelId: v.optional(v.id("certificationLevels")),
  }),
  v.object({
    kind: v.literal("content"),
    contentId: v.id("contentItems"),
    unitId: v.id("units"),
    levelId: v.optional(v.id("certificationLevels")),
    workshopSessionId: v.optional(v.id("workshopSessions")),
  }),
  v.object({
    kind: v.literal("workshopSession"),
    sessionId: v.id("workshopSessions"),
  }),
);

const createArgs = {
  userId: v.id("users"),
  kind: kindValidator,
  title: v.string(),
  body: v.optional(v.string()),
  linkHref: v.optional(v.string()),
  linkLabel: v.optional(v.string()),
  linkRef: v.optional(userNotificationLinkRef),
  dedupeKey: v.string(),
  createdAt: v.optional(v.number()),
  importance: importanceValidator,
};

const createForAllArgs = {
  kind: kindValidator,
  title: v.string(),
  body: v.optional(v.string()),
  linkHref: v.optional(v.string()),
  linkLabel: v.optional(v.string()),
  linkRef: v.optional(userNotificationLinkRef),
  dedupeKey: v.string(),
  createdAt: v.optional(v.number()),
  importance: importanceValidator,
};

type CreateOrSkipResult =
  | { status: "skipped_dismissed" }
  | { status: "skipped_active"; id: Id<"userNotifications"> }
  | { status: "created"; id: Id<"userNotifications"> };

function isBroadcastRow(
  row: Pick<Doc<"userNotifications">, "userId" | "userIdKey">,
) {
  return (
    row.userId == null ||
    row.userIdKey === NOTIFICATIONS_ALL_USER_KEY
  );
}

const MAX_PINNED_IN_APP = 20;

async function getBroadcastHiddenIdsForUser(
  ctx: QueryCtx | MutationCtx,
  forUserId: Id<"users">,
): Promise<Set<string>> {
  const myDismissed = await ctx.db
    .query("userNotificationBroadcastDismissals")
    .withIndex("by_user", (q) => q.eq("userId", forUserId))
    .collect();
  return new Set(myDismissed.map((d) => String(d.notificationId)));
}

/** Same visibility as {@link listActiveForUser} for a single row. */
function isNotificationVisiblyActiveForUser(
  forUserId: Id<"users">,
  row: Doc<"userNotifications">,
  broadcastHidden: Set<string>,
): boolean {
  if (row.dismissed) {
    return false;
  }
  if (row.userId != null) {
    return row.userId === forUserId;
  }
  if (isBroadcastRow(row)) {
    return !broadcastHidden.has(String(row._id));
  }
  return false;
}

async function filterUserPinnedToActive(
  ctx: MutationCtx,
  forUserId: Id<"users">,
  current: Id<"userNotifications">[] | undefined,
  broadcastHidden: Set<string>,
): Promise<Id<"userNotifications">[]> {
  if (current == null || current.length === 0) {
    return [];
  }
  const next: Id<"userNotifications">[] = [];
  for (const id of current) {
    const row = await ctx.db.get(id);
    if (
      row == null ||
      !isNotificationVisiblyActiveForUser(forUserId, row, broadcastHidden)
    ) {
      continue;
    }
    next.push(id);
  }
  return next;
}

async function removeNotificationIdFromUserPins(
  ctx: MutationCtx,
  forUserId: Id<"users">,
  notificationId: Id<"userNotifications">,
) {
  const u = await ctx.db.get(forUserId);
  const pins = u?.pinnedInAppNotificationIds;
  if (pins == null || !pins.some((x) => x === notificationId)) {
    return;
  }
  await ctx.db.patch(forUserId, {
    pinnedInAppNotificationIds: pins.filter((x) => x !== notificationId),
  });
}

function userIdKeyFor(
  userId: Id<"users"> | undefined,
): string {
  return userId != null
    ? String(userId)
    : NOTIFICATIONS_ALL_USER_KEY;
}

type NotificationLinkRefIn =
  | { kind: "certificationLevel"; levelId: Id<"certificationLevels"> }
  | { kind: "unit"; unitId: Id<"units">; levelId?: Id<"certificationLevels"> }
  | {
      kind: "content";
      contentId: Id<"contentItems">;
      unitId: Id<"units">;
      levelId?: Id<"certificationLevels">;
      workshopSessionId?: Id<"workshopSessions">;
    }
  | { kind: "workshopSession"; sessionId: Id<"workshopSessions"> };

type LinkResolverCtx = QueryCtx | MutationCtx;

/** Button label: entity title (list query re-resolves for up-to-date names). */
async function resolveNotificationLink(
  ctx: LinkResolverCtx,
  ref: NotificationLinkRefIn,
): Promise<{ href: string; defaultLabel: string }> {
  switch (ref.kind) {
    case "certificationLevel": {
      const level = await ctx.db.get(ref.levelId);
      if (!level) {
        throw new ConvexError("Certification level not found");
      }
      return {
        href: `/certifications/${ref.levelId}`,
        defaultLabel: level.name,
      };
    }
    case "unit": {
      const unit = await ctx.db.get(ref.unitId);
      if (!unit) {
        throw new ConvexError("Unit not found");
      }
      const q = new URLSearchParams();
      if (ref.levelId) {
        q.set("level", ref.levelId);
      }
      const qs = q.toString();
      return {
        href: `/units/${ref.unitId}${qs ? `?${qs}` : ""}`,
        defaultLabel: unit.title,
      };
    }
    case "content": {
      const [content, uc] = await Promise.all([
        ctx.db.get(ref.contentId),
        ctx.db
          .query("unitContents")
          .withIndex("by_unit_and_content", (q) =>
            q.eq("unitId", ref.unitId).eq("contentId", ref.contentId),
          )
          .first(),
      ]);
      if (!content) {
        throw new ConvexError("Content not found");
      }
      if (!uc) {
        throw new ConvexError("Content is not attached to this unit");
      }
      const q = new URLSearchParams();
      if (ref.levelId) {
        q.set("level", ref.levelId);
      }
      if (ref.workshopSessionId) {
        q.set("session", ref.workshopSessionId);
        q.set("from", "workshops");
      }
      const qs = q.toString();
      const base = `/units/${ref.unitId}${qs ? `?${qs}` : ""}`;
      return {
        href: `${base}#step-${ref.contentId}`,
        defaultLabel: content.title,
      };
    }
    case "workshopSession": {
      const session = await ctx.db.get(ref.sessionId);
      if (!session) {
        throw new ConvexError("Workshop session not found");
      }
      const wu = await ctx.db.get(session.workshopUnitId);
      const q = new URLSearchParams();
      q.set("session", ref.sessionId);
      q.set("from", "workshops");
      const cu = await ctx.db
        .query("certificationUnits")
        .withIndex("by_unit", (q) => q.eq("unitId", session.workshopUnitId))
        .first();
      if (cu) {
        q.set("level", cu.levelId);
      }
      const qs = q.toString();
      const defaultLabel =
        (session.titleOverride && session.titleOverride.trim()) ||
        wu?.title ||
        "Workshop";
      return {
        href: `/units/${session.workshopUnitId}?${qs}`,
        defaultLabel,
      };
    }
  }
}

async function tryCreateOrSkip(
  ctx: MutationCtx,
  args: {
    userId: Id<"users"> | undefined;
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
    linkLabel?: string;
    linkRef?: NotificationLinkRefIn;
    dedupeKey: string;
    createdAt?: number;
    importance?: "low" | "normal" | "high" | "urgent";
  },
): Promise<CreateOrSkipResult> {
  const createdAt = args.createdAt ?? Date.now();
  const userIdKey = userIdKeyFor(args.userId);
  const existing = await ctx.db
    .query("userNotifications")
    .withIndex("by_userIdKey_dedupe", (q) =>
      q.eq("userIdKey", userIdKey).eq("dedupeKey", args.dedupeKey),
    )
    .first();

  if (existing) {
    if (existing.dismissed) {
      return { status: "skipped_dismissed" };
    }
    return { status: "skipped_active", id: existing._id };
  }

  const rawHref = args.linkHref?.trim() ? args.linkHref.trim() : undefined;
  if (rawHref != null && (rawHref.length > 0 && (!rawHref.startsWith("/") || rawHref.startsWith("//")))) {
    throw new ConvexError("Link must be a relative in-app path starting with /");
  }
  let linkHref = rawHref && rawHref.length > 0 ? rawHref : undefined;
  let linkLabel = args.linkLabel?.trim() ? args.linkLabel.trim() : undefined;
  const linkRef = args.linkRef;
  if (args.linkRef) {
    const resolved = await resolveNotificationLink(ctx, args.linkRef);
    if (!linkHref) {
      linkHref = resolved.href;
    }
    if (!linkLabel) {
      linkLabel = resolved.defaultLabel;
    }
  }

  const id = await ctx.db.insert("userNotifications", {
    userId: args.userId,
    userIdKey,
    kind: args.kind,
    importance: args.importance ?? "normal",
    title: args.title.trim(),
    body: args.body?.trim() ? args.body.trim() : undefined,
    linkHref: linkHref || undefined,
    linkLabel: linkLabel || undefined,
    linkRef: linkRef ?? undefined,
    dedupeKey: args.dedupeKey,
    createdAt,
    dismissed: false,
  });
  return { status: "created", id };
}

/** One-time: set `userIdKey` on rows created before this field existed. */
export const backfillUserIdKeys = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("userNotifications").collect();
    let patched = 0;
    for (const r of rows) {
      if (r.userIdKey != null) {
        continue;
      }
      const k =
        r.userId != null
          ? String(r.userId)
          : NOTIFICATIONS_ALL_USER_KEY;
      await ctx.db.patch(r._id, { userIdKey: k });
      patched += 1;
    }
    return { scanned: rows.length, patched };
  },
});

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
    const user = await ctx.db.get(forUserId);
    if (user == null) {
      return [];
    }
    const cap = Math.min(50, Math.max(1, limit));
    const key = String(forUserId);
    const pinned = new Set(
      (user.pinnedInAppNotificationIds ?? []).map((id) => String(id)),
    );

    const fromKey = await ctx.db
      .query("userNotifications")
      .withIndex("by_userIdKey_dismissed", (q) =>
        q.eq("userIdKey", key).eq("dismissed", false),
      )
      .collect();

    const fromLegacy = await ctx.db
      .query("userNotifications")
      .withIndex("by_user_dismissed", (q) =>
        q.eq("userId", forUserId).eq("dismissed", false),
      )
      .collect();

    const byId = new Map<string, Doc<"userNotifications">>();
    for (const r of fromKey) {
      byId.set(r._id, r);
    }
    for (const r of fromLegacy) {
      if (!byId.has(r._id)) {
        byId.set(r._id, r);
      }
    }
    const userTargeted = [...byId.values()];

    const broadcast = await ctx.db
      .query("userNotifications")
      .withIndex("by_userIdKey_dismissed", (q) =>
        q.eq("userIdKey", NOTIFICATIONS_ALL_USER_KEY).eq("dismissed", false),
      )
      .collect();

    const myDismissed = await ctx.db
      .query("userNotificationBroadcastDismissals")
      .withIndex("by_user", (q) => q.eq("userId", forUserId))
      .collect();
    const hidden = new Set(
      myDismissed.map((d) => String(d.notificationId)),
    );
    const broadcastVisible = broadcast.filter(
      (r) => !hidden.has(String(r._id)) && isBroadcastRow(r),
    );

    const merged = [...userTargeted, ...broadcastVisible];
    merged.sort((a, b) => b.createdAt - a.createdAt);
    const notPinned = merged.filter((row) => !pinned.has(String(row._id)));
    const slice = notPinned.slice(0, cap);
    return await Promise.all(
      slice.map(async (row) => {
        if (row.linkRef == null) {
          return row;
        }
        try {
          const resolved = await resolveNotificationLink(ctx, row.linkRef);
          return { ...row, linkLabel: resolved.defaultLabel };
        } catch {
          return row;
        }
      }),
    );
  },
});

/**
 * Pinned post-its for the app shell (order: oldest received first).
 */
export const listPinnedForUser = query({
  args: { forUserId: v.id("users") },
  handler: async (ctx, { forUserId }) => {
    if (!(await ctx.db.get(forUserId))) {
      return [];
    }
    const u = await ctx.db.get(forUserId);
    const raw = u?.pinnedInAppNotificationIds ?? [];
    if (raw.length === 0) {
      return [];
    }
    const broadcastHidden = await getBroadcastHiddenIdsForUser(
      ctx,
      forUserId,
    );
    const rows: Doc<"userNotifications">[] = [];
    for (const id of raw) {
      const row = await ctx.db.get(id);
      if (
        row == null ||
        !isNotificationVisiblyActiveForUser(
          forUserId,
          row,
          broadcastHidden,
        )
      ) {
        continue;
      }
      rows.push(row);
    }
    rows.sort((a, b) => a.createdAt - b.createdAt);
    return await Promise.all(
      rows.map(async (row) => {
        if (row.linkRef == null) {
          return row;
        }
        try {
          const resolved = await resolveNotificationLink(ctx, row.linkRef);
          return { ...row, linkLabel: resolved.defaultLabel };
        } catch {
          return row;
        }
      }),
    );
  },
});

export const pinInApp = mutation({
  args: {
    forUserId: v.id("users"),
    notificationId: v.id("userNotifications"),
  },
  handler: async (ctx, { forUserId, notificationId }) => {
    if (!(await ctx.db.get(forUserId))) {
      return { ok: false as const, reason: "user_not_found" as const };
    }
    const row = await ctx.db.get(notificationId);
    if (row == null) {
      return { ok: false as const, reason: "not_found" as const };
    }
    const broadcastHidden = await getBroadcastHiddenIdsForUser(
      ctx,
      forUserId,
    );
    if (
      !isNotificationVisiblyActiveForUser(forUserId, row, broadcastHidden)
    ) {
      return { ok: false as const, reason: "not_active" as const };
    }
    const u = await ctx.db.get(forUserId);
    const pruned = await filterUserPinnedToActive(
      ctx,
      forUserId,
      u?.pinnedInAppNotificationIds,
      broadcastHidden,
    );
    if (pruned.some((x) => x === notificationId)) {
      return { ok: true as const, already: true as const };
    }
    if (pruned.length >= MAX_PINNED_IN_APP) {
      return { ok: false as const, reason: "max_pins" as const };
    }
    await ctx.db.patch(forUserId, {
      pinnedInAppNotificationIds: [...pruned, notificationId],
    });
    return { ok: true as const, already: false as const };
  },
});

export const unpinInApp = mutation({
  args: {
    forUserId: v.id("users"),
    notificationId: v.id("userNotifications"),
  },
  handler: async (ctx, { forUserId, notificationId }) => {
    if (!(await ctx.db.get(forUserId))) {
      return { ok: false as const, reason: "user_not_found" as const };
    }
    const u = await ctx.db.get(forUserId);
    const current = u?.pinnedInAppNotificationIds ?? [];
    if (!current.some((x) => x === notificationId)) {
      return { ok: true as const, already: true as const };
    }
    const broadcastHidden = await getBroadcastHiddenIdsForUser(
      ctx,
      forUserId,
    );
    const pruned = await filterUserPinnedToActive(
      ctx,
      forUserId,
      current,
      broadcastHidden,
    );
    const next = pruned.filter((x) => x !== notificationId);
    await ctx.db.patch(forUserId, { pinnedInAppNotificationIds: next });
    return { ok: true as const, already: false as const };
  },
});

/**
 * Dismiss a single notification. Targeted: patch row. Broadcast: per-user
 * `userNotificationBroadcastDismissals` row.
 */
export const dismiss = mutation({
  args: {
    forUserId: v.id("users"),
    notificationId: v.id("userNotifications"),
  },
  handler: async (ctx, { forUserId, notificationId }) => {
    const row = await ctx.db.get(notificationId);
    if (!row) {
      return { ok: false as const, reason: "not_found" as const };
    }
    if (row.userId != null) {
      if (row.userId !== forUserId) {
        return { ok: false as const, reason: "not_found" as const };
      }
      if (row.dismissed) {
        await removeNotificationIdFromUserPins(
          ctx,
          forUserId,
          notificationId,
        );
        return { ok: true as const, already: true as const };
      }
      const now = Date.now();
      await ctx.db.patch(notificationId, {
        dismissed: true,
        dismissedAt: now,
      });
    } else if (isBroadcastRow(row)) {
      const now = Date.now();
      const existing = await ctx.db
        .query("userNotificationBroadcastDismissals")
        .withIndex("by_user_notification", (q) =>
          q.eq("userId", forUserId).eq("notificationId", notificationId),
        )
        .first();
      if (existing) {
        await removeNotificationIdFromUserPins(
          ctx,
          forUserId,
          notificationId,
        );
        return { ok: true as const, already: true as const };
      }
      await ctx.db.insert("userNotificationBroadcastDismissals", {
        userId: forUserId,
        notificationId,
        createdAt: now,
      });
    } else {
      return { ok: false as const, reason: "not_found" as const };
    }
    await removeNotificationIdFromUserPins(ctx, forUserId, notificationId);
    return { ok: true as const, already: false as const };
  },
});

/**
 * Dismiss all active notifications for `forUserId` (session user):
 * targeted rows in `userNotifications`, and broadcast dismissals records.
 */
export const dismissAll = mutation({
  args: { forUserId: v.id("users") },
  handler: async (ctx, { forUserId }) => {
    const now = Date.now();
    const key = String(forUserId);
    const userRows = await ctx.db
      .query("userNotifications")
      .withIndex("by_userIdKey_dismissed", (q) =>
        q.eq("userIdKey", key).eq("dismissed", false),
      )
      .collect();
    const legacy = await ctx.db
      .query("userNotifications")
      .withIndex("by_user_dismissed", (q) =>
        q.eq("userId", forUserId).eq("dismissed", false),
      )
      .collect();
    const toPatch = new Map<string, Doc<"userNotifications">>();
    for (const r of userRows) {
      if (r.userId != null) {
        toPatch.set(r._id, r);
      }
    }
    for (const r of legacy) {
      if (r.userId != null && !toPatch.has(r._id)) {
        toPatch.set(r._id, r);
      }
    }
    for (const r of toPatch.values()) {
      await ctx.db.patch(r._id, { dismissed: true, dismissedAt: now });
    }

    const broadcast = await ctx.db
      .query("userNotifications")
      .withIndex("by_userIdKey_dismissed", (q) =>
        q
          .eq("userIdKey", NOTIFICATIONS_ALL_USER_KEY)
          .eq("dismissed", false),
      )
      .collect();
    let broadcastDismissed = 0;
    for (const r of broadcast) {
      if (!isBroadcastRow(r)) {
        continue;
      }
      const exists = await ctx.db
        .query("userNotificationBroadcastDismissals")
        .withIndex("by_user_notification", (q) =>
          q.eq("userId", forUserId).eq("notificationId", r._id),
        )
        .first();
      if (!exists) {
        await ctx.db.insert("userNotificationBroadcastDismissals", {
          userId: forUserId,
          notificationId: r._id,
          createdAt: now,
        });
        broadcastDismissed += 1;
      }
    }
    await ctx.db.patch(forUserId, { pinnedInAppNotificationIds: [] });
    return {
      count: toPatch.size,
      broadcastDismissed,
    };
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

async function assertIsAdmin(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
) {
  const u = await ctx.db.get(userId);
  if (!u) {
    throw new ConvexError("User not found");
  }
  if (u.role !== "admin") {
    throw new ConvexError("Forbidden");
  }
}

/**
 * Admin only: in-app post-it to everyone (one shared notice) or to every user
 * in a single company (one row per user). Session `forUserId` must be an admin.
 */
export const adminSendInAppNotification = mutation({
  args: {
    forUserId: v.id("users"),
    scope: v.union(v.literal("all"), v.literal("company")),
    companyId: v.optional(v.id("companies")),
    title: v.string(),
    body: v.optional(v.string()),
    importance: importanceValidator,
    kind: v.optional(kindValidator),
    linkHref: v.optional(v.string()),
    linkLabel: v.optional(v.string()),
    linkRef: v.optional(userNotificationLinkRef),
  },
  handler: async (ctx, args) => {
    await assertIsAdmin(ctx, args.forUserId);
    const title = args.title.trim();
    if (!title) {
      throw new ConvexError("Title is required");
    }
    const kind = args.kind ?? "general";
    const importance = args.importance ?? "normal";
    const body = args.body?.trim() ? args.body.trim() : undefined;

    if (args.scope === "all") {
      const dedupeKey = `admin:all:${Date.now()}:${Math.random().toString(36).slice(2, 12)}`;
      return tryCreateOrSkip(ctx, {
        userId: undefined,
        kind,
        title,
        body,
        linkHref: args.linkHref,
        linkLabel: args.linkLabel,
        linkRef: args.linkRef,
        dedupeKey,
        importance,
      });
    }

    const companyId = args.companyId;
    if (!companyId) {
      throw new ConvexError("Select a company for company-only delivery");
    }
    if (!(await ctx.db.get(companyId))) {
      throw new ConvexError("Company not found");
    }
    const userRows = await ctx.db
      .query("users")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .collect();
    if (userRows.length === 0) {
      return {
        scope: "company" as const,
        companyId,
        users: 0,
        created: 0,
        skippedDismissed: 0,
        skippedActive: 0,
      };
    }
    const base = `admin:co:${String(companyId)}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    let created = 0;
    let skippedDismissed = 0;
    let skippedActive = 0;
    for (const u of userRows) {
      const res = await tryCreateOrSkip(ctx, {
        userId: u._id,
        kind,
        title,
        body,
        linkHref: args.linkHref,
        linkLabel: args.linkLabel,
        linkRef: args.linkRef,
        dedupeKey: `${base}:${u._id}`,
        importance,
      });
      if (res.status === "created") {
        created += 1;
      } else if (res.status === "skipped_dismissed") {
        skippedDismissed += 1;
      } else {
        skippedActive += 1;
      }
    }
    return {
      scope: "company" as const,
      companyId,
      users: userRows.length,
      created,
      skippedDismissed,
      skippedActive,
    };
  },
});

/**
 * TEMP: Settings page test only. Inserts into `userNotifications` for `forUserId`
 * (the logged-in user’s Convex `users` _id from the session). Remove when no longer needed.
 */
export const createTestForCurrentUser = mutation({
  args: {
    forUserId: v.id("users"),
    title: v.string(),
    body: v.optional(v.string()),
    importance: importanceValidator,
    linkHref: v.optional(v.string()),
    linkLabel: v.optional(v.string()),
    linkRef: v.optional(userNotificationLinkRef),
  },
  handler: async (ctx, args) => {
    const { forUserId, title, body, importance } = args;
    await assertIsAdminOrCreator(ctx, forUserId);
    const dedupeKey = `test:settings:${Date.now()}:${Math.random().toString(36).slice(2, 12)}`;
    const t = title.trim() || "Test notification";
    return tryCreateOrSkip(ctx, {
      userId: forUserId,
      kind: "general",
      title: t,
      body: body?.trim() ? body.trim() : undefined,
      linkHref: args.linkHref,
      linkLabel: args.linkLabel,
      linkRef: args.linkRef,
      dedupeKey,
      importance: importance ?? "normal",
    });
  },
});

/**
 * Admin test: one broadcast row (`userId` omitted) so every signed-in user sees
 * a post-it until they dismiss. Uses a unique `dedupeKey` each time.
 */
export const createTestBroadcast = mutation({
  args: {
    forUserId: v.id("users"),
    title: v.string(),
    body: v.optional(v.string()),
    importance: importanceValidator,
    linkHref: v.optional(v.string()),
    linkLabel: v.optional(v.string()),
    linkRef: v.optional(userNotificationLinkRef),
  },
  handler: async (ctx, args) => {
    const { forUserId, title, body, importance } = args;
    await assertIsAdminOrCreator(ctx, forUserId);
    const dedupeKey = `test:all:${Date.now()}:${Math.random().toString(36).slice(2, 12)}`;
    const t = title.trim() || "Test broadcast";
    return tryCreateOrSkip(ctx, {
      userId: undefined,
      kind: "general",
      title: t,
      body: body?.trim() ? body.trim() : undefined,
      linkHref: args.linkHref,
      linkLabel: args.linkLabel,
      linkRef: args.linkRef,
      dedupeKey,
      importance: importance ?? "normal",
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
    return tryCreateOrSkip(ctx, {
      userId: args.userId,
      kind: args.kind,
      title: args.title,
      body: args.body,
      linkHref: args.linkHref,
      linkLabel: args.linkLabel,
      linkRef: args.linkRef,
      createdAt: args.createdAt,
      importance: args.importance ?? "normal",
      dedupeKey: args.dedupeKey,
    });
  },
});

/**
 * Internal: one `userNotifications` row with no `userId` — all accounts see it until
 * they dismiss (tracked in `userNotificationBroadcastDismissals`).
 * `dedupeKey` is global for this broadcast (one row per key).
 */
export const createOrSkipForAll = internalMutation({
  args: createForAllArgs,
  handler: async (ctx, args) => {
    return tryCreateOrSkip(ctx, {
      userId: undefined,
      kind: args.kind,
      title: args.title,
      body: args.body,
      linkHref: args.linkHref,
      linkLabel: args.linkLabel,
      linkRef: args.linkRef,
      createdAt: args.createdAt,
      importance: args.importance,
      dedupeKey: args.dedupeKey,
    });
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
    linkLabel: v.optional(v.string()),
    linkRef: v.optional(userNotificationLinkRef),
    importance: importanceValidator,
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
        linkLabel: args.linkLabel,
        linkRef: args.linkRef,
        importance: args.importance ?? "normal",
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
