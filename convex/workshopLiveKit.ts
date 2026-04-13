import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import {
  liveKitParticipantIdentityFromUserId,
  liveKitRoomNameForWorkshopSession,
} from "./lib/liveKitSanitize";
import { isLive } from "./lib/softDelete";
import { userCanAccessWorkshopSession } from "./lib/workshopUnitLevels";

/**
 * Server-only gate for the LiveKit JWT action (registration + unit access + session window).
 */
export const verifyLiveKitAccessInternal = internalQuery({
  args: {
    workshopSessionId: v.id("workshopSessions"),
    userId: v.id("users"),
  },
  handler: async (ctx, { workshopSessionId, userId }) => {
    const session = await ctx.db.get(workshopSessionId);
    if (!session || session.status !== "scheduled") {
      return {
        ok: false as const,
        reason: "This session is not available for a live call.",
      };
    }
    const unit = await ctx.db.get(session.workshopUnitId);
    if (!unit || !isLive(unit) || unit.deliveryMode !== "live_workshop") {
      return { ok: false as const, reason: "Invalid workshop unit." };
    }
    const canAccess = await userCanAccessWorkshopSession(
      ctx,
      session.workshopUnitId,
    );
    if (!canAccess) {
      return {
        ok: false as const,
        reason: "You do not have access to this workshop.",
      };
    }
    const reg = await ctx.db
      .query("workshopRegistrations")
      .withIndex("by_session_and_user", (q) =>
        q.eq("sessionId", workshopSessionId).eq("userId", userId),
      )
      .unique();
    if (!reg) {
      return {
        ok: false as const,
        reason: "Register for a session on this unit to join the live room.",
      };
    }
    const now = Date.now();
    if (session.endsAt < now) {
      return {
        ok: false as const,
        reason: "This workshop session has ended.",
      };
    }
    const user = await ctx.db.get(userId);
    const participantName = (user?.name ?? "Guest").trim() || "Guest";
    const roomName = liveKitRoomNameForWorkshopSession(String(workshopSessionId));
    const participantIdentity = liveKitParticipantIdentityFromUserId(
      String(userId),
    );
    return {
      ok: true as const,
      roomName,
      participantIdentity,
      participantName,
    };
  },
});
