import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { isLive } from "./lib/softDelete";
import { webinarizeForLiveWorkshopUnit } from "./lib/webinarDisplayText";
import {
  fetchGraphAccessToken,
  formatGraphDateTime,
  graphJson,
  readGraphEnv,
} from "./lib/microsoftGraph";
import { isWorkshopGraphSyncDisabled } from "./lib/workshopGraphKillSwitch";
import {
  isSimulatedTeamsGraphEventId,
  isWorkshopTeamsSimulationEnabled,
  workshopSimulationPublicOrigin,
} from "./lib/workshopTeamsSimulation";
import { insertWorkshopSyncLog } from "./lib/workshopSyncLog";
import { normalizeAttendeesForPatch } from "./lib/workshopGraphAttendees";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readTeamsJoinFromEventPayload(data: Record<string, unknown>): {
  joinUrl: string;
  meetingId: string | undefined;
} {
  const onlineMeeting = data.onlineMeeting as
    | Record<string, unknown>
    | undefined;
  const joinUrl = String(
    onlineMeeting?.joinUrl ?? onlineMeeting?.joinWebUrl ?? "",
  );
  const meetingId =
    onlineMeeting?.id != null ? String(onlineMeeting.id) : undefined;
  return { joinUrl, meetingId };
}

export const appendWorkshopSyncLogInternal = internalMutation({
  args: {
    sessionId: v.id("workshopSessions"),
    source: v.union(
      v.literal("graph"),
      v.literal("resend"),
      v.literal("system"),
    ),
    level: v.union(v.literal("info"), v.literal("warn"), v.literal("error")),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await insertWorkshopSyncLog(ctx, args);
  },
});

export const getTeamsSessionForCreate = internalQuery({
  args: { sessionId: v.id("workshopSessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (
      !session ||
      session.status !== "scheduled" ||
      session.conferenceProvider !== "microsoft_teams"
    ) {
      return null;
    }
    const unit = await ctx.db.get(session.workshopUnitId);
    if (!unit || !isLive(unit)) {
      return null;
    }
    return {
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      titleOverride: session.titleOverride,
      timeZone: session.timeZone,
      teamsGraphEventId: session.teamsGraphEventId,
      unitTitle: webinarizeForLiveWorkshopUnit(unit.title, unit.deliveryMode),
    };
  },
});

export const getTeamsSessionForAttendeeSync = internalQuery({
  args: { sessionId: v.id("workshopSessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (
      !session ||
      session.status !== "scheduled" ||
      session.conferenceProvider !== "microsoft_teams"
    ) {
      return null;
    }
    return {
      teamsGraphEventId: session.teamsGraphEventId,
      teamsOrganizerId: session.teamsOrganizerId,
      timeZone: session.timeZone,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      titleOverride: session.titleOverride,
      externalJoinUrl: session.externalJoinUrl,
    };
  },
});

export const getUserEmailAndNameInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const u = await ctx.db.get(userId);
    if (!u) {
      return null;
    }
    return { email: u.email, name: u.name };
  },
});

export const getWorkshopUnitTitleInternal = internalQuery({
  args: { unitId: v.id("units") },
  handler: async (ctx, { unitId }) => {
    const u = await ctx.db.get(unitId);
    if (!u || !isLive(u)) {
      return null;
    }
    return webinarizeForLiveWorkshopUnit(u.title, u.deliveryMode);
  },
});

export const commitTeamsMeetingCreated = internalMutation({
  args: {
    sessionId: v.id("workshopSessions"),
    externalJoinUrl: v.string(),
    teamsGraphEventId: v.string(),
    teamsOnlineMeetingId: v.optional(v.string()),
    teamsOrganizerId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.sessionId, {
      externalJoinUrl: args.externalJoinUrl,
      teamsGraphEventId: args.teamsGraphEventId,
      teamsOnlineMeetingId: args.teamsOnlineMeetingId,
      teamsOrganizerId: args.teamsOrganizerId,
      teamsLastSyncAt: now,
      teamsLastError: undefined,
    });
    const regs = await ctx.db
      .query("workshopRegistrations")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    await insertWorkshopSyncLog(ctx, {
      sessionId: args.sessionId,
      source: "graph",
      level: "info",
      message: `Teams calendar event created. Graph event id=${args.teamsGraphEventId}. Join URL stored. Queuing attendee sync for ${regs.length} registration(s).`,
    });
    for (const r of regs) {
      await ctx.scheduler.runAfter(
        0,
        internal.workshopMicrosoftTeams.addGraphAttendeeForWorkshopRegistration,
        { sessionId: args.sessionId, userId: r.userId, attempt: 0 },
      );
    }
  },
});

export const commitSimulatedTeamsMeeting = internalMutation({
  args: {
    sessionId: v.id("workshopSessions"),
    externalJoinUrl: v.string(),
    teamsGraphEventId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.sessionId, {
      externalJoinUrl: args.externalJoinUrl,
      teamsGraphEventId: args.teamsGraphEventId,
      teamsOnlineMeetingId: undefined,
      teamsOrganizerId: "simulation",
      teamsLastSyncAt: now,
      teamsLastError: undefined,
    });
    await insertWorkshopSyncLog(ctx, {
      sessionId: args.sessionId,
      source: "system",
      level: "info",
      message:
        "WORKSHOP_TEAMS_SIMULATION: stored faux Teams join URL (no Microsoft Graph). Registration and join/leave still work in the app.",
    });
  },
});

export const commitTeamsMeetingCreateError = internalMutation({
  args: {
    sessionId: v.id("workshopSessions"),
    error: v.string(),
  },
  handler: async (ctx, { sessionId, error }) => {
    await ctx.db.patch(sessionId, {
      teamsLastSyncAt: Date.now(),
      teamsLastError: error.slice(0, 4000),
    });
    await insertWorkshopSyncLog(ctx, {
      sessionId,
      source: "graph",
      level: "error",
      message: `Create Teams meeting failed: ${error}`,
    });
  },
});

export const scheduleAttendeeDefer = internalMutation({
  args: {
    sessionId: v.id("workshopSessions"),
    userId: v.id("users"),
    attempt: v.number(),
  },
  handler: async (ctx, { sessionId, userId, attempt }) => {
    await insertWorkshopSyncLog(ctx, {
      sessionId,
      source: "system",
      level: "info",
      message: `Graph event not ready yet; rescheduling attendee sync in 3s (attempt ${attempt}). userId=${userId}`,
    });
    await ctx.scheduler.runAfter(
      3000,
      internal.workshopMicrosoftTeams.addGraphAttendeeForWorkshopRegistration,
      { sessionId, userId, attempt },
    );
  },
});

export const commitTeamsMeetingUpdateError = internalMutation({
  args: {
    sessionId: v.id("workshopSessions"),
    error: v.string(),
  },
  handler: async (ctx, { sessionId, error }) => {
    await ctx.db.patch(sessionId, {
      teamsLastSyncAt: Date.now(),
      teamsLastError: error.slice(0, 4000),
    });
    await insertWorkshopSyncLog(ctx, {
      sessionId,
      source: "graph",
      level: "error",
      message: `Graph update/attendee step failed: ${error}`,
    });
  },
});

export const createTeamsMeetingForSession = internalAction({
  args: { sessionId: v.id("workshopSessions") },
  handler: async (ctx, { sessionId }) => {
    if (
      isWorkshopGraphSyncDisabled() &&
      !isWorkshopTeamsSimulationEnabled()
    ) {
      await ctx.runMutation(
        internal.workshopMicrosoftTeams.appendWorkshopSyncLogInternal,
        {
          sessionId,
          source: "system",
          level: "warn",
          message:
            "createTeamsMeetingForSession skipped: WORKSHOP_GRAPH_DISABLED is set.",
        },
      );
      return { skipped: true as const, reason: "graph_disabled" as const };
    }
    if (isWorkshopTeamsSimulationEnabled()) {
      await ctx.runMutation(
        internal.workshopMicrosoftTeams.appendWorkshopSyncLogInternal,
        {
          sessionId,
          source: "system",
          level: "info",
          message:
            "createTeamsMeetingForSession skipped: WORKSHOP_TEAMS_SIMULATION uses simulateTeamsMeetingForSession instead.",
        },
      );
      return { skipped: true as const, reason: "simulation" as const };
    }
    const row = await ctx.runQuery(
      internal.workshopMicrosoftTeams.getTeamsSessionForCreate,
      { sessionId },
    );
    if (!row) {
      return { skipped: true as const };
    }
    if (row.teamsGraphEventId) {
      await ctx.runMutation(
        internal.workshopMicrosoftTeams.appendWorkshopSyncLogInternal,
        {
          sessionId,
          source: "system",
          level: "info",
          message:
            "createTeamsMeetingForSession skipped: session already has teamsGraphEventId.",
        },
      );
      return { skipped: true as const, reason: "already_exists" as const };
    }
    await ctx.runMutation(
      internal.workshopMicrosoftTeams.appendWorkshopSyncLogInternal,
      {
        sessionId,
        source: "graph",
        level: "info",
        message:
          "Starting Graph: POST plain calendar event, then PATCH for Teams online meeting…",
      },
    );
    try {
      const env = readGraphEnv();
      const { accessToken } = await fetchGraphAccessToken({
        tenantId: env.tenantId,
        clientId: env.clientId,
        clientSecret: env.clientSecret,
      });
      const tz = row.timeZone || env.defaultTimeZone;
      const start = formatGraphDateTime(row.startsAt, tz);
      const end = formatGraphDateTime(row.endsAt, tz);
      const subject =
        row.titleOverride?.trim() || `Webinar: ${row.unitTitle}`;
      const eventBase = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(env.organizerUserId)}/events`;
      const shellBody = {
        subject,
        body: {
          contentType: "HTML",
          content: `<p>${escapeHtml(subject)}</p>`,
        },
        start: { dateTime: start, timeZone: tz },
        end: { dateTime: end, timeZone: tz },
      };
      const post = await graphJson<Record<string, unknown>>(
        accessToken,
        "POST",
        eventBase,
        shellBody,
      );
      if (!post.ok) {
        throw new Error(
          `Graph POST event (calendar shell) ${post.status}: ${post.httpFailureText || post.text}`,
        );
      }
      const eventId = String(post.data.id ?? "");
      if (!eventId) {
        throw new Error("Graph POST event returned no event id");
      }
      await ctx.runMutation(
        internal.workshopMicrosoftTeams.appendWorkshopSyncLogInternal,
        {
          sessionId,
          source: "graph",
          level: "info",
          message: `Graph POST calendar shell OK (event id). PATCH for Teams…`,
        },
      );
      const oneEvent = `${eventBase}/${encodeURIComponent(eventId)}`;
      const patchTeams = await graphJson<Record<string, unknown>>(
        accessToken,
        "PATCH",
        oneEvent,
        {
          isOnlineMeeting: true,
          onlineMeetingProvider: "teamsForBusiness",
        },
      );
      if (!patchTeams.ok) {
        await graphJson<unknown>(accessToken, "DELETE", oneEvent);
        throw new Error(
          `Graph PATCH Teams on event ${patchTeams.status}: ${patchTeams.httpFailureText || patchTeams.text}`,
        );
      }
      await ctx.runMutation(
        internal.workshopMicrosoftTeams.appendWorkshopSyncLogInternal,
        {
          sessionId,
          source: "graph",
          level: "info",
          message: `Graph PATCH Teams returned HTTP ${patchTeams.status}. Resolving join URL…`,
        },
      );
      let data = patchTeams.data as Record<string, unknown>;
      let { joinUrl, meetingId } = readTeamsJoinFromEventPayload(data);
      if (!joinUrl) {
        const sel = `${oneEvent}?$select=id,onlineMeeting`;
        const got = await graphJson<Record<string, unknown>>(
          accessToken,
          "GET",
          sel,
        );
        if (!got.ok) {
          throw new Error(
            `Graph GET event after Teams PATCH ${got.status}: ${got.httpFailureText || got.text}`,
          );
        }
        data = got.data as Record<string, unknown>;
        ({ joinUrl, meetingId } = readTeamsJoinFromEventPayload(data));
      }
      if (!joinUrl) {
        throw new Error(
          "Graph response missing Teams join URL after PATCH (try OnlineMeetings.ReadWrite.All or organizer Teams license)",
        );
      }
      await ctx.runMutation(
        internal.workshopMicrosoftTeams.commitTeamsMeetingCreated,
        {
          sessionId,
          externalJoinUrl: joinUrl,
          teamsGraphEventId: eventId,
          teamsOnlineMeetingId: meetingId,
          teamsOrganizerId: env.organizerUserId,
        },
      );
      return { ok: true as const };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(
        internal.workshopMicrosoftTeams.commitTeamsMeetingCreateError,
        { sessionId, error: msg },
      );
      return { ok: false as const, error: msg };
    }
  },
});

export const simulateTeamsMeetingForSession = internalAction({
  args: { sessionId: v.id("workshopSessions") },
  handler: async (ctx, { sessionId }) => {
    if (!isWorkshopTeamsSimulationEnabled()) {
      return { skipped: true as const, reason: "simulation_off" as const };
    }
    const row = await ctx.runQuery(
      internal.workshopMicrosoftTeams.getTeamsSessionForCreate,
      { sessionId },
    );
    if (!row) {
      return { skipped: true as const };
    }
    if (row.teamsGraphEventId) {
      return { skipped: true as const, reason: "already_exists" as const };
    }
    const origin = workshopSimulationPublicOrigin();
    if (!origin) {
      await ctx.runMutation(
        internal.workshopMicrosoftTeams.commitTeamsMeetingCreateError,
        {
          sessionId,
          error:
            "WORKSHOP_TEAMS_SIMULATION is on but WORKSHOP_SIMULATION_PUBLIC_ORIGIN is missing. Set it to your site root, e.g. https://localhost:3000",
        },
      );
      return { ok: false as const, error: "missing_origin" as const };
    }
    const joinUrl = `${origin}/workshop-sim/join/${sessionId}`;
    const teamsGraphEventId = `sim:${sessionId}`;
    await ctx.runMutation(
      internal.workshopMicrosoftTeams.commitSimulatedTeamsMeeting,
      { sessionId, externalJoinUrl: joinUrl, teamsGraphEventId },
    );
    return { ok: true as const };
  },
});

export const updateTeamsMeetingForSession = internalAction({
  args: { sessionId: v.id("workshopSessions") },
  handler: async (ctx, { sessionId }) => {
    const row = await ctx.runQuery(
      internal.workshopMicrosoftTeams.getTeamsSessionForAttendeeSync,
      { sessionId },
    );
    if (!row || !row.teamsGraphEventId || !row.teamsOrganizerId) {
      return { skipped: true as const };
    }
    if (
      isWorkshopGraphSyncDisabled() &&
      !isSimulatedTeamsGraphEventId(row.teamsGraphEventId)
    ) {
      await ctx.runMutation(
        internal.workshopMicrosoftTeams.appendWorkshopSyncLogInternal,
        {
          sessionId,
          source: "system",
          level: "warn",
          message:
            "updateTeamsMeetingForSession skipped: WORKSHOP_GRAPH_DISABLED is set.",
        },
      );
      return { skipped: true as const, reason: "graph_disabled" as const };
    }
    if (isSimulatedTeamsGraphEventId(row.teamsGraphEventId)) {
      await ctx.runMutation(
        internal.workshopMicrosoftTeams.patchSessionTeamsUpdateOk,
        { sessionId },
      );
      await ctx.runMutation(
        internal.workshopMicrosoftTeams.appendWorkshopSyncLogInternal,
        {
          sessionId,
          source: "system",
          level: "info",
          message:
            "WORKSHOP_TEAMS_SIMULATION: session times saved in app only (no Graph PATCH).",
        },
      );
      return { ok: true as const, simulated: true as const };
    }
    await ctx.runMutation(
      internal.workshopMicrosoftTeams.appendWorkshopSyncLogInternal,
      {
        sessionId,
        source: "graph",
        level: "info",
        message:
          "Starting Graph: PATCH calendar event (update start/end/subject)…",
      },
    );
    try {
      const env = readGraphEnv();
      const { accessToken } = await fetchGraphAccessToken({
        tenantId: env.tenantId,
        clientId: env.clientId,
        clientSecret: env.clientSecret,
      });
      const tz = row.timeZone || env.defaultTimeZone;
      const start = formatGraphDateTime(row.startsAt, tz);
      const end = formatGraphDateTime(row.endsAt, tz);
      const unitTitle =
        (await ctx.runQuery(
          internal.workshopMicrosoftTeams.getWorkshopUnitTitleFromSession,
          { sessionId },
        )) ?? "Webinar";
      const subject =
        row.titleOverride?.trim() || `Webinar: ${unitTitle}`;
      const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(row.teamsOrganizerId)}/events/${encodeURIComponent(row.teamsGraphEventId)}`;
      const patchBody = {
        subject,
        start: { dateTime: start, timeZone: tz },
        end: { dateTime: end, timeZone: tz },
      };
      const r = await graphJson<unknown>(
        accessToken,
        "PATCH",
        url,
        patchBody,
      );
      if (!r.ok) {
        throw new Error(
          `Graph PATCH event ${r.status}: ${r.httpFailureText || r.text}`,
        );
      }
      await ctx.runMutation(
        internal.workshopMicrosoftTeams.patchSessionTeamsUpdateOk,
        { sessionId },
      );
      await ctx.runMutation(
        internal.workshopMicrosoftTeams.appendWorkshopSyncLogInternal,
        {
          sessionId,
          source: "graph",
          level: "info",
          message: "Graph PATCH event succeeded (times/title updated).",
        },
      );
      return { ok: true as const };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(
        internal.workshopMicrosoftTeams.commitTeamsMeetingUpdateError,
        { sessionId, error: msg },
      );
      return { ok: false as const, error: msg };
    }
  },
});

export const getWorkshopUnitTitleFromSession = internalQuery({
  args: { sessionId: v.id("workshopSessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) {
      return null;
    }
    const unit = await ctx.db.get(session.workshopUnitId);
    if (!unit || !isLive(unit)) {
      return null;
    }
    return webinarizeForLiveWorkshopUnit(unit.title, unit.deliveryMode);
  },
});

export const patchSessionTeamsUpdateOk = internalMutation({
  args: { sessionId: v.id("workshopSessions") },
  handler: async (ctx, { sessionId }) => {
    await ctx.db.patch(sessionId, {
      teamsLastSyncAt: Date.now(),
      teamsLastError: undefined,
    });
  },
});

async function sendResendWorkshopConfirmation(params: {
  to: string;
  workshopTitle: string;
  joinUrl: string;
}): Promise<
  | { outcome: "skipped"; reason: string }
  | { outcome: "sent"; status: number }
  | { outcome: "failed"; status: number; body: string }
> {
  const apiKey = (process.env.RESEND_API_KEY ?? "").trim();
  const from = (process.env.RESEND_WORKSHOP_FROM ?? "").trim();
  if (!apiKey || !from) {
    return {
      outcome: "skipped",
      reason: "RESEND_API_KEY or RESEND_WORKSHOP_FROM not set in Convex env",
    };
  }
  const { to, workshopTitle, joinUrl } = params;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Webinar confirmed: ${workshopTitle}`,
      html: `<p>Your webinar registration is confirmed.</p><p><strong>${escapeHtml(workshopTitle)}</strong></p><p><a href="${joinUrl}">Join in Microsoft Teams</a></p>`,
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    const isResendTestRecipientLimit =
      res.status === 403 &&
      (body.includes("only send testing") ||
        body.includes("validation_error"));
    if (isResendTestRecipientLimit) {
      console.warn(
        "[Resend] webinar confirmation not sent (test key / unverified domain):",
        res.status,
        body.slice(0, 400),
      );
    } else {
      console.error("[Resend] webinar confirmation failed:", res.status, body);
    }
    return { outcome: "failed", status: res.status, body: body.slice(0, 500) };
  }
  return { outcome: "sent", status: res.status };
}

export const addGraphAttendeeForWorkshopRegistration = internalAction({
  args: {
    sessionId: v.id("workshopSessions"),
    userId: v.id("users"),
    attempt: v.optional(v.number()),
  },
  handler: async (ctx, { sessionId, userId, attempt: attemptArg }) => {
    const attempt = attemptArg ?? 0;
    const row = await ctx.runQuery(
      internal.workshopMicrosoftTeams.getTeamsSessionForAttendeeSync,
      { sessionId },
    );
    if (isWorkshopGraphSyncDisabled()) {
      const simAttendeeOk =
        isWorkshopTeamsSimulationEnabled() &&
        row != null &&
        row.teamsGraphEventId != null &&
        isSimulatedTeamsGraphEventId(row.teamsGraphEventId);
      if (!simAttendeeOk) {
        await ctx.runMutation(
          internal.workshopMicrosoftTeams.appendWorkshopSyncLogInternal,
          {
            sessionId,
            source: "system",
            level: "warn",
            message: `addGraphAttendeeForWorkshopRegistration skipped: WORKSHOP_GRAPH_DISABLED (userId=${userId}).`,
          },
        );
        return { skipped: true as const, reason: "graph_disabled" as const };
      }
    }
    if (!row) {
      return { skipped: true as const };
    }
    if (!row.teamsGraphEventId || !row.teamsOrganizerId) {
      if (attempt >= 20) {
        await ctx.runMutation(
          internal.workshopMicrosoftTeams.appendWorkshopSyncLogInternal,
          {
            sessionId,
            source: "system",
            level: "error",
            message: `addGraphAttendee abandoned after 20 waits: still no teamsGraphEventId for userId=${userId}.`,
          },
        );
        return { skipped: true as const, reason: "no_event_id" as const };
      }
      await ctx.runMutation(
        internal.workshopMicrosoftTeams.scheduleAttendeeDefer,
        { sessionId, userId, attempt: attempt + 1 },
      );
      return { deferred: true as const };
    }
    const user = await ctx.runQuery(
      internal.workshopMicrosoftTeams.getUserEmailAndNameInternal,
      { userId },
    );
    if (!user) {
      await ctx.runMutation(
        internal.workshopMicrosoftTeams.appendWorkshopSyncLogInternal,
        {
          sessionId,
          source: "system",
          level: "warn",
          message: `addGraphAttendee skipped: user ${userId} not found.`,
        },
      );
      return { skipped: true as const, reason: "no_user" as const };
    }
    if (isSimulatedTeamsGraphEventId(row.teamsGraphEventId)) {
      const joinUrl = row.externalJoinUrl ?? "";
      await ctx.runMutation(
        internal.workshopMicrosoftTeams.appendWorkshopSyncLogInternal,
        {
          sessionId,
          source: "system",
          level: "info",
          message: `WORKSHOP_TEAMS_SIMULATION: skipped Outlook/Graph for ${user.email}; optional confirmation email only.`,
        },
      );
      const unitTitle =
        (await ctx.runQuery(
          internal.workshopMicrosoftTeams.getWorkshopUnitTitleFromSession,
          { sessionId },
        )) ?? "Webinar";
      const resendResult = await sendResendWorkshopConfirmation({
        to: user.email.trim(),
        workshopTitle: unitTitle,
        joinUrl: joinUrl || row.externalJoinUrl || "",
      });
      if (resendResult.outcome === "skipped") {
        await ctx.runMutation(
          internal.workshopMicrosoftTeams.appendWorkshopSyncLogInternal,
          {
            sessionId,
            source: "resend",
            level: "info",
            message: `Resend confirmation skipped: ${resendResult.reason}`,
          },
        );
      } else if (resendResult.outcome === "sent") {
        await ctx.runMutation(
          internal.workshopMicrosoftTeams.appendWorkshopSyncLogInternal,
          {
            sessionId,
            source: "resend",
            level: "info",
            message: `Resend API accepted webinar confirmation email (HTTP ${resendResult.status}) to ${user.email}.`,
          },
        );
      } else {
        await ctx.runMutation(
          internal.workshopMicrosoftTeams.appendWorkshopSyncLogInternal,
          {
            sessionId,
            source: "resend",
            level: "warn",
            message: `Resend confirmation failed (HTTP ${resendResult.status}).`,
          },
        );
      }
      return { ok: true as const, simulated: true as const };
    }
    const joinUrl = row.externalJoinUrl ?? "";
    await ctx.runMutation(
      internal.workshopMicrosoftTeams.appendWorkshopSyncLogInternal,
      {
        sessionId,
        source: "graph",
        level: "info",
        message: `addGraphAttendee: syncing ${user.email} (userId=${userId}), attempt=${attempt}. GET event attendees…`,
      },
    );
    try {
      const env = readGraphEnv();
      const { accessToken } = await fetchGraphAccessToken({
        tenantId: env.tenantId,
        clientId: env.clientId,
        clientSecret: env.clientSecret,
      });
      const eventUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(row.teamsOrganizerId)}/events/${encodeURIComponent(row.teamsGraphEventId)}?$select=attendees`;
      const got = await graphJson<{ attendees?: unknown }>(
        accessToken,
        "GET",
        eventUrl,
      );
      if (!got.ok) {
        throw new Error(
          `Graph GET event ${got.status}: ${got.httpFailureText || got.text}`,
        );
      }
      const existing = normalizeAttendeesForPatch(got.data.attendees);
      const lower = user.email.trim().toLowerCase();
      const alreadyOnEvent = existing.some(
        (a) => a.emailAddress.address.toLowerCase() === lower,
      );
      if (!alreadyOnEvent) {
        existing.push({
          emailAddress: { address: user.email.trim(), name: user.name },
          type: "required",
        });
      }
      if (alreadyOnEvent) {
        await ctx.runMutation(
          internal.workshopMicrosoftTeams.appendWorkshopSyncLogInternal,
          {
            sessionId,
            source: "graph",
            level: "info",
            message: `${user.email} already listed on event attendees; skipping PATCH.`,
          },
        );
      } else {
        const patchUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(row.teamsOrganizerId)}/events/${encodeURIComponent(row.teamsGraphEventId)}`;
        const patched = await graphJson<unknown>(accessToken, "PATCH", patchUrl, {
          attendees: existing,
        });
        if (!patched.ok) {
          throw new Error(
            `Graph PATCH attendees ${patched.status}: ${patched.httpFailureText || patched.text}`,
          );
        }
        await ctx.runMutation(
          internal.workshopMicrosoftTeams.appendWorkshopSyncLogInternal,
          {
            sessionId,
            source: "graph",
            level: "info",
            message: `Graph PATCH attendees succeeded (HTTP ${patched.status}). Outlook should send the calendar invite.`,
          },
        );
      }
      const unitTitle =
        (await ctx.runQuery(
          internal.workshopMicrosoftTeams.getWorkshopUnitTitleFromSession,
          { sessionId },
        )) ?? "Webinar";
      const resendResult = await sendResendWorkshopConfirmation({
        to: user.email.trim(),
        workshopTitle: unitTitle,
        joinUrl: joinUrl || row.externalJoinUrl || "",
      });
      if (resendResult.outcome === "skipped") {
        await ctx.runMutation(
          internal.workshopMicrosoftTeams.appendWorkshopSyncLogInternal,
          {
            sessionId,
            source: "resend",
            level: "info",
            message: `Resend confirmation skipped: ${resendResult.reason}`,
          },
        );
      } else if (resendResult.outcome === "sent") {
        await ctx.runMutation(
          internal.workshopMicrosoftTeams.appendWorkshopSyncLogInternal,
          {
            sessionId,
            source: "resend",
            level: "info",
            message: `Resend API accepted webinar confirmation email (HTTP ${resendResult.status}) to ${user.email}.`,
          },
        );
      } else {
        await ctx.runMutation(
          internal.workshopMicrosoftTeams.appendWorkshopSyncLogInternal,
          {
            sessionId,
            source: "resend",
            level: "warn",
            message: `Resend API error HTTP ${resendResult.status}: ${resendResult.body}`,
          },
        );
      }
      return { ok: true as const };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(
        internal.workshopMicrosoftTeams.commitTeamsMeetingUpdateError,
        { sessionId, error: `addAttendee: ${msg}` },
      );
      return { ok: false as const, error: msg };
    }
  },
});
