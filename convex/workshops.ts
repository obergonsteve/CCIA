import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireAdminOrCreator, requireUserId, userCanAccessLevel } from "./lib/auth";
import { effectiveCertificationTier } from "./lib/certTier";
import { isLive, nowDeletedAt } from "./lib/softDelete";
import {
  syncUnitCompletion,
  syncUnitsContainingWorkshopSession,
} from "./contentProgress";
import {
  collectLevelIdsForUnit,
  userCanAccessWorkshopSession,
} from "./lib/workshopUnitLevels";
import { isWorkshopGraphSyncDisabled } from "./lib/workshopGraphKillSwitch";
import { isWorkshopTeamsSimulationEnabled } from "./lib/workshopTeamsSimulation";
import { insertWorkshopSyncLog } from "./lib/workshopSyncLog";
import { collectLiveWorkshopUnitIdsOnLearnerCertPaths } from "./certifications";
import { webinarizeForLiveWorkshopUnit } from "./lib/webinarDisplayText";

const sessionStatusValidator = v.union(
  v.literal("scheduled"),
  v.literal("cancelled"),
);

const conferenceProviderValidator = v.union(
  v.literal("livekit"),
  v.literal("microsoft_teams"),
);

export const listSessionsAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCreator(ctx);
    const sessions = await ctx.db.query("workshopSessions").collect();
    sessions.sort((a, b) => a.startsAt - b.startsAt);
    const out: Array<
      Doc<"workshopSessions"> & { workshopTitle: string; registrationCount: number }
    > = [];
    for (const s of sessions) {
      const u = await ctx.db.get(s.workshopUnitId);
      const regs = await ctx.db
        .query("workshopRegistrations")
        .withIndex("by_session", (q) => q.eq("sessionId", s._id))
        .collect();
      out.push({
        ...s,
        workshopTitle:
          u && isLive(u)
            ? webinarizeForLiveWorkshopUnit(u.title, u.deliveryMode)
            : "(removed unit)",
        registrationCount: regs.length,
      });
    }
    return out;
  },
});

export const listLiveWorkshopUnitsAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCreator(ctx);
    const units = (await ctx.db.query("units").collect()).filter(
      (u) => isLive(u) && u.deliveryMode === "live_workshop",
    );
    return units.sort((a, b) => a.title.localeCompare(b.title));
  },
});

export const listSessionsForWorkshopUnitAdmin = query({
  args: { workshopUnitId: v.id("units") },
  handler: async (ctx, { workshopUnitId }) => {
    await requireAdminOrCreator(ctx);
    const u = await ctx.db.get(workshopUnitId);
    if (!isLive(u)) {
      return [];
    }
    const sessions = await ctx.db
      .query("workshopSessions")
      .withIndex("by_workshop_unit", (q) =>
        q.eq("workshopUnitId", workshopUnitId),
      )
      .collect();
    sessions.sort((a, b) => a.startsAt - b.startsAt);
    return sessions;
  },
});

export const createSession = mutation({
  args: {
    workshopUnitId: v.id("units"),
    startsAt: v.number(),
    endsAt: v.number(),
    titleOverride: v.optional(v.string()),
    capacity: v.optional(v.number()),
    externalJoinUrl: v.optional(v.string()),
    conferenceProvider: v.optional(conferenceProviderValidator),
    timeZone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCreator(ctx);
    const unit = await ctx.db.get(args.workshopUnitId);
    if (!isLive(unit) || unit.deliveryMode !== "live_workshop") {
      throw new Error("Unit must exist and be a live webinar unit");
    }
    if (args.endsAt <= args.startsAt) {
      throw new Error("End time must be after start time");
    }
    const conferenceProvider = args.conferenceProvider;
    const timeZone =
      args.timeZone != null && args.timeZone.trim() !== ""
        ? args.timeZone.trim()
        : undefined;
    const sessionId = await ctx.db.insert("workshopSessions", {
      workshopUnitId: args.workshopUnitId,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
      titleOverride: args.titleOverride,
      capacity: args.capacity,
      status: "scheduled",
      externalJoinUrl: args.externalJoinUrl,
      ...(conferenceProvider != null ? { conferenceProvider } : {}),
      ...(timeZone != null ? { timeZone } : {}),
    });
    if (conferenceProvider === "microsoft_teams") {
      if (isWorkshopTeamsSimulationEnabled()) {
        await insertWorkshopSyncLog(ctx, {
          sessionId,
          source: "system",
          level: "info",
          message:
            "Admin: Teams simulation on — queuing faux meeting + in-app join URL (no Microsoft Graph).",
        });
        await ctx.scheduler.runAfter(
          0,
          internal.workshopMicrosoftTeams.simulateTeamsMeetingForSession,
          { sessionId },
        );
      } else if (isWorkshopGraphSyncDisabled()) {
        await insertWorkshopSyncLog(ctx, {
          sessionId,
          source: "system",
          level: "warn",
          message:
            "WORKSHOP_GRAPH_DISABLED: Graph meeting create skipped. Set external join URL manually (Teams) or turn the flag off in Convex env.",
        });
      } else {
        await insertWorkshopSyncLog(ctx, {
          sessionId,
          source: "system",
          level: "info",
          message:
            "Admin: session saved as Microsoft Teams (Graph). Queued job createTeamsMeetingForSession.",
        });
        await ctx.scheduler.runAfter(
          0,
          internal.workshopMicrosoftTeams.createTeamsMeetingForSession,
          { sessionId },
        );
      }
    }
    return sessionId;
  },
});

export const updateSession = mutation({
  args: {
    sessionId: v.id("workshopSessions"),
    startsAt: v.number(),
    endsAt: v.number(),
    titleOverride: v.optional(v.string()),
    capacity: v.optional(v.union(v.number(), v.null())),
    status: sessionStatusValidator,
    externalJoinUrl: v.optional(v.union(v.string(), v.null())),
    conferenceProvider: v.optional(
      v.union(conferenceProviderValidator, v.null()),
    ),
    timeZone: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCreator(ctx);
    const {
      sessionId,
      capacity,
      externalJoinUrl,
      conferenceProvider,
      timeZone,
      ...rest
    } = args;
    const row = await ctx.db.get(sessionId);
    if (!row) {
      throw new Error("Session not found");
    }
    if (rest.endsAt <= rest.startsAt) {
      throw new Error("End time must be after start time");
    }
    await ctx.db.patch(sessionId, {
      ...rest,
      ...(capacity !== undefined
        ? { capacity: capacity === null ? undefined : capacity }
        : {}),
      ...(externalJoinUrl !== undefined
        ? {
            externalJoinUrl:
              externalJoinUrl === null ? undefined : externalJoinUrl,
          }
        : {}),
      ...(conferenceProvider !== undefined
        ? {
            conferenceProvider:
              conferenceProvider === null ? undefined : conferenceProvider,
          }
        : {}),
      ...(timeZone !== undefined
        ? {
            timeZone:
              timeZone === null || timeZone.trim() === ""
                ? undefined
                : timeZone.trim(),
          }
        : {}),
    });
    const next = await ctx.db.get(sessionId);
    if (
      next &&
      next.conferenceProvider === "microsoft_teams" &&
      next.status === "scheduled"
    ) {
      if (isWorkshopTeamsSimulationEnabled()) {
        if (!next.teamsGraphEventId) {
          await insertWorkshopSyncLog(ctx, {
            sessionId,
            source: "system",
            level: "info",
            message:
              "Admin: session updated (Teams simulation). Queued simulateTeamsMeetingForSession.",
          });
          await ctx.scheduler.runAfter(
            0,
            internal.workshopMicrosoftTeams.simulateTeamsMeetingForSession,
            { sessionId },
          );
        } else {
          await insertWorkshopSyncLog(ctx, {
            sessionId,
            source: "system",
            level: "info",
            message:
              "Admin: session updated (Teams simulation). Queued updateTeamsMeetingForSession (local only).",
          });
          await ctx.scheduler.runAfter(
            0,
            internal.workshopMicrosoftTeams.updateTeamsMeetingForSession,
            { sessionId },
          );
        }
      } else if (isWorkshopGraphSyncDisabled()) {
        await insertWorkshopSyncLog(ctx, {
          sessionId,
          source: "system",
          level: "warn",
          message:
            "WORKSHOP_GRAPH_DISABLED: Graph create/update skipped after session save.",
        });
      } else if (!next.teamsGraphEventId) {
        await insertWorkshopSyncLog(ctx, {
          sessionId,
          source: "system",
          level: "info",
          message:
            "Admin: session updated (Teams). No Graph event id yet — queued createTeamsMeetingForSession.",
        });
        await ctx.scheduler.runAfter(
          0,
          internal.workshopMicrosoftTeams.createTeamsMeetingForSession,
          { sessionId },
        );
      } else {
        await insertWorkshopSyncLog(ctx, {
          sessionId,
          source: "system",
          level: "info",
          message:
            "Admin: session updated (Teams). Queued job updateTeamsMeetingForSession (PATCH event).",
        });
        await ctx.scheduler.runAfter(
          0,
          internal.workshopMicrosoftTeams.updateTeamsMeetingForSession,
          { sessionId },
        );
      }
    }
  },
});

/**
 * Removes every workshop session for this unit whose **start** falls in
 * `[dayStartMs, dayEndExclusiveMs)` (client should send local-calendar bounds,
 * e.g. `startOfDay` / `startOfDay(addDays(d,1))`).
 */
export const deleteSessionsForWorkshopUnitOnLocalDay = mutation({
  args: {
    workshopUnitId: v.id("units"),
    dayStartMs: v.number(),
    dayEndExclusiveMs: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdminOrCreator(ctx);
    const { workshopUnitId, dayStartMs, dayEndExclusiveMs } = args;
    if (dayEndExclusiveMs <= dayStartMs) {
      throw new Error("Invalid day range");
    }
    const unit = await ctx.db.get(workshopUnitId);
    if (!isLive(unit) || unit.deliveryMode !== "live_workshop") {
      throw new Error("Unit must be a live webinar unit");
    }
    const sessions = await ctx.db
      .query("workshopSessions")
      .withIndex("by_workshop_unit", (q) =>
        q.eq("workshopUnitId", workshopUnitId),
      )
      .collect();
    const toRemove = sessions.filter(
      (s) => s.startsAt >= dayStartMs && s.startsAt < dayEndExclusiveMs,
    );
    if (toRemove.length === 0) {
      return { removed: 0 as const };
    }
    const allAffectedUsers = new Set<Id<"users">>();
    for (const session of toRemove) {
      const pathAttendees = await ctx.db
        .query("certificationWorkshopAttendees")
        .withIndex("by_workshop_session", (q) =>
          q.eq("workshopSessionId", session._id),
        )
        .collect();
      for (const row of pathAttendees) {
        allAffectedUsers.add(row.userId);
        await ctx.db.delete(row._id);
      }
      const regs = await ctx.db
        .query("workshopRegistrations")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const reg of regs) {
        allAffectedUsers.add(reg.userId);
        await ctx.db.delete(reg._id);
      }
      for (const userId of [...new Set(regs.map((r) => r.userId))]) {
        await syncUnitsContainingWorkshopSession(ctx, userId, session._id);
      }
      const linkedContent = await ctx.db
        .query("contentItems")
        .withIndex("by_workshop_session", (q) =>
          q.eq("workshopSessionId", session._id),
        )
        .collect();
      const syncLogs = await ctx.db
        .query("workshopSessionSyncLogs")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const log of syncLogs) {
        await ctx.db.delete(log._id);
      }
      for (const c of linkedContent) {
        if (!isLive(c)) {
          continue;
        }
        await ctx.db.patch(c._id, { deletedAt: nowDeletedAt() });
        const links = await ctx.db
          .query("unitContents")
          .withIndex("by_content", (q) => q.eq("contentId", c._id))
          .collect();
        const unitIdsForReorder = new Set<Id<"units">>();
        for (const link of links) {
          unitIdsForReorder.add(link.unitId);
          await ctx.db.delete(link._id);
        }
        for (const uid of unitIdsForReorder) {
          const rest = await ctx.db
            .query("unitContents")
            .withIndex("by_unit", (q) => q.eq("unitId", uid))
            .collect();
          rest.sort((a, b) => a.order - b.order);
          for (let i = 0; i < rest.length; i++) {
            await ctx.db.patch(rest[i]!._id, { order: i });
          }
        }
      }
      await ctx.db.delete(session._id);
    }
    for (const userId of allAffectedUsers) {
      await syncUnitCompletion(ctx, userId, workshopUnitId);
    }
    return { removed: toRemove.length };
  },
});

export type WorkshopBrowseRow = Doc<"workshopSessions"> & {
  workshopTitle: string;
  /** Distinct tiers from linked certification levels (may be empty). */
  tiers: Array<"bronze" | "silver" | "gold">;
  registered: boolean;
  full: boolean;
};

export const listUpcomingForUser = query({
  args: {
    /** Omit or "all" = any tier; otherwise filter to sessions tied to a level with that tier. */
    certificationTier: v.optional(
      v.union(
        v.literal("all"),
        v.literal("bronze"),
        v.literal("silver"),
        v.literal("gold"),
      ),
    ),
  },
  handler: async (ctx, { certificationTier }): Promise<WorkshopBrowseRow[]> => {
    const userId = await requireUserId(ctx);
    const now = Date.now();
    const allSessions = await ctx.db.query("workshopSessions").collect();
    const upcoming = allSessions.filter(
      (s) => s.status === "scheduled" && s.endsAt >= now,
    );
    upcoming.sort((a, b) => a.startsAt - b.startsAt);
    const tierFilter =
      certificationTier && certificationTier !== "all"
        ? certificationTier
        : null;

    const out: WorkshopBrowseRow[] = [];
    for (const s of upcoming) {
      const ok = await userCanAccessWorkshopSession(ctx, s.workshopUnitId);
      if (!ok) {
        continue;
      }
      const levelIds = await collectLevelIdsForUnit(ctx, s.workshopUnitId);
      const tierSet = new Set<"bronze" | "silver" | "gold">();
      for (const lid of levelIds) {
        const lev = await ctx.db.get(lid);
        if (isLive(lev) && (await userCanAccessLevel(ctx, lid))) {
          tierSet.add(effectiveCertificationTier(lev));
        }
      }
      const tiers = [...tierSet].sort(
        (a, b) =>
          ["bronze", "silver", "gold"].indexOf(a) -
          ["bronze", "silver", "gold"].indexOf(b),
      );
      if (tierFilter && !tiers.includes(tierFilter)) {
        continue;
      }
      const u = await ctx.db.get(s.workshopUnitId);
      const regs = await ctx.db
        .query("workshopRegistrations")
        .withIndex("by_session", (q) => q.eq("sessionId", s._id))
        .collect();
      const registered = regs.some((r) => r.userId === userId);
      const full =
        s.capacity != null && s.capacity > 0 && regs.length >= s.capacity;
      out.push({
        ...s,
        workshopTitle:
          u && isLive(u)
            ? webinarizeForLiveWorkshopUnit(u.title, u.deliveryMode)
            : "Webinar",
        tiers,
        registered,
        full,
      });
    }
    return out;
  },
});

/**
 * Upcoming sessions only for `live_workshop` units on certifications the learner
 * has in progress, pinned on the roadmap, or has not started yet (same buckets
 * as the certification dashboard — excludes completed certifications only).
 */
export const listUpcomingOnMyCertificationPath = query({
  args: {
    certificationTier: v.optional(
      v.union(
        v.literal("all"),
        v.literal("bronze"),
        v.literal("silver"),
        v.literal("gold"),
      ),
    ),
  },
  handler: async (ctx, { certificationTier }): Promise<WorkshopBrowseRow[]> => {
    const userId = await requireUserId(ctx);
    const pathUnitIds = new Set(
      await collectLiveWorkshopUnitIdsOnLearnerCertPaths(ctx, userId),
    );
    if (pathUnitIds.size === 0) {
      return [];
    }
    const now = Date.now();
    const allSessions = await ctx.db.query("workshopSessions").collect();
    const upcoming = allSessions.filter(
      (s) => s.status === "scheduled" && s.endsAt >= now,
    );
    upcoming.sort((a, b) => a.startsAt - b.startsAt);
    const tierFilter =
      certificationTier && certificationTier !== "all"
        ? certificationTier
        : null;

    const out: WorkshopBrowseRow[] = [];
    for (const s of upcoming) {
      if (!pathUnitIds.has(s.workshopUnitId)) {
        continue;
      }
      const ok = await userCanAccessWorkshopSession(ctx, s.workshopUnitId);
      if (!ok) {
        continue;
      }
      const levelIds = await collectLevelIdsForUnit(ctx, s.workshopUnitId);
      const tierSet = new Set<"bronze" | "silver" | "gold">();
      for (const lid of levelIds) {
        const lev = await ctx.db.get(lid);
        if (isLive(lev) && (await userCanAccessLevel(ctx, lid))) {
          tierSet.add(effectiveCertificationTier(lev));
        }
      }
      const tiers = [...tierSet].sort(
        (a, b) =>
          ["bronze", "silver", "gold"].indexOf(a) -
          ["bronze", "silver", "gold"].indexOf(b),
      );
      if (tierFilter && !tiers.includes(tierFilter)) {
        continue;
      }
      const u = await ctx.db.get(s.workshopUnitId);
      const regs = await ctx.db
        .query("workshopRegistrations")
        .withIndex("by_session", (q) => q.eq("sessionId", s._id))
        .collect();
      const registered = regs.some((r) => r.userId === userId);
      const full =
        s.capacity != null && s.capacity > 0 && regs.length >= s.capacity;
      out.push({
        ...s,
        workshopTitle:
          u && isLive(u)
            ? webinarizeForLiveWorkshopUnit(u.title, u.deliveryMode)
            : "Webinar",
        tiers,
        registered,
        full,
      });
    }
    return out;
  },
});

export const myRegistrations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const regs = await ctx.db
      .query("workshopRegistrations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    regs.sort((a, b) => b.registeredAt - a.registeredAt);
    const now = Date.now();
    const out: Array<{
      registration: Doc<"workshopRegistrations">;
      session: Doc<"workshopSessions">;
      workshopTitle: string;
      past: boolean;
    }> = [];
    for (const r of regs) {
      const session = await ctx.db.get(r.sessionId);
      if (!session) {
        continue;
      }
      const ok = await userCanAccessWorkshopSession(ctx, session.workshopUnitId);
      if (!ok) {
        continue;
      }
      const u = await ctx.db.get(session.workshopUnitId);
      out.push({
        registration: r,
        session,
        workshopTitle:
          u && isLive(u)
            ? webinarizeForLiveWorkshopUnit(u.title, u.deliveryMode)
            : "Webinar",
        past: session.endsAt < now,
      });
    }
    out.sort((a, b) => a.session.startsAt - b.session.startsAt);
    return out;
  },
});

/**
 * Registrations whose workshop unit sits on the learner’s certification path
 * (current / planned / future — same scope as `listUpcomingOnMyCertificationPath`).
 * Used for the “Registered” column only so the UI is not duplicated elsewhere.
 */
export const myRegistrationsOnCertificationPath = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const pathUnitIds = new Set(
      await collectLiveWorkshopUnitIdsOnLearnerCertPaths(ctx, userId),
    );
    if (pathUnitIds.size === 0) {
      return [];
    }
    const regs = await ctx.db
      .query("workshopRegistrations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    regs.sort((a, b) => b.registeredAt - a.registeredAt);
    const now = Date.now();
    const out: Array<{
      registration: Doc<"workshopRegistrations">;
      session: Doc<"workshopSessions">;
      workshopTitle: string;
      /** From `units.code` when set (admin short id). */
      workshopUnitCode: string | null;
      past: boolean;
      tiers: Array<"bronze" | "silver" | "gold">;
    }> = [];
    for (const r of regs) {
      const session = await ctx.db.get(r.sessionId);
      if (!session || !pathUnitIds.has(session.workshopUnitId)) {
        continue;
      }
      const ok = await userCanAccessWorkshopSession(ctx, session.workshopUnitId);
      if (!ok) {
        continue;
      }
      const u = await ctx.db.get(session.workshopUnitId);
      const levelIds = await collectLevelIdsForUnit(ctx, session.workshopUnitId);
      const tierSet = new Set<"bronze" | "silver" | "gold">();
      for (const lid of levelIds) {
        const lev = await ctx.db.get(lid);
        if (isLive(lev) && (await userCanAccessLevel(ctx, lid))) {
          tierSet.add(effectiveCertificationTier(lev));
        }
      }
      const tiers = [...tierSet].sort(
        (a, b) =>
          ["bronze", "silver", "gold"].indexOf(a) -
          ["bronze", "silver", "gold"].indexOf(b),
      );
      out.push({
        registration: r,
        session,
        workshopTitle:
          u && isLive(u)
            ? webinarizeForLiveWorkshopUnit(u.title, u.deliveryMode)
            : "Webinar",
        workshopUnitCode:
          u && isLive(u) ? (u.code?.trim() ? u.code.trim() : null) : null,
        past: session.endsAt < now,
        tiers,
      });
    }
    out.sort((a, b) => a.session.startsAt - b.session.startsAt);
    return out;
  },
});

/** Learner: upcoming sessions for one live workshop unit (register / change date from certification path). */
export const listUpcomingSessionsForWorkshopUnit = query({
  args: { workshopUnitId: v.id("units") },
  handler: async (ctx, { workshopUnitId }) => {
    const userId = await requireUserId(ctx);
    const ok = await userCanAccessWorkshopSession(ctx, workshopUnitId);
    if (!ok) {
      return null;
    }
    const unit = await ctx.db.get(workshopUnitId);
    if (!isLive(unit) || unit.deliveryMode !== "live_workshop") {
      return null;
    }
    const now = Date.now();
    const sessions = await ctx.db
      .query("workshopSessions")
      .withIndex("by_workshop_unit", (q) =>
        q.eq("workshopUnitId", workshopUnitId),
      )
      .collect();
    const upcoming = sessions.filter(
      (s) => s.status === "scheduled" && s.endsAt >= now,
    );
    upcoming.sort((a, b) => a.startsAt - b.startsAt);
    const rows: Array<{
      session: Doc<"workshopSessions">;
      registered: boolean;
      full: boolean;
    }> = [];
    for (const s of upcoming) {
      const regs = await ctx.db
        .query("workshopRegistrations")
        .withIndex("by_session", (q) => q.eq("sessionId", s._id))
        .collect();
      const registered = regs.some((r) => r.userId === userId);
      const full =
        s.capacity != null && s.capacity > 0 && regs.length >= s.capacity;
      rows.push({ session: s, registered, full });
    }
    return {
      unitTitle: webinarizeForLiveWorkshopUnit(unit.title, unit.deliveryMode),
      sessions: rows,
    };
  },
});

/**
 * Session to drive the embedded live room on a workshop unit: earliest upcoming
 * registration for this unit, else the most recently ended one (chat-only context).
 */
export const myRegisteredSessionForLiveWorkshopUnit = query({
  args: {
    workshopUnitId: v.id("units"),
    /** When set, use this session if the learner is registered (e.g. reopen a closed run). */
    workshopSessionId: v.optional(v.id("workshopSessions")),
  },
  handler: async (ctx, { workshopUnitId, workshopSessionId }) => {
    const userId = await requireUserId(ctx);
    const ok = await userCanAccessWorkshopSession(ctx, workshopUnitId);
    if (!ok) {
      return null;
    }
    const unit = await ctx.db.get(workshopUnitId);
    if (!isLive(unit) || unit.deliveryMode !== "live_workshop") {
      return null;
    }
    const regs = await ctx.db
      .query("workshopRegistrations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const now = Date.now();
    type Row = {
      session: Doc<"workshopSessions">;
      registration: Doc<"workshopRegistrations">;
    };
    if (workshopSessionId) {
      const focused = await ctx.db.get(workshopSessionId);
      if (
        focused &&
        focused.workshopUnitId === workshopUnitId &&
        focused.status === "scheduled"
      ) {
        const reg = await ctx.db
          .query("workshopRegistrations")
          .withIndex("by_session_and_user", (q) =>
            q.eq("sessionId", workshopSessionId).eq("userId", userId),
          )
          .unique();
        if (reg) {
          return { session: focused, registration: reg };
        }
        const user = await ctx.db.get(userId);
        const isLiveHost =
          user != null &&
          (user.role === "admin" || user.role === "content_creator");
        if (isLiveHost) {
          return { session: focused, registration: null };
        }
      }
    }
    const rows: Row[] = [];
    for (const r of regs) {
      const s = await ctx.db.get(r.sessionId);
      if (!s || s.workshopUnitId !== workshopUnitId || s.status !== "scheduled") {
        continue;
      }
      rows.push({ session: s, registration: r });
    }
    if (rows.length === 0) {
      return null;
    }
    rows.sort((a, b) => a.session.startsAt - b.session.startsAt);
    const upcoming = rows.filter((r) => r.session.endsAt >= now);
    if (upcoming.length > 0) {
      return upcoming[0]!;
    }
    rows.sort((a, b) => b.session.endsAt - a.session.endsAt);
    return rows[0]!;
  },
});

/**
 * Reactive live-room flags for anyone who may join the call (host or registered).
 * Drives whiteboard show/hide for all participants; reads the same `workshopSessions`
 * row as `setWorkshopWhiteboardVisible` / LiveKit gate.
 */
export const workshopSessionLiveFlags = query({
  args: { workshopSessionId: v.id("workshopSessions") },
  handler: async (ctx, { workshopSessionId }) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    const session = await ctx.db.get(workshopSessionId);
    if (!session || session.status !== "scheduled") {
      return null;
    }
    const canAccess = await userCanAccessWorkshopSession(
      ctx,
      session.workshopUnitId,
    );
    if (!canAccess) {
      return null;
    }
    const isLiveHost =
      user != null &&
      (user.role === "admin" || user.role === "content_creator");
    const reg = await ctx.db
      .query("workshopRegistrations")
      .withIndex("by_session_and_user", (q) =>
        q.eq("sessionId", workshopSessionId).eq("userId", userId),
      )
      .unique();
    if (!isLiveHost && !reg) {
      return null;
    }
    return {
      liveRoomOpenedAt: session.liveRoomOpenedAt,
      whiteboardVisible: session.whiteboardVisible,
    };
  },
});

/**
 * Admin / content creator: marks the LiveKit room as open so registered learners
 * can join. Idempotent if already opened.
 */
export const openWorkshopLiveRoom = mutation({
  args: { workshopSessionId: v.id("workshopSessions") },
  handler: async (ctx, { workshopSessionId }) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("Unauthorized");
    }
    if (user.role !== "admin" && user.role !== "content_creator") {
      throw new Error("Only a host can start the live session.");
    }
    const session = await ctx.db.get(workshopSessionId);
    if (!session || session.status !== "scheduled") {
      throw new Error("Session is not available.");
    }
    const ok = await userCanAccessWorkshopSession(ctx, session.workshopUnitId);
    if (!ok) {
      throw new Error("Forbidden");
    }
    if (session.endsAt < Date.now()) {
      throw new Error("This session has ended.");
    }
    if (session.liveRoomOpenedAt != null) {
      return { ok: true as const, alreadyOpen: true as const };
    }
    await ctx.db.patch(workshopSessionId, {
      liveRoomOpenedAt: Date.now(),
      whiteboardVisible: true,
    });
    return { ok: true as const, alreadyOpen: false as const };
  },
});

/** Clears “live room open” after host ends the LiveKit room (internal only). */
export const closeWorkshopLiveRoomInternal = internalMutation({
  args: { workshopSessionId: v.id("workshopSessions") },
  handler: async (ctx, { workshopSessionId }) => {
    // Like GritHub brainstorm ink: strokes stay in Convex when the AV room closes;
    // only session flags are cleared so the next open can show the same board.
    await ctx.db.patch(workshopSessionId, {
      liveRoomOpenedAt: undefined,
      whiteboardVisible: undefined,
    });
  },
});

/** Host: show or hide the embedded workshop whiteboard for all participants. */
export const setWorkshopWhiteboardVisible = mutation({
  args: {
    workshopSessionId: v.id("workshopSessions"),
    visible: v.boolean(),
  },
  handler: async (ctx, { workshopSessionId, visible }) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("Unauthorized");
    }
    if (user.role !== "admin" && user.role !== "content_creator") {
      throw new Error("Only a host can change the whiteboard.");
    }
    const session = await ctx.db.get(workshopSessionId);
    if (!session || session.status !== "scheduled") {
      throw new Error("Session is not available.");
    }
    const ok = await userCanAccessWorkshopSession(ctx, session.workshopUnitId);
    if (!ok) {
      throw new Error("Forbidden");
    }
    if (session.endsAt < Date.now()) {
      throw new Error("This webinar session has ended.");
    }
    if (session.liveRoomOpenedAt == null) {
      throw new Error("Start the live session before changing the whiteboard.");
    }
    await ctx.db.patch(workshopSessionId, {
      whiteboardVisible: visible,
    });
    return { ok: true as const };
  },
});

export const registerForSession = mutation({
  args: { sessionId: v.id("workshopSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await requireUserId(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session || session.status !== "scheduled") {
      throw new Error("Session is not available for registration");
    }
    const ok = await userCanAccessWorkshopSession(ctx, session.workshopUnitId);
    if (!ok) {
      throw new Error("Forbidden");
    }
    const regs = await ctx.db
      .query("workshopRegistrations")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    if (
      session.capacity != null &&
      session.capacity > 0 &&
      regs.length >= session.capacity
    ) {
      throw new Error("This session is full");
    }
    const existing = await ctx.db
      .query("workshopRegistrations")
      .withIndex("by_session_and_user", (q) =>
        q.eq("sessionId", sessionId).eq("userId", userId),
      )
      .unique();
    if (existing) {
      return { ok: true as const };
    }
    await ctx.db.insert("workshopRegistrations", {
      userId,
      sessionId,
      registeredAt: Date.now(),
    });
    await syncUnitsContainingWorkshopSession(ctx, userId, sessionId);
    if (session.conferenceProvider === "microsoft_teams") {
      if (isWorkshopTeamsSimulationEnabled()) {
        await insertWorkshopSyncLog(ctx, {
          sessionId,
          source: "system",
          level: "info",
          message: `WORKSHOP_TEAMS_SIMULATION: queued attendee flow (Resend only, no Graph) for userId=${userId}.`,
        });
        await ctx.scheduler.runAfter(
          0,
          internal.workshopMicrosoftTeams.addGraphAttendeeForWorkshopRegistration,
          { sessionId, userId, attempt: 0 },
        );
      } else if (isWorkshopGraphSyncDisabled()) {
        await insertWorkshopSyncLog(ctx, {
          sessionId,
          source: "system",
          level: "warn",
          message: `WORKSHOP_GRAPH_DISABLED: skipped Graph attendee sync for userId=${userId}.`,
        });
      } else {
        await insertWorkshopSyncLog(ctx, {
          sessionId,
          source: "system",
          level: "info",
          message: `Learner registered in app (userId=${userId}). Queued addGraphAttendeeForWorkshopRegistration (Graph + optional Resend).`,
        });
        await ctx.scheduler.runAfter(
          0,
          internal.workshopMicrosoftTeams.addGraphAttendeeForWorkshopRegistration,
          { sessionId, userId, attempt: 0 },
        );
      }
    }
    return { ok: true as const };
  },
});

export const workshopSessionSyncTrace = query({
  args: {
    sessionId: v.id("workshopSessions"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sessionId, limit: limitArg }) => {
    const userId = await requireUserId(ctx);
    const limit = Math.min(Math.max(limitArg ?? 60, 1), 120);
    const session = await ctx.db.get(sessionId);
    if (!session || session.conferenceProvider !== "microsoft_teams") {
      return [];
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      return [];
    }
    let allowed = false;
    if (user.role === "admin") {
      allowed = true;
    } else if (user.role === "content_creator") {
      allowed = await userCanAccessWorkshopSession(
        ctx,
        session.workshopUnitId,
      );
    } else {
      const reg = await ctx.db
        .query("workshopRegistrations")
        .withIndex("by_session_and_user", (q) =>
          q.eq("sessionId", sessionId).eq("userId", userId),
        )
        .unique();
      allowed = reg != null;
    }
    if (!allowed) {
      return [];
    }
    const rows = await ctx.db
      .query("workshopSessionSyncLogs")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    rows.sort((a, b) => a.at - b.at);
    return rows.slice(-limit).map((r) => ({
      _id: r._id,
      at: r.at,
      source: r.source,
      level: r.level,
      message: r.message,
    }));
  },
});

export const getSessionForUser = query({
  args: { sessionId: v.id("workshopSessions") },
  handler: async (ctx, { sessionId }) => {
    await requireUserId(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session) {
      return null;
    }
    const ok = await userCanAccessWorkshopSession(ctx, session.workshopUnitId);
    if (!ok) {
      return null;
    }
    const unit = await ctx.db.get(session.workshopUnitId);
    return {
      session,
      workshopTitle:
        unit && isLive(unit)
          ? webinarizeForLiveWorkshopUnit(unit.title, unit.deliveryMode)
          : "Webinar",
    };
  },
});

export const registrationStatus = query({
  args: { sessionId: v.id("workshopSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await requireUserId(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session) {
      return null;
    }
    const ok = await userCanAccessWorkshopSession(ctx, session.workshopUnitId);
    if (!ok) {
      return null;
    }
    const reg = await ctx.db
      .query("workshopRegistrations")
      .withIndex("by_session_and_user", (q) =>
        q.eq("sessionId", sessionId).eq("userId", userId),
      )
      .unique();
    return {
      registered: reg != null,
      teamsFirstJoinedAt: reg?.teamsFirstJoinedAt,
      teamsLastLeftAt: reg?.teamsLastLeftAt,
    };
  },
});

/** Teams workshops: record first join from the PWA (best-effort). */
export const recordTeamsJoin = mutation({
  args: { sessionId: v.id("workshopSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await requireUserId(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session || session.conferenceProvider !== "microsoft_teams") {
      throw new Error("Not a Microsoft Teams webinar session.");
    }
    const reg = await ctx.db
      .query("workshopRegistrations")
      .withIndex("by_session_and_user", (q) =>
        q.eq("sessionId", sessionId).eq("userId", userId),
      )
      .unique();
    if (!reg) {
      throw new Error("You are not registered for this session.");
    }
    const now = Date.now();
    await ctx.db.patch(reg._id, {
      teamsFirstJoinedAt: reg.teamsFirstJoinedAt ?? now,
    });
    return { ok: true as const };
  },
});

/** Teams workshops: record leave signal from the PWA. */
export const recordTeamsLeave = mutation({
  args: { sessionId: v.id("workshopSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await requireUserId(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session || session.conferenceProvider !== "microsoft_teams") {
      throw new Error("Not a Microsoft Teams webinar session.");
    }
    const reg = await ctx.db
      .query("workshopRegistrations")
      .withIndex("by_session_and_user", (q) =>
        q.eq("sessionId", sessionId).eq("userId", userId),
      )
      .unique();
    if (!reg) {
      throw new Error("You are not registered for this session.");
    }
    await ctx.db.patch(reg._id, {
      teamsLastLeftAt: Date.now(),
    });
    return { ok: true as const };
  },
});

export const unregisterFromSession = mutation({
  args: { sessionId: v.id("workshopSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await requireUserId(ctx);
    const session = await ctx.db.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    const ok = await userCanAccessWorkshopSession(ctx, session.workshopUnitId);
    if (!ok) {
      throw new Error("Forbidden");
    }
    const existing = await ctx.db
      .query("workshopRegistrations")
      .withIndex("by_session_and_user", (q) =>
        q.eq("sessionId", sessionId).eq("userId", userId),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    await syncUnitsContainingWorkshopSession(ctx, userId, sessionId);
    return { ok: true as const };
  },
});

/** One-time or repeat-safe: set `certificationTier` = bronze where missing. */
export const backfillCertificationTiers = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminOrCreator(ctx);
    let patched = 0;
    for (const row of await ctx.db.query("certificationLevels").collect()) {
      if (row.certificationTier === undefined && row.deletedAt == null) {
        await ctx.db.patch(row._id, { certificationTier: "bronze" });
        patched += 1;
      }
    }
    return { patched };
  },
});
