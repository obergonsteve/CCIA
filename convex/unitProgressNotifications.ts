import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { isLive } from "./lib/softDelete";
import { webinarizeForLiveWorkshopUnit } from "./lib/webinarDisplayText";
import { tryCreateOrSkip } from "./userNotifications";

type NudgeLinkRef = NonNullable<Doc<"userNotifications">["linkRef"]>;

function pct(total: number, completed: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((completed / total) * 100);
}

function clampAlmostTherePct(n: number | undefined): number {
  const d = n ?? 80;
  return Math.min(99, Math.max(50, Math.round(d)));
}

/**
 * When unit step completion crosses the user’s “Almost there!” threshold (first time
 * in that unit), enqueue an in-app `unit_progress_nudge` (deduped per unit).
 */
export async function maybeEnqueueUnitAlmostThereNudge(
  ctx: MutationCtx,
  userId: Id<"users">,
  unitId: Id<"units">,
  before: { total: number; completed: number },
  after: { total: number; completed: number },
  linkRef: NudgeLinkRef,
): Promise<void> {
  if (after.total <= 0) {
    return;
  }
  const user = await ctx.db.get(userId);
  if (!user) {
    return;
  }
  const threshold = clampAlmostTherePct(user.unitAlmostTherePercent);
  const beforePct = pct(before.total, before.completed);
  const afterPct = pct(after.total, after.completed);
  if (beforePct >= threshold || afterPct < threshold) {
    return;
  }

  const unit = await ctx.db.get(unitId);
  if (!unit || !isLive(unit)) {
    return;
  }

  const label = webinarizeForLiveWorkshopUnit(unit.title, unit.deliveryMode);
  await tryCreateOrSkip(ctx, {
    userId,
    kind: "unit_progress_nudge",
    title: "Almost there!",
    body: `You’re about ${afterPct}% through “${label}”. Keep going.`,
    linkRef,
    importance: "normal",
    dedupeKey: `unit_almost_there:${String(unitId)}`,
  });
}
