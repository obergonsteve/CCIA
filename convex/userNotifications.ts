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
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { computeLearnerCertPathBuckets } from "./certifications";
import { requireUserId } from "./lib/auth";
import { isLive } from "./lib/softDelete";

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
  v.object({
    kind: v.literal("unitAssignment"),
    unitId: v.id("units"),
    assignmentId: v.id("assignments"),
    levelId: v.optional(v.id("certificationLevels")),
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

async function getInAppPinnedIdSetForRead(
  ctx: QueryCtx,
  forUserId: Id<"users">,
  legacyFromUser: Id<"userNotifications">[] | undefined,
): Promise<Set<string>> {
  const fromTable = await ctx.db
    .query("userInAppNotificationPins")
    .withIndex("by_user", (q) => q.eq("userId", forUserId))
    .collect();
  const s = new Set(fromTable.map((p) => String(p.notificationId)));
  for (const id of legacyFromUser ?? []) {
    s.add(String(id));
  }
  return s;
}

/** One-time: copy `users.pinnedInAppNotificationIds` into the pins table, then clear the field. */
async function lazyMigrateLegacyPinsFromUserDoc(
  ctx: MutationCtx,
  forUserId: Id<"users">,
): Promise<void> {
  const u = await ctx.db.get(forUserId);
  const legacy = u?.pinnedInAppNotificationIds;
  if (legacy == null || legacy.length === 0) {
    return;
  }
  const now = Date.now();
  for (const notificationId of legacy) {
    const existing = await ctx.db
      .query("userInAppNotificationPins")
      .withIndex("by_user_and_notification", (q) =>
        q.eq("userId", forUserId).eq("notificationId", notificationId),
      )
      .first();
    if (existing == null) {
      await ctx.db.insert("userInAppNotificationPins", {
        userId: forUserId,
        notificationId,
        pinnedAt: now,
      });
    }
  }
  await ctx.db.patch(forUserId, { pinnedInAppNotificationIds: undefined });
}

/** Drop pin rows whose notification is gone or no longer visible (dismissed, etc.). */
async function pruneInactiveInAppPins(
  ctx: MutationCtx,
  forUserId: Id<"users">,
): Promise<void> {
  const hidden = await getBroadcastHiddenIdsForUser(ctx, forUserId);
  const pins = await ctx.db
    .query("userInAppNotificationPins")
    .withIndex("by_user", (q) => q.eq("userId", forUserId))
    .collect();
  for (const p of pins) {
    const row = await ctx.db.get(p.notificationId);
    if (
      row == null ||
      !isNotificationVisiblyActiveForUser(forUserId, row, hidden)
    ) {
      await ctx.db.delete(p._id);
    }
  }
}

async function removeInAppPin(
  ctx: MutationCtx,
  forUserId: Id<"users">,
  notificationId: Id<"userNotifications">,
): Promise<void> {
  const existing = await ctx.db
    .query("userInAppNotificationPins")
    .withIndex("by_user_and_notification", (q) =>
      q.eq("userId", forUserId).eq("notificationId", notificationId),
    )
    .first();
  if (existing != null) {
    await ctx.db.delete(existing._id);
  }
  const u = await ctx.db.get(forUserId);
  const legacy = u?.pinnedInAppNotificationIds;
  if (legacy != null && legacy.some((x) => x === notificationId)) {
    await ctx.db.patch(forUserId, {
      pinnedInAppNotificationIds: legacy.filter((x) => x !== notificationId),
    });
  }
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
  | { kind: "workshopSession"; sessionId: Id<"workshopSessions"> }
  | {
      kind: "unitAssignment";
      unitId: Id<"units">;
      assignmentId: Id<"assignments">;
      levelId?: Id<"certificationLevels">;
    };

type LinkResolverCtx = QueryCtx | MutationCtx;

/**
 * Pinned id sets can include legacy or corrupted values; `db.get` throws on invalid id strings.
 * Other list paths never `get` notification rows by these raw id strings.
 */
async function tryGetUserNotification(
  ctx: QueryCtx,
  idStr: string,
): Promise<Doc<"userNotifications"> | null> {
  const t = idStr.trim();
  if (t.length === 0 || t === "null" || t === "undefined") {
    return null;
  }
  try {
    return await ctx.db.get(t as Id<"userNotifications">);
  } catch {
    return null;
  }
}

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
    case "unitAssignment": {
      const [assignment, unit] = await Promise.all([
        ctx.db.get(ref.assignmentId),
        ctx.db.get(ref.unitId),
      ]);
      if (!assignment) {
        throw new ConvexError("Assignment not found");
      }
      if (!unit) {
        throw new ConvexError("Unit not found");
      }
      if (assignment.unitId !== ref.unitId) {
        throw new ConvexError("Assignment is not in this unit");
      }
      const q = new URLSearchParams();
      if (ref.levelId) {
        q.set("level", ref.levelId);
      }
      const qs = q.toString();
      const base = `/units/${ref.unitId}${qs ? `?${qs}` : ""}`;
      return {
        href: `${base}#step-a-${ref.assignmentId}`,
        defaultLabel: assignment.title,
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
    default: {
      const _k = (ref as { kind?: string }).kind;
      throw new ConvexError(
        _k != null
          ? `Unknown notification link ref kind: ${_k}`
          : "Invalid notification link ref",
      );
    }
  }
}

/** Also used by `webinarReminders` in-process so `runDue` is one fast transaction, not N nested `runMutation`s. */
export async function tryCreateOrSkip(
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
    const pinned = await getInAppPinnedIdSetForRead(
      ctx,
      forUserId,
      user.pinnedInAppNotificationIds,
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
 * Shared list logic for stashed (pinned) in-app notes — used by `listPinnedForUser`
 * and by `debugListPinnedForUser` (internal) so you can get the *real* error text.
 */
async function listPinnedInAppForUserImpl(
  ctx: QueryCtx,
  forUserId: Id<"users">,
  u: Doc<"users">,
) {
  const fromTable = await ctx.db
    .query("userInAppNotificationPins")
    .withIndex("by_user", (q) => q.eq("userId", forUserId))
    .collect();
  const legacy = u.pinnedInAppNotificationIds ?? [];
  const idSet = new Set<string>();
  for (const p of fromTable) {
    idSet.add(String(p.notificationId));
  }
  for (const id of legacy) {
    idSet.add(String(id));
  }
  if (idSet.size === 0) {
    return [];
  }
  const broadcastHidden = await getBroadcastHiddenIdsForUser(
    ctx,
    forUserId,
  );
  const rows: Doc<"userNotifications">[] = [];
  for (const idStr of idSet) {
    const row = await tryGetUserNotification(ctx, idStr);
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
        if (resolved != null) {
          return { ...row, linkLabel: resolved.defaultLabel };
        }
      } catch {
        /* use row as returned from DB */
      }
      return row;
    }),
  );
}

/**
 * Pinned post-its for the app shell (order: oldest received first).
 *
 * `forUserId` is a plain string (not `v.id("users")`) so the client’s session
 * value is always accepted here; if it is not a valid `users` id, we return
 * `[]` instead of failing Convex argument validation before the handler runs.
 */
export const listPinnedForUser = query({
  args: { forUserId: v.string() },
  handler: async (ctx, { forUserId: forUserIdRaw }) => {
    const trimmed = forUserIdRaw.trim();
    if (trimmed.length === 0) {
      return [];
    }
    let u: Doc<"users"> | null;
    try {
      u = await ctx.db.get(trimmed as Id<"users">);
    } catch {
      return [];
    }
    if (u == null) {
      return [];
    }
    return listPinnedInAppForUserImpl(ctx, u._id, u);
  },
});

/**
 * **Debugging only (internal).** Returns structured success or the exact `message` / `stack`
 * for any thrown error while loading pinned notes — the same code path as `listPinnedForUser`
 * (without swallowing the outer case).
 *
 * - **Authoritative in prod:** copy the `Request ID` from the client error, open
 *   Convex **Dashboard** → this deployment → **Logs**, and search for that id or
 *   `userNotifications` / `listPinnedForUser` (the line includes the function error text).
 * - **CLI (dev or deploy first):** pass a JSON object as the second arg:
 *   `npx convex run internal.userNotifications.debugListPinnedForUser '{"forUserId":"<users _id>"}'`
 *   Add `--prod` to target production.
 */
export const debugListPinnedForUser = internalQuery({
  args: { forUserId: v.string() },
  handler: async (ctx, { forUserId: raw }) => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return {
        ok: false as const,
        phase: "args" as const,
        error: "forUserId is empty",
      };
    }
    let u: Doc<"users"> | null;
    try {
      u = await ctx.db.get(trimmed as Id<"users">);
    } catch (e) {
      return {
        ok: false as const,
        phase: "loadUser" as const,
        error: String(e),
        stack: e instanceof Error ? e.stack : undefined,
        name: e instanceof Error ? e.name : undefined,
      };
    }
    if (u == null) {
      return {
        ok: false as const,
        phase: "loadUser" as const,
        error: "no users row for this id",
      };
    }
    const forUserId = u._id;
    try {
      const result = await listPinnedInAppForUserImpl(ctx, forUserId, u);
      return {
        ok: true as const,
        rowCount: result.length,
        firstNotificationId: result[0]?._id,
      };
    } catch (e) {
      return {
        ok: false as const,
        phase: "listPinnedInAppForUserImpl" as const,
        userId: String(forUserId),
        error: String(e),
        stack: e instanceof Error ? e.stack : undefined,
        name: e instanceof Error ? e.name : undefined,
      };
    }
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
    await lazyMigrateLegacyPinsFromUserDoc(ctx, forUserId);
    await pruneInactiveInAppPins(ctx, forUserId);
    const existing = await ctx.db
      .query("userInAppNotificationPins")
      .withIndex("by_user_and_notification", (q) =>
        q.eq("userId", forUserId).eq("notificationId", notificationId),
      )
      .first();
    if (existing != null) {
      return { ok: true as const, already: true as const };
    }
    const currentCount = (
      await ctx.db
        .query("userInAppNotificationPins")
        .withIndex("by_user", (q) => q.eq("userId", forUserId))
        .collect()
    ).length;
    if (currentCount >= MAX_PINNED_IN_APP) {
      return { ok: false as const, reason: "max_pins" as const };
    }
    await ctx.db.insert("userInAppNotificationPins", {
      userId: forUserId,
      notificationId,
      pinnedAt: Date.now(),
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
    await lazyMigrateLegacyPinsFromUserDoc(ctx, forUserId);
    const pin = await ctx.db
      .query("userInAppNotificationPins")
      .withIndex("by_user_and_notification", (q) =>
        q.eq("userId", forUserId).eq("notificationId", notificationId),
      )
      .first();
    if (pin == null) {
      const u = await ctx.db.get(forUserId);
      const legacy = u?.pinnedInAppNotificationIds ?? [];
      if (!legacy.some((x) => x === notificationId)) {
        return { ok: true as const, already: true as const };
      }
      await ctx.db.patch(forUserId, {
        pinnedInAppNotificationIds: legacy.filter((x) => x !== notificationId),
      });
      return { ok: true as const, already: false as const };
    }
    await ctx.db.delete(pin._id);
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
        await removeInAppPin(ctx, forUserId, notificationId);
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
        await removeInAppPin(ctx, forUserId, notificationId);
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
    await removeInAppPin(ctx, forUserId, notificationId);
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
    const pinRows = await ctx.db
      .query("userInAppNotificationPins")
      .withIndex("by_user", (q) => q.eq("userId", forUserId))
      .collect();
    for (const p of pinRows) {
      await ctx.db.delete(p._id);
    }
    await ctx.db.patch(forUserId, { pinnedInAppNotificationIds: undefined });
    return {
      count: toPatch.size,
      broadcastDismissed,
    };
  },
});

type StoredInAppLinkRef = NonNullable<Doc<"userNotifications">["linkRef"]>;

function inAppLinkRefUsesCertificationPath(
  linkRef: Doc<"userNotifications">["linkRef"] | undefined,
): linkRef is StoredInAppLinkRef {
  if (linkRef == null) {
    return false;
  }
  return (
    linkRef.kind === "certificationLevel" ||
    linkRef.kind === "unit" ||
    linkRef.kind === "content" ||
    linkRef.kind === "unitAssignment" ||
    linkRef.kind === "workshopSession"
  );
}

async function getLevelIdsForUnitPath(
  ctx: MutationCtx,
  unitId: Id<"units">,
  explicitLevelId: Id<"certificationLevels"> | undefined,
): Promise<Id<"certificationLevels">[]> {
  const links = await ctx.db
    .query("certificationUnits")
    .withIndex("by_unit", (q) => q.eq("unitId", unitId))
    .collect();
  if (links.length === 0) {
    return [];
  }
  if (explicitLevelId) {
    const has = links.some((l) => l.levelId === explicitLevelId);
    return has ? [explicitLevelId] : [];
  }
  const unique = new Set<Id<"certificationLevels">>();
  for (const l of links) {
    unique.add(l.levelId);
  }
  return [...unique];
}

async function getLevelIdsForInAppLinkRef(
  ctx: MutationCtx,
  linkRef: StoredInAppLinkRef,
): Promise<Id<"certificationLevels">[]> {
  switch (linkRef.kind) {
    case "certificationLevel": {
      const level = await ctx.db.get(linkRef.levelId);
      if (!level || !isLive(level)) {
        return [];
      }
      return [linkRef.levelId];
    }
    case "unit": {
      return await getLevelIdsForUnitPath(
        ctx,
        linkRef.unitId,
        linkRef.levelId,
      );
    }
    case "content": {
      return await getLevelIdsForUnitPath(
        ctx,
        linkRef.unitId,
        linkRef.levelId,
      );
    }
    case "unitAssignment": {
      return await getLevelIdsForUnitPath(
        ctx,
        linkRef.unitId,
        linkRef.levelId,
      );
    }
    case "workshopSession": {
      const session = await ctx.db.get(linkRef.sessionId);
      if (!session) {
        return [];
      }
      return await getLevelIdsForUnitPath(ctx, session.workshopUnitId, undefined);
    }
  }
}

/**
 * True when the user has this certification on **Current** or **Certification roadmap**
 * (same as learner dashboard `current` ∪ `planned` buckets), for at least one of the
 * link’s relevant level ids.
 */
async function userHasInAppLinkOnCurrentOrRoadmap(
  ctx: MutationCtx,
  userId: Id<"users">,
  linkRef: StoredInAppLinkRef,
): Promise<boolean> {
  const levelIds = await getLevelIdsForInAppLinkRef(ctx, linkRef);
  if (levelIds.length === 0) {
    return false;
  }
  const buckets = await computeLearnerCertPathBuckets(ctx, userId);
  const onPath = new Set<Id<"certificationLevels">>([
    ...buckets.current.map((r) => r.level._id),
    ...buckets.planned.map((r) => r.level._id),
  ]);
  for (const lid of levelIds) {
    if (onPath.has(lid)) {
      return true;
    }
  }
  return false;
}

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
 * Admin only: in-app post-it to everyone (one shared note), to every user in
 * a single company (one row per user), or to one user. Session `forUserId` must
 * be an admin.
 */
export const adminSendInAppNotification = mutation({
  args: {
    forUserId: v.id("users"),
    scope: v.union(
      v.literal("all"),
      v.literal("company"),
      v.literal("students"),
      v.literal("user"),
    ),
    companyId: v.optional(v.id("companies")),
    /** Required when `scope` is `"user"`. */
    targetUserId: v.optional(v.id("users")),
    title: v.string(),
    body: v.optional(v.string()),
    importance: importanceValidator,
    kind: v.optional(kindValidator),
    linkHref: v.optional(v.string()),
    linkLabel: v.optional(v.string()),
    linkRef: v.optional(userNotificationLinkRef),
  },
  handler: async (ctx, args) => {
    const callerId = await requireUserId(ctx);
    if (args.forUserId !== callerId) {
      throw new ConvexError("Not authorized");
    }
    const selfUserScope =
      args.scope === "user" &&
      args.targetUserId != null &&
      args.targetUserId === args.forUserId;
    if (selfUserScope) {
      /* Personal reminder to yourself — any signed-in user */
    } else {
      await assertIsAdmin(ctx, args.forUserId);
    }
    const title = args.title.trim();
    if (!title) {
      throw new ConvexError("Title is required");
    }
    const kind = args.kind ?? "general";
    const importance = args.importance ?? "normal";
    const body = args.body?.trim() ? args.body.trim() : undefined;

    if (args.scope === "all") {
      const linkRef = args.linkRef;
      if (
        linkRef == null ||
        !inAppLinkRefUsesCertificationPath(linkRef)
      ) {
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
      const allUsers = await ctx.db.query("users").collect();
      if (allUsers.length === 0) {
        return {
          scope: "all" as const,
          users: 0,
          created: 0,
          skippedDismissed: 0,
          skippedActive: 0,
          skippedNotOnRoadmap: 0,
        };
      }
      const ref: StoredInAppLinkRef = linkRef;
      const base = `admin:allPath:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      let created = 0;
      let skippedDismissed = 0;
      let skippedActive = 0;
      let skippedNotOnRoadmap = 0;
      for (const u of allUsers) {
        if (!(await userHasInAppLinkOnCurrentOrRoadmap(ctx, u._id, ref))) {
          skippedNotOnRoadmap += 1;
          continue;
        }
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
        scope: "all" as const,
        users: allUsers.length,
        created,
        skippedDismissed,
        skippedActive,
        skippedNotOnRoadmap,
      };
    }

    if (args.scope === "user") {
      const targetUserId = args.targetUserId;
      if (!targetUserId) {
        throw new ConvexError("Select a user for single-user delivery");
      }
      const userRow = await ctx.db.get(targetUserId);
      if (!userRow) {
        throw new ConvexError("User not found");
      }
      const dedupeKey = selfUserScope
        ? `admin:self:u:${String(targetUserId)}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`
        : `admin:u:${String(targetUserId)}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
      return tryCreateOrSkip(ctx, {
        userId: targetUserId,
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

    if (args.scope === "students") {
      const fromStudentIndex = await ctx.db
        .query("users")
        .withIndex("by_account_type", (q) => q.eq("accountType", "student"))
        .collect();
      const byId = new Map<Id<"users">, (typeof fromStudentIndex)[0]>();
      for (const u of fromStudentIndex) {
        byId.set(u._id, u);
      }
      for (const u of await ctx.db.query("users").collect()) {
        if (u.accountType == null && u.companyId == null && !byId.has(u._id)) {
          byId.set(u._id, u);
        }
      }
      const userRows = [...byId.values()];
      if (userRows.length === 0) {
        return {
          scope: "students" as const,
          users: 0,
          created: 0,
          skippedDismissed: 0,
          skippedActive: 0,
          skippedNotOnRoadmap: 0,
        };
      }
      const base = `admin:st:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      let created = 0;
      let skippedDismissed = 0;
      let skippedActive = 0;
      let skippedNotOnRoadmap = 0;
      const ref = args.linkRef;
      const pathRef: StoredInAppLinkRef | null =
        ref != null && inAppLinkRefUsesCertificationPath(ref) ? ref : null;
      for (const u of userRows) {
        if (pathRef != null) {
          if (!(await userHasInAppLinkOnCurrentOrRoadmap(ctx, u._id, pathRef))) {
            skippedNotOnRoadmap += 1;
            continue;
          }
        }
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
        scope: "students" as const,
        users: userRows.length,
        created,
        skippedDismissed,
        skippedActive,
        skippedNotOnRoadmap,
      };
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
    let skippedNotOnRoadmap = 0;
    const ref = args.linkRef;
    const pathRef: StoredInAppLinkRef | null =
      ref != null && inAppLinkRefUsesCertificationPath(ref) ? ref : null;
    for (const u of userRows) {
      if (pathRef != null) {
        if (!(await userHasInAppLinkOnCurrentOrRoadmap(ctx, u._id, pathRef))) {
          skippedNotOnRoadmap += 1;
          continue;
        }
      }
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
      skippedNotOnRoadmap,
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
