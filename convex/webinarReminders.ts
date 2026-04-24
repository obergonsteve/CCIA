/**
 * In-app “webinar reminder” post-its. Uses `userNotifications` dedupe keys
 * so each session fires at most once per user; call from cron and after registration.
 */
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import { tryCreateOrSkip } from "./userNotifications";

const DEFAULT_HOURS = 24;
const MIN_HOURS = 1;
const MAX_HOURS = 30 * 24;

function leadTimeMsFromUserHours(h: number | undefined): number {
  const n = h == null ? DEFAULT_HOURS : h;
  const c = Math.min(MAX_HOURS, Math.max(MIN_HOURS, Math.round(n)));
  return c * 60 * 60 * 1000;
}

async function tryEnqueueWebinarReminderIfDue(
  ctx: MutationCtx,
  now: number,
  session: Doc<"workshopSessions">,
  reg: Doc<"workshopRegistrations">,
): Promise<
  | "created"
  | "skipped_active"
  | "skipped_dismissed"
  | "not_due"
  | "no_user"
> {
  if (session.status !== "scheduled") {
    return "not_due";
  }
  if (now >= session.startsAt) {
    return "not_due";
  }
  const u = await ctx.db.get(reg.userId);
  if (u == null) {
    return "no_user";
  }
  const lead = leadTimeMsFromUserHours(u.webinarReminderHoursBefore);
  const notBefore = session.startsAt - lead;
  const from = Math.max(reg.registeredAt, notBefore);
  if (now < from || now >= session.startsAt) {
    return "not_due";
  }

  const wu = await ctx.db.get(session.workshopUnitId);
  const titleName =
    (session.titleOverride && session.titleOverride.trim()) ||
    wu?.title ||
    "Webinar";
  const title = `Webinar: ${titleName}`.trim();
  const startStr = new Date(session.startsAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const body = `Starts ${startStr}. You registered for this session.`;
  const dedupeKey = `webinar_reminder:${String(session._id)}`;

  const res = await tryCreateOrSkip(ctx, {
    userId: reg.userId,
    kind: "webinar_reminder",
    title,
    body,
    linkRef: { kind: "workshopSession", sessionId: session._id },
    importance: "normal",
    dedupeKey,
  });
  if (res.status === "created") {
    return "created";
  }
  if (res.status === "skipped_active") {
    return "skipped_active";
  }
  return "skipped_dismissed";
}

/**
 * After a new `workshopRegistrations` row is committed, schedules immediately so we
 * don’t miss the pre-start window when the periodic cron is coarser than that window
 * (e.g. 10-minute cron vs a 5-minute window after late registration).
 */
export const ensureDueReminderForUserSession = internalMutation({
  args: {
    sessionId: v.id("workshopSessions"),
    userId: v.id("users"),
  },
  handler: async (ctx, { sessionId, userId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) {
      return { outcome: "no_session" as const };
    }
    const reg = await ctx.db
      .query("workshopRegistrations")
      .withIndex("by_session_and_user", (q) =>
        q.eq("sessionId", sessionId).eq("userId", userId),
      )
      .unique();
    if (!reg) {
      return { outcome: "no_registration" as const };
    }
    const r = await tryEnqueueWebinarReminderIfDue(
      ctx,
      Date.now(),
      session,
      reg,
    );
    return { outcome: r };
  },
});

/**
 * For each registered learner on upcoming scheduled sessions, enqueues
 * a `webinar_reminder` when the user’s pre-start window has been reached
 * and they had registered before the ideal send time (or register late:
 * we send on the first tick after the window is reached post-registration).
 */
export const runDue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const maxLead = MAX_HOURS * 60 * 60 * 1000;
    const maxStart = now + maxLead;

    const inHorizon = await ctx.db
      .query("workshopSessions")
      .withIndex("by_starts_at", (q) =>
        q.gt("startsAt", now).lte("startsAt", maxStart),
      )
      .collect();

    const sessions = inHorizon.filter((s) => s.status === "scheduled");
    let created = 0;
    let skippedActive = 0;
    let skippedDismissed = 0;
    let noOp = 0;

    for (const session of sessions) {
      const regs = await ctx.db
        .query("workshopRegistrations")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();

      for (const reg of regs) {
        const r = await tryEnqueueWebinarReminderIfDue(ctx, now, session, reg);
        if (r === "created") {
          created += 1;
        } else if (r === "skipped_active") {
          skippedActive += 1;
        } else if (r === "skipped_dismissed") {
          skippedDismissed += 1;
        } else {
          noOp += 1;
        }
      }
    }
    return {
      sessions: sessions.length,
      created,
      skippedActive,
      skippedDismissed,
      noOp,
    };
  },
});
