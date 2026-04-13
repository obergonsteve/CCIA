"use node";

/**
 * LiveKit JWT signing. Convex deployment env (same names as GritHub):
 * LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL (wss://…, same project as the keys).
 */
import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import {
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

    const { AccessToken } = await import("livekit-server-sdk");
    const at = new AccessToken(apiKey, apiSecret, {
      identity: gate.participantIdentity,
      name: gate.participantName,
    });
    at.addGrant({
      roomJoin: true,
      room: gate.roomName,
      canPublish: true,
      canSubscribe: true,
    });
    const token = await at.toJwt();
    return { token, serverUrl, roomName: gate.roomName };
  },
});
