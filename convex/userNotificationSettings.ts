import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const DEFAULT_WEBINAR_HOURS = 24;
const DEFAULT_ALMOST_THERE_PCT = 80;
const DEFAULT_ROADMAP_ONLY = true;

const MIN_HOURS = 1;
const MAX_HOURS = 30 * 24; // 30 days

function clampWebinarHours(h: number) {
  return Math.min(MAX_HOURS, Math.max(MIN_HOURS, Math.round(h)));
}

function clampPercent(p: number) {
  return Math.min(99, Math.max(50, Math.round(p)));
}

/**
 * User notification preferences (read by cron / internal jobs when creating
 * `userNotifications`). Browser passes `forUserId` from the session.
 */
export const get = query({
  args: { forUserId: v.id("users") },
  handler: async (ctx, { forUserId }) => {
    const u = await ctx.db.get(forUserId);
    if (!u) {
      return null;
    }
    return {
      webinarReminderHoursBefore:
        u.webinarReminderHoursBefore ?? DEFAULT_WEBINAR_HOURS,
      unitAlmostTherePercent: u.unitAlmostTherePercent ?? DEFAULT_ALMOST_THERE_PCT,
      notifyNewContentRoadmapOnly:
        u.notifyNewContentRoadmapOnly ?? DEFAULT_ROADMAP_ONLY,
    };
  },
});

export const update = mutation({
  args: {
    forUserId: v.id("users"),
    webinarReminderHoursBefore: v.number(),
    unitAlmostTherePercent: v.number(),
    notifyNewContentRoadmapOnly: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.forUserId, {
      webinarReminderHoursBefore: clampWebinarHours(
        args.webinarReminderHoursBefore,
      ),
      unitAlmostTherePercent: clampPercent(args.unitAlmostTherePercent),
      notifyNewContentRoadmapOnly: args.notifyNewContentRoadmapOnly,
    });
  },
});
