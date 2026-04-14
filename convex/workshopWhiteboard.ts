import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { userCanAccessWorkshopSession } from "./lib/workshopUnitLevels";

/** Must match `WorkshopShapeKind` in `workshop-whiteboard-shape-kinds.ts` (ccia-landlease). */
const WORKSHOP_SHAPE_IDS = new Set([
  "circle",
  "oval",
  "square",
  "rectangle",
  "triangle",
  "hexagon",
  "pentagon",
  "trapezoid",
  "line",
  "arrowUp",
  "arrowDown",
  "arrowLeft",
  "arrowRight",
  "polyline",
  "polygon",
]);

function isNorm01(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
}

function validateStrokePayload(d: unknown): boolean {
  if (!d || typeof d !== "object") return false;
  const o = d as { v?: unknown; t?: unknown };
  if (o.v !== 1 || typeof o.t !== "string") return false;
  if (o.t === "L") {
    const L = d as Record<string, unknown>;
    return (
      [L.x0, L.y0, L.x1, L.y1, L.w].every(
        (n) => typeof n === "number" && Number.isFinite(n as number),
      ) &&
      typeof L.c === "string" &&
      (L.c as string).length < 40 &&
      (L.er === true || (L.c as string).length > 0)
    );
  }
  if (o.t === "TXT") {
    const T = d as Record<string, unknown>;
    const text = T.text;
    return (
      typeof T.x === "number" &&
      typeof T.y === "number" &&
      typeof text === "string" &&
      text.length > 0 &&
      text.length < 2000 &&
      typeof T.fz === "number" &&
      typeof T.c === "string"
    );
  }
  if (o.t === "E") {
    const E = d as Record<string, unknown>;
    return (
      typeof E.x === "number" &&
      typeof E.y === "number" &&
      typeof E.e === "string" &&
      (E.e as string).length > 0 &&
      (E.e as string).length < 16 &&
      typeof E.c === "string"
    );
  }
  if (o.t === "S") {
    const S = d as Record<string, unknown>;
    if (typeof S.shape !== "string" || !WORKSHOP_SHAPE_IDS.has(S.shape)) {
      return false;
    }
    if (
      !isNorm01(S.x) ||
      !isNorm01(S.y) ||
      typeof S.w !== "number" ||
      !Number.isFinite(S.w) ||
      S.w <= 0 ||
      S.w > 0.05 ||
      typeof S.c !== "string" ||
      (S.c as string).length === 0 ||
      (S.c as string).length >= 40
    ) {
      return false;
    }
    if (S.shape === "line") {
      return isNorm01(S.x2) && isNorm01(S.y2);
    }
    if (S.shape === "polyline" || S.shape === "polygon") {
      if (!Array.isArray(S.pts)) return false;
      if (S.pts.length < 2 || S.pts.length > 80) return false;
      for (const p of S.pts) {
        if (!p || typeof p !== "object") return false;
        const pt = p as Record<string, unknown>;
        if (!isNorm01(pt.x) || !isNorm01(pt.y)) return false;
      }
      return true;
    }
    if (S.sc !== undefined) {
      if (
        typeof S.sc !== "number" ||
        !Number.isFinite(S.sc) ||
        S.sc <= 0 ||
        S.sc > 24
      ) {
        return false;
      }
    }
    return true;
  }
  return false;
}

async function assertLiveWorkshopGate(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  workshopSessionId: Id<"workshopSessions">,
): Promise<void> {
  const gate = await ctx.runQuery(
    internal.workshopLiveKit.verifyLiveKitAccessInternal,
    { workshopSessionId, userId },
  );
  if (!gate.ok) {
    throw new Error(gate.reason);
  }
}

export const listWorkshopWhiteboardStrokes = query({
  args: { workshopSessionId: v.id("workshopSessions") },
  handler: async (ctx, { workshopSessionId }) => {
    const userId = await requireUserId(ctx);
    try {
      await assertLiveWorkshopGate(ctx, userId, workshopSessionId);
    } catch {
      return [];
    }
    const session = await ctx.db.get(workshopSessionId);
    if (!session || session.whiteboardVisible === false) {
      return [];
    }
    const rows = await ctx.db
      .query("workshopSessionWhiteboardStrokes")
      .withIndex("by_workshop_session", (q) =>
        q.eq("workshopSessionId", workshopSessionId),
      )
      .collect();
    rows.sort((a, b) => a.createdAt - b.createdAt);
    return rows.map((r) => ({
      _id: r._id,
      userId: r.userId,
      strokeData: r.strokeData,
      createdAt: r.createdAt,
    }));
  },
});

export const addWorkshopWhiteboardStroke = mutation({
  args: {
    workshopSessionId: v.id("workshopSessions"),
    strokeData: v.any(),
  },
  handler: async (ctx, { workshopSessionId, strokeData }) => {
    const userId = await requireUserId(ctx);
    await assertLiveWorkshopGate(ctx, userId, workshopSessionId);
    const session = await ctx.db.get(workshopSessionId);
    if (!session || session.whiteboardVisible === false) {
      throw new Error("The whiteboard is hidden by the host.");
    }
    if (!validateStrokePayload(strokeData)) {
      throw new Error("Invalid stroke data.");
    }
    await ctx.db.insert("workshopSessionWhiteboardStrokes", {
      workshopSessionId,
      userId,
      strokeData,
      createdAt: Date.now(),
    });
    return { ok: true as const };
  },
});

/**
 * Insert many line segments in one round-trip (one pointer gesture).
 * Avoids per-segment mutations which cause heavy client lag.
 */
export const addWorkshopWhiteboardStrokesBatch = mutation({
  args: {
    workshopSessionId: v.id("workshopSessions"),
    strokes: v.array(v.any()),
  },
  handler: async (ctx, { workshopSessionId, strokes }) => {
    const userId = await requireUserId(ctx);
    await assertLiveWorkshopGate(ctx, userId, workshopSessionId);
    const session = await ctx.db.get(workshopSessionId);
    if (!session || session.whiteboardVisible === false) {
      throw new Error("The whiteboard is hidden by the host.");
    }
    if (strokes.length === 0) {
      return { inserted: 0 as const };
    }
    if (strokes.length > 2000) {
      throw new Error("Too many line segments in one batch.");
    }
    let createdAt = Date.now();
    for (const strokeData of strokes) {
      if (!validateStrokePayload(strokeData)) {
        throw new Error("Invalid stroke data in batch.");
      }
      const t = (strokeData as { t?: unknown }).t;
      if (t !== "L") {
        throw new Error("Batch accepts ink line segments only.");
      }
      await ctx.db.insert("workshopSessionWhiteboardStrokes", {
        workshopSessionId,
        userId,
        strokeData,
        createdAt: createdAt++,
      });
    }
    return { inserted: strokes.length };
  },
});

/** Host: remove all whiteboard strokes for this session (same room as “clear for everyone”). */
export const clearWorkshopWhiteboardStrokes = mutation({
  args: { workshopSessionId: v.id("workshopSessions") },
  handler: async (ctx, { workshopSessionId }) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("Unauthorized");
    }
    if (user.role !== "admin" && user.role !== "content_creator") {
      throw new Error("Only a host can clear the whiteboard for everyone.");
    }
    await assertLiveWorkshopGate(ctx, userId, workshopSessionId);
    const session = await ctx.db.get(workshopSessionId);
    if (!session || session.status !== "scheduled") {
      throw new Error("Session is not available.");
    }
    const ok = await userCanAccessWorkshopSession(ctx, session.workshopUnitId);
    if (!ok) {
      throw new Error("Forbidden");
    }
    if (session.endsAt < Date.now()) {
      throw new Error("This workshop session has ended.");
    }
    if (session.liveRoomOpenedAt == null) {
      throw new Error("Start the live session first.");
    }
    const strokes = await ctx.db
      .query("workshopSessionWhiteboardStrokes")
      .withIndex("by_workshop_session", (q) =>
        q.eq("workshopSessionId", workshopSessionId),
      )
      .collect();
    for (const row of strokes) {
      await ctx.db.delete(row._id);
    }
    return { deleted: strokes.length };
  },
});

/** Remove the caller’s most recent whiteboard stroke (undo one step). */
export const undoMyLastWorkshopWhiteboardStroke = mutation({
  args: { workshopSessionId: v.id("workshopSessions") },
  handler: async (ctx, { workshopSessionId }) => {
    const userId = await requireUserId(ctx);
    await assertLiveWorkshopGate(ctx, userId, workshopSessionId);
    const session = await ctx.db.get(workshopSessionId);
    if (!session || session.whiteboardVisible === false) {
      throw new Error("The whiteboard is hidden by the host.");
    }
    const strokes = await ctx.db
      .query("workshopSessionWhiteboardStrokes")
      .withIndex("by_workshop_session", (q) =>
        q.eq("workshopSessionId", workshopSessionId),
      )
      .collect();
    const mine = strokes
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
    const last = mine[0];
    if (!last) return { removed: 0 as const };
    await ctx.db.delete(last._id);
    return { removed: 1 as const };
  },
});

/** Remove all strokes drawn by the caller (clear my ink only). */
export const clearMyWorkshopWhiteboardStrokes = mutation({
  args: { workshopSessionId: v.id("workshopSessions") },
  handler: async (ctx, { workshopSessionId }) => {
    const userId = await requireUserId(ctx);
    await assertLiveWorkshopGate(ctx, userId, workshopSessionId);
    const session = await ctx.db.get(workshopSessionId);
    if (!session || session.whiteboardVisible === false) {
      throw new Error("The whiteboard is hidden by the host.");
    }
    const strokes = await ctx.db
      .query("workshopSessionWhiteboardStrokes")
      .withIndex("by_workshop_session", (q) =>
        q.eq("workshopSessionId", workshopSessionId),
      )
      .collect();
    let n = 0;
    for (const row of strokes) {
      if (row.userId === userId) {
        await ctx.db.delete(row._id);
        n++;
      }
    }
    return { deleted: n };
  },
});
