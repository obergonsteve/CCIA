"use client";

import { WorkshopLivePanel } from "@/components/grithub-live-port/workshop-live-panel";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  liveWorkshopSessionStatus,
  liveWorkshopStatusBadgeClass,
} from "@/lib/workshopSessionLiveStatus";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { ChevronDown, MonitorPlay } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Collapsible LiveKit webinar shell (header + {@link WorkshopLivePanel}).
 * Used on the learner unit page and on the Teams-simulation join page.
 */
export function LiveWorkshopRoomPanel({
  unitId,
  workshopSessionId,
  defaultOpen,
  bodyDomId = "unit-live-workshop-room-panel",
}: {
  unitId: Id<"units">;
  workshopSessionId?: Id<"workshopSessions">;
  /** When omitted, the room starts expanded so learners see join / session controls immediately. */
  defaultOpen?: boolean;
  /** Stable `id` for the collapsible region (must be unique per page if several panels mount). */
  bodyDomId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);

  const sessionRow = useQuery(api.workshops.myRegisteredSessionForLiveWorkshopUnit, {
    workshopUnitId: unitId,
    ...(workshopSessionId != null ? { workshopSessionId } : {}),
  });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const session = sessionRow?.session;
  const headerStatus =
    session != null ? liveWorkshopSessionStatus(session, now) : null;

  return (
    <section
      className={cn(
        "rounded-xl border border-purple-500/35 bg-purple-500/[0.13] text-sm shadow-sm ring-1 ring-foreground/10 dark:border-purple-400/30 dark:bg-purple-500/[0.16]",
      )}
      aria-label="Webinar room"
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-xl bg-purple-500/[0.11] px-4 py-3 text-left outline-none transition-colors hover:bg-purple-500/[0.17] focus-visible:ring-2 focus-visible:ring-purple-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-purple-500/[0.14] dark:hover:bg-purple-500/[0.22]"
        aria-expanded={open}
        aria-controls={bodyDomId}
        aria-label={
          headerStatus != null
            ? `Webinar — ${headerStatus.label}`
            : "Webinar"
        }
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex min-w-0 shrink-0 items-center gap-2">
          <MonitorPlay
            className="h-5 w-5 shrink-0 text-purple-600 dark:text-purple-400"
            aria-hidden
          />
          <span className="font-heading font-semibold text-foreground">
            Webinar
          </span>
        </span>
        <span className="flex min-w-0 flex-1 justify-end">
          {headerStatus != null ? (
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 px-2 py-0 text-[10px] font-bold uppercase tracking-wide",
                liveWorkshopStatusBadgeClass(headerStatus.tone, "purple"),
              )}
            >
              {headerStatus.label}
            </Badge>
          ) : sessionRow === null ? (
            <span className="text-xs text-muted-foreground">No session</span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <div
        id={bodyDomId}
        hidden={!open}
        className="space-y-2 border-t border-purple-500/30 px-4 py-4 dark:border-purple-400/22"
      >
        <WorkshopLivePanel
          workshopUnitId={unitId}
          workshopSessionId={workshopSessionId}
          panelExpanded={open}
        />
      </div>
    </section>
  );
}
