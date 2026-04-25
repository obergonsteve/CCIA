"use client";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { formatWorkshopSessionStartForDisplay } from "@/lib/webinar-session-display-time";
import { cn } from "@/lib/utils";

/**
 * Webinar reminder `row.body` can be wrong (e.g. UTC from an earlier server format).
 * Recompute “Starts …” from the live session + shared display-time rules.
 */
export function WebinarReminderBodyParagraph({
  row,
  className,
}: {
  row: Doc<"userNotifications">;
  className?: string;
}) {
  const ref = row.linkRef;
  const sessionId =
    ref?.kind === "workshopSession" ? ref.sessionId : undefined;
  const data = useQuery(
    api.workshops.getSessionForUser,
    sessionId != null ? { sessionId } : "skip",
  );

  const fallback = row.body?.trim() ? row.body : null;

  if (row.kind !== "webinar_reminder" || sessionId == null) {
    return fallback ? <p className={className}>{fallback}</p> : null;
  }

  if (data === undefined) {
    return fallback ? (
      <p className={className}>{fallback}</p>
    ) : (
      <p className={cn(className, "text-muted-foreground")}>…</p>
    );
  }

  if (data === null) {
    return fallback ? <p className={className}>{fallback}</p> : null;
  }

  const startStr = formatWorkshopSessionStartForDisplay(
    data.session.startsAt,
    data.session.timeZone,
  );
  const text = `Starts ${startStr}. You registered for this session.`;

  return <p className={className}>{text}</p>;
}
