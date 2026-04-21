import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

const MAX_MSG = 3500;

export type WorkshopSyncLogSource = "graph" | "resend" | "system";
export type WorkshopSyncLogLevel = "info" | "warn" | "error";

export async function insertWorkshopSyncLog(
  ctx: MutationCtx,
  args: {
    sessionId: Id<"workshopSessions">;
    source: WorkshopSyncLogSource;
    level: WorkshopSyncLogLevel;
    message: string;
  },
): Promise<void> {
  await ctx.db.insert("workshopSessionSyncLogs", {
    sessionId: args.sessionId,
    at: Date.now(),
    source: args.source,
    level: args.level,
    message: args.message.slice(0, MAX_MSG),
  });
}
