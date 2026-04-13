import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { isLive } from "./lib/softDelete";
import { userCanAccessWorkshopSession } from "./lib/workshopUnitLevels";

const CHAT_COLORS = [
  "#0ea5e9",
  "#22c55e",
  "#a855f7",
  "#f97316",
  "#e11d48",
  "#14b8a6",
  "#eab308",
  "#6366f1",
];

async function assertWorkshopSessionChatAccess(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  workshopSessionId: Id<"workshopSessions">,
): Promise<void> {
  const session = await ctx.db.get(workshopSessionId);
  if (!session || session.status !== "scheduled") {
    throw new Error("Session not available.");
  }
  const unit = await ctx.db.get(session.workshopUnitId);
  if (!unit || !isLive(unit) || unit.deliveryMode !== "live_workshop") {
    throw new Error("Invalid workshop.");
  }
  const canAccess = await userCanAccessWorkshopSession(
    ctx,
    session.workshopUnitId,
  );
  if (!canAccess) {
    throw new Error("Forbidden");
  }
  const reg = await ctx.db
    .query("workshopRegistrations")
    .withIndex("by_session_and_user", (q) =>
      q.eq("sessionId", workshopSessionId).eq("userId", userId),
    )
    .unique();
  if (!reg) {
    throw new Error("Register for this session to use chat.");
  }
}

export const listWorkshopSessionChatMessages = query({
  args: { workshopSessionId: v.id("workshopSessions") },
  handler: async (ctx, { workshopSessionId }) => {
    const userId = await requireUserId(ctx);
    try {
      await assertWorkshopSessionChatAccess(ctx, userId, workshopSessionId);
    } catch {
      return [];
    }

    const messages = (
      await ctx.db
        .query("workshopSessionChatMessages")
        .withIndex("by_workshop_session", (q) =>
          q.eq("workshopSessionId", workshopSessionId),
        )
        .collect()
    ).sort((a, b) => a.createdAt - b.createdAt);

    const regs = await ctx.db
      .query("workshopRegistrations")
      .withIndex("by_session", (q) => q.eq("sessionId", workshopSessionId))
      .collect();
    const memberIds = [...new Set(regs.map((r) => r.userId))].sort();
    const userColorByUserId: Record<string, string> = {};
    memberIds.forEach((uid, i) => {
      userColorByUserId[uid] = CHAT_COLORS[i % CHAT_COLORS.length]!;
    });

    const authorIds = [...new Set(messages.map((m) => m.userId))];
    const nameByUserId = new Map<string, string>();
    for (const uid of authorIds) {
      const u = await ctx.db.get(uid);
      const name = (u?.name ?? "Unknown").trim() || "Unknown";
      nameByUserId.set(uid, name);
    }

    return messages.map((m) => ({
      _id: m._id,
      userId: m.userId,
      text: m.text,
      createdAt: m.createdAt,
      name: nameByUserId.get(m.userId) ?? "Unknown",
      color: userColorByUserId[m.userId] ?? CHAT_COLORS[0]!,
    }));
  },
});

export const sendWorkshopSessionChatMessage = mutation({
  args: {
    workshopSessionId: v.id("workshopSessions"),
    text: v.string(),
  },
  handler: async (ctx, { workshopSessionId, text }) => {
    const userId = await requireUserId(ctx);
    await assertWorkshopSessionChatAccess(ctx, userId, workshopSessionId);
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error("Message cannot be empty.");
    }
    await ctx.db.insert("workshopSessionChatMessages", {
      workshopSessionId,
      userId,
      text: trimmed,
      createdAt: Date.now(),
    });
  },
});
