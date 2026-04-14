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
    const user = await ctx.db.get(userId);
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
      return {
        ok: false as const,
        reason: "Register for a session on this unit to join the live room.",
      };
    }
    if (session.liveRoomOpenedAt == null) {
      return {
        ok: false as const,
        reason: isLiveHost
          ? "Start the live session before joining the room."
          : "Waiting for the host to start this live session.",
      };
    }
    const now = Date.now();
    if (session.endsAt < now) {
      return {
        ok: false as const,
        reason: "This workshop session has ended.",
      };
    }
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

/**
 * Only admin / content_creator with unit access may tear down the LiveKit room.
 * Used by `endWorkshopLiveKitRoomForEveryone` (not for learner leave).
 */
export const verifyWorkshopLiveKitHostEndRoomInternal = internalQuery({
  args: {
    workshopSessionId: v.id("workshopSessions"),
    userId: v.id("users"),
  },
  handler: async (ctx, { workshopSessionId, userId }) => {
    const user = await ctx.db.get(userId);
    const isLiveHost =
      user != null &&
      (user.role === "admin" || user.role === "content_creator");
    if (!isLiveHost) {
      return {
        ok: false as const,
        reason: "Only a host can end the live room for everyone.",
      };
    }
    const session = await ctx.db.get(workshopSessionId);
    if (!session || session.status !== "scheduled") {
      return {
        ok: false as const,
        reason: "This session is not available.",
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
    if (session.endsAt < Date.now()) {
      return {
        ok: false as const,
        reason: "This workshop session has ended.",
      };
    }
    if (session.liveRoomOpenedAt == null) {
      return {
        ok: false as const,
        reason: "The live session is not open.",
      };
    }
    const roomName = liveKitRoomNameForWorkshopSession(String(workshopSessionId));
    return { ok: true as const, roomName };
  },
});
