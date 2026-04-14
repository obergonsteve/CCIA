import type { Doc } from "@/convex/_generated/dataModel";
import { format } from "date-fns";

/**
 * ## What exists on `workshopSessions` (schema)
 *
 * - **`status`**: only `"scheduled"` | `"cancelled"`. There is no `"in_progress"` / `"not_started"` row value.
 * - **`startsAt` / `endsAt`**: planned window (epoch ms).
 * - **`liveRoomOpenedAt`**: optional; set when a host opens the embedded live room (LiveKit).
 * - **`whiteboardVisible`**: optional; host toggles whiteboard visibility.
 * - **`externalJoinUrl`**, **`capacity`**, **`titleOverride`**: logistics / display.
 *
 * ## What we can derive without schema changes
 *
 * | UI label (badge) | Meaning | Rule |
 * |------------------|---------|------|
 * | **Cancelled** | Session called off | `status === "cancelled"` |
 * | **Closed** | Run finished | `status === "scheduled"` && `now >= endsAt` |
 * | **In progress** (live tone) | Live room is open | `liveRoomOpenedAt != null` && `now < endsAt` (even if `now < startsAt` — early open) |
 * | **Not started** | Before calendar start, room not open yet | `now < startsAt` && `liveRoomOpenedAt == null` |
 * | **In progress** (waiting tone) | Inside calendar window, room not open | `startsAt <= now < endsAt` && `liveRoomOpenedAt == null` |
 *
 * **Capacity / “full”** is not on the session row alone — it comes from `workshopRegistrations` count vs `capacity` (see workshops browse queries).
 */

export type LiveWorkshopSessionTimes = Pick<
  Doc<"workshopSessions">,
  "startsAt" | "endsAt" | "status" | "liveRoomOpenedAt"
>;

export type LiveWorkshopStatusTone =
  | "neutral"
  | "waiting"
  | "live"
  | "ended";

export function liveWorkshopSessionStatus(
  session: LiveWorkshopSessionTimes,
  now: number,
): {
  label: string;
  detail?: string;
  tone: LiveWorkshopStatusTone;
} {
  if (session.status === "cancelled") {
    return { label: "Cancelled", tone: "ended" };
  }
  if (now >= session.endsAt) {
    return { label: "Closed", tone: "ended" };
  }
  // Live room open wins over "before startsAt" so host early-open does not show "Not started".
  if (session.liveRoomOpenedAt != null) {
    const detail =
      now < session.startsAt
        ? `Room open · scheduled start ${format(new Date(session.startsAt), "dd/MM/yyyy, HH:mm")}`
        : `Room opened ${format(new Date(session.liveRoomOpenedAt), "dd/MM/yyyy, HH:mm")}`;
    return { label: "In progress", detail, tone: "live" };
  }
  if (now < session.startsAt) {
    return { label: "Not started", tone: "neutral" };
  }
  return {
    label: "In progress",
    detail: "Live room not open yet",
    tone: "waiting",
  };
}

export function liveWorkshopStatusBadgeClass(
  tone: LiveWorkshopStatusTone,
  neutralAccent: "purple" | "sky" = "purple",
): string {
  switch (tone) {
    case "live":
      return "border-emerald-600/45 bg-emerald-600/12 text-emerald-950 dark:border-emerald-400/50 dark:bg-emerald-500/15 dark:text-emerald-50";
    case "waiting":
      return "border-amber-600/40 bg-amber-500/12 text-amber-950 dark:border-amber-400/45 dark:bg-amber-500/14 dark:text-amber-50";
    case "ended":
      return "border-border/70 bg-muted/90 text-muted-foreground dark:bg-muted/50";
    default:
      if (neutralAccent === "sky") {
        return "border-sky-500/45 bg-sky-500/12 text-sky-950 dark:border-sky-400/50 dark:bg-sky-500/16 dark:text-sky-50";
      }
      return "border-purple-500/40 bg-purple-500/10 text-purple-900 dark:border-purple-400/45 dark:bg-purple-500/15 dark:text-purple-100";
  }
}
