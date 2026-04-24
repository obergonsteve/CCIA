/**
 * In-app “webinar reminder” post-its. Uses `userNotifications` dedupe keys
 * so each session fires at most once per user; call from cron.
 */
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

const DEFAULT_HOURS = 24;
const MIN_HOURS = 1;
const MAX_HOURS = 30 * 24;

function leadTimeMsFromUserHours(h: number | undefined): number {
  const n = h == null ? DEFAULT_HOURS : h;
  const c = Math.min(MAX_HOURS, Math.max(MIN_HOURS, Math.round(n)));
  return c * 60 * 60 * 1000;
}

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

      const regs = await ctx.db
        .query("workshopRegistrations")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .collect();

      for (const reg of regs) {
        const u = await ctx.db.get(reg.userId);
        if (u == null) {
          continue;
        }
        const lead = leadTimeMsFromUserHours(u.webinarReminderHoursBefore);
        const notBefore = session.startsAt - lead;
        const from = Math.max(reg.registeredAt, notBefore);
        if (now < from || now >= session.startsAt) {
          noOp += 1;
          continue;
        }

        const res = await ctx.runMutation(
          internal.userNotifications.createOrSkipForUser,
          {
            userId: reg.userId,
            kind: "webinar_reminder",
            title,
            body,
            linkRef: { kind: "workshopSession", sessionId: session._id },
            importance: "normal",
            dedupeKey,
          },
        );
        if (res.status === "created") {
          created += 1;
        } else if (res.status === "skipped_active") {
          skippedActive += 1;
        } else {
          skippedDismissed += 1;
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
