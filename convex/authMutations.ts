import type { Doc } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { requireUserId } from "./lib/auth";

/** §4 — logout: server-side session acknowledgment (JWT cleared by Next.js). */
export const logout = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    return { ok: true as const };
  },
});

/** §4 — refresh: confirms the current Convex identity is still valid (caller re-issues JWT). */
export const refresh = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    const user = (await ctx.db.get(userId)) as Doc<"users"> | null;
    if (!user) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(userId, { lastLogin: Date.now() });
    return {
      userId: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    };
  },
});
