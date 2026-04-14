"use node";

/**
 * LiveKit JWT signing. Convex deployment env (same names as GritHub):
 * LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL (wss://…, same project as the keys).
 */
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  liveKitRoomServiceHttpUrl,
  normalizeLiveKitServerUrl,
  trimEnvValue,
} from "./lib/liveKitSanitize";

export const getWorkshopLiveKitToken = action({
  args: { workshopSessionId: v.id("workshopSessions") },
  handler: async (
    ctx,
    { workshopSessionId },
  ): Promise<
    | { token: string; serverUrl: string; roomName: string }
    | { error: string }
  > => {
    const userId = await ctx.runQuery(
      internal.users.resolveDeploymentUserIdInternal,
      {},
    );
    const gate = await ctx.runQuery(
      internal.workshopLiveKit.verifyLiveKitAccessInternal,
      { workshopSessionId, userId },
    );
    if (!gate.ok) {
      return { error: gate.reason };
    }

    const apiKey = trimEnvValue(process.env.LIVEKIT_API_KEY);
    const apiSecret = trimEnvValue(process.env.LIVEKIT_API_SECRET);
    const rawUrlTrimmed = trimEnvValue(process.env.LIVEKIT_URL);
    if (!apiKey || !apiSecret) {
      return {
        error:
          "LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set in Convex environment variables.",
      };
    }
    if (!rawUrlTrimmed) {
      return {
        error:
          "Set LIVEKIT_URL in Convex to your project WebSocket URL (same LiveKit project as the API key), e.g. wss://your-subdomain.livekit.cloud — from LiveKit Cloud → Settings.",
      };
    }
    const serverUrl = normalizeLiveKitServerUrl(rawUrlTrimmed);

    const [{ AccessToken }, { TrackSource }] = await Promise.all([
      import("livekit-server-sdk"),
      import("@livekit/protocol"),
    ]);
    const at = new AccessToken(apiKey, apiSecret, {
      identity: gate.participantIdentity,
      name: gate.participantName,
    });
    at.addGrant({
      roomJoin: true,
      room: gate.roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishSources: [
        TrackSource.CAMERA,
        TrackSource.MICROPHONE,
        TrackSource.SCREEN_SHARE,
        TrackSource.SCREEN_SHARE_AUDIO,
      ],
    });
    const token = await at.toJwt();
    return { token, serverUrl, roomName: gate.roomName };
  },
});

/**
 * Host (admin / content creator): deletes the LiveKit room (disconnects everyone),
 * then clears `liveRoomOpenedAt` so learners see “waiting for host” until start again.
 */
export const endWorkshopLiveKitRoomForEveryone = action({
  args: { workshopSessionId: v.id("workshopSessions") },
  handler: async (
    ctx,
    { workshopSessionId },
  ): Promise<{ ok: true } | { error: string }> => {
    const userId = await ctx.runQuery(
      internal.users.resolveDeploymentUserIdInternal,
      {},
    );
    const gate = await ctx.runQuery(
      internal.workshopLiveKit.verifyWorkshopLiveKitHostEndRoomInternal,
      { workshopSessionId, userId },
    );
    if (!gate.ok) {
      return { error: gate.reason };
    }

    const apiKey = trimEnvValue(process.env.LIVEKIT_API_KEY);
    const apiSecret = trimEnvValue(process.env.LIVEKIT_API_SECRET);
    const rawUrlTrimmed = trimEnvValue(process.env.LIVEKIT_URL);
    if (!apiKey || !apiSecret) {
      return {
        error:
          "LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set in Convex environment variables.",
      };
    }
    if (!rawUrlTrimmed) {
      return {
        error:
          "Set LIVEKIT_URL in Convex to your project WebSocket URL (same LiveKit project as the API key).",
      };
    }

    const { RoomServiceClient } = await import("livekit-server-sdk");
    const httpHost = liveKitRoomServiceHttpUrl(rawUrlTrimmed);
    const roomService = new RoomServiceClient(httpHost, apiKey, apiSecret);
    try {
      await roomService.deleteRoom(gate.roomName);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[endWorkshopLiveKitRoomForEveryone] deleteRoom:", msg);
      return {
        error: `Could not end the call on the server: ${msg}`,
      };
    }

    await ctx.runMutation(internal.workshops.closeWorkshopLiveRoomInternal, {
      workshopSessionId,
    });
    return { ok: true };
  },
});
