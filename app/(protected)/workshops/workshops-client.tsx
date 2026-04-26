"use client";

import { api } from "@/convex/_generated/api";
import type { WorkshopBrowseRow } from "@/convex/workshops";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  liveWorkshopSessionStatus,
  liveWorkshopStatusBadgeClass,
  type LiveWorkshopSessionTimes,
} from "@/lib/workshopSessionLiveStatus";
import { WorkshopSyncTracePanel } from "@/components/workshop-sync-trace-panel";
import { cn } from "@/lib/utils";
import {
  isMicrosoftTeamsSession,
  workshopJoinHrefForLink,
} from "@/lib/workshopConference";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, ExternalLink, MessageSquare, Video } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
} from "react";
import { toast } from "sonner";

/** Weekday + date (dd/MM/yyyy) + times. Same calendar day → one date line, two times. */
function formatWorkshopSessionRange(startMs: number, endMs: number): string {
  const start = new Date(startMs);
  const end = new Date(endMs);
  const startTime = format(start, "HH:mm");
  const endTime = format(end, "HH:mm");
  if (isSameDay(start, end)) {
    return `${format(start, "EEE dd/MM/yyyy")}, ${startTime} — ${endTime}`;
  }
  return `${format(start, "EEE dd/MM/yyyy")}, ${startTime} — ${format(end, "EEE dd/MM/yyyy")}, ${endTime}`;
}

/** Tight padding — applied to every session tile (registered, not registered, closed). */
const WORKSHOP_SESSION_TILE_CARD = "!gap-1.5 !py-1.5";
const WORKSHOP_SESSION_TILE_HEADER = "!py-1";
const WORKSHOP_SESSION_TILE_CONTENT = "flex flex-wrap gap-2 !pt-0 !pb-1";

/**
 * Webinar cards / shells use the same 3-stop panel gradient as
 * `CERT_LIST_TIER_SECTION` on Certifications: `from-…/ via-background/… to-…/` + `shadow-sm shadow-…/15`.
 * Open sessions = `brand-sky` (Silver tier) — not Tailwind `sky-500`.
 * Each session `Card` uses a thicker, more saturated `border-s-4` (“inline start”) accent; other sides keep the soft `border-2` frame.
 */
const WORKSHOP_SESSION_PURPLE_GRADIENT =
  "border-2 border-s-4 border-s-purple-500/95 border-t-purple-500/50 border-e-purple-500/50 border-b-purple-500/50 bg-gradient-to-br from-purple-500/[0.19] via-background/58 to-purple-500/[0.13] ring-0 shadow-sm shadow-purple-500/17 dark:border-s-purple-400/95 dark:border-t-purple-500/45 dark:border-e-purple-500/45 dark:border-b-purple-500/45 dark:from-purple-500/[0.2] dark:via-background/15 dark:to-purple-500/[0.15] dark:shadow-purple-500/13";
const WORKSHOP_SESSION_SKY_GRADIENT =
  "border-2 border-s-4 border-s-brand-sky/95 border-t-brand-sky/50 border-e-brand-sky/50 border-b-brand-sky/50 bg-gradient-to-br from-brand-sky/[0.19] via-background/58 to-brand-sky/[0.13] ring-0 shadow-sm shadow-brand-sky/17 dark:border-s-brand-sky/90 dark:border-t-brand-sky/45 dark:border-e-brand-sky/45 dark:border-b-brand-sky/45 dark:from-brand-sky/[0.2] dark:via-background/15 dark:to-brand-sky/[0.15] dark:shadow-brand-sky/13";
const WORKSHOP_SESSION_SLATE_GRADIENT =
  "border-2 border-s-4 border-s-slate-500/90 border-t-slate-500/45 border-e-slate-500/45 border-b-slate-500/45 bg-gradient-to-br from-slate-500/[0.1] via-background/48 to-slate-500/[0.07] ring-0 shadow-sm shadow-slate-400/16 dark:border-s-slate-400/90 dark:border-t-slate-500/35 dark:border-e-slate-500/35 dark:border-b-slate-500/35 dark:from-slate-500/[0.12] dark:via-background/12 dark:to-slate-500/[0.08] dark:shadow-slate-500/10";

/** List section shells — flat wash + frame only (gradients stay on session {@link Card}s). */
const WORKSHOP_SECTION_REGISTERED =
  "border-2 border-purple-500/45 bg-purple-500/[0.09] shadow-sm dark:border-purple-400/40 dark:bg-purple-500/[0.12]";
const WORKSHOP_SECTION_OPEN =
  "border-2 border-dashed border-sky-500/45 bg-sky-500/[0.09] shadow-sm dark:border-sky-400/40 dark:bg-sky-500/[0.12]";
const WORKSHOP_SECTION_CLOSED =
  "border-2 border-slate-400/35 bg-slate-500/[0.05] shadow-sm dark:border-slate-500/35 dark:bg-slate-500/[0.08]";

const WORKSHOP_FILTER_BANNER =
  "border border-purple-500/30 bg-gradient-to-br from-purple-500/[0.07] via-background/44 to-purple-500/[0.04] shadow-sm dark:border-purple-400/25 dark:from-purple-500/[0.08] dark:via-background/10 dark:to-purple-500/[0.06]";

const WEEK_STARTS_ON = 1 as const;

type WorkshopCalendarKind = "registered" | "open" | "closed";

function dayKeyFromMs(ms: number): number {
  return startOfDay(new Date(ms)).getTime();
}

function UserWorkshopsPathCalendar({
  registeredActive,
  openSessions,
  closed,
  viewMonth,
  onViewMonthChange,
  selectedDayMs,
  focusedSessionId,
  onSelectCalendarDay,
  onClearSessionFocus,
  todayClockMs,
}: {
  registeredActive: Array<{
    session: Doc<"workshopSessions">;
    workshopTitle: string;
    past: boolean;
  }>;
  openSessions: WorkshopBrowseRow[];
  closed: Array<{ session: Doc<"workshopSessions">; workshopTitle: string }>;
  viewMonth: Date;
  onViewMonthChange: (monthStart: Date) => void;
  selectedDayMs: number | null;
  focusedSessionId: Id<"workshopSessions"> | null;
  onSelectCalendarDay: (dayStartMs: number) => void;
  onClearSessionFocus: () => void;
  /** Wall-clock ms (e.g. parent `now` tick) so “today” stays correct. */
  todayClockMs: number;
}) {

  const kindsByDay = useMemo(() => {
    const map = new Map<number, Set<WorkshopCalendarKind>>();
    const add = (startsAt: number, kind: WorkshopCalendarKind) => {
      const dk = dayKeyFromMs(startsAt);
      let set = map.get(dk);
      if (!set) {
        set = new Set();
        map.set(dk, set);
      }
      set.add(kind);
    };
    for (const { session } of registeredActive) {
      add(session.startsAt, "registered");
    }
    for (const s of openSessions) {
      add(s.startsAt, "open");
    }
    for (const { session } of closed) {
      add(session.startsAt, "closed");
    }
    return map;
  }, [registeredActive, openSessions, closed]);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: WEEK_STARTS_ON });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: WEEK_STARTS_ON });
  const gridDays = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd],
  );

  const weekShort = useMemo(() => {
    const mon = startOfWeek(new Date(2024, 5, 3), {
      weekStartsOn: WEEK_STARTS_ON,
    });
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      return format(d, "EEE");
    });
  }, []);

  const hasAnyMarker =
    registeredActive.length > 0 || openSessions.length > 0 || closed.length > 0;

  const ringDayMs =
    focusedSessionId != null
      ? (() => {
          const all = [
            ...registeredActive.map((r) => r.session),
            ...openSessions,
            ...closed.map((c) => c.session),
          ];
          const hit = all.find((s) => s._id === focusedSessionId);
          return hit ? dayKeyFromMs(hit.startsAt) : selectedDayMs;
        })()
      : selectedDayMs;

  return (
    <div
      className="rounded-lg border-2 border-amber-500/35 bg-amber-500/[0.04] p-2 shadow-sm dark:border-amber-400/30 dark:bg-amber-500/[0.07]"
      role="region"
      aria-label="Webinar calendar"
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-amber-500/25 pb-2 dark:border-amber-400/20">
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-1 sm:justify-start">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            aria-label="Previous month"
            onClick={() =>
              onViewMonthChange(startOfMonth(subMonths(viewMonth, 1)))
            }
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <p className="min-w-0 flex-1 text-center text-xs font-semibold tabular-nums sm:flex-none">
            {format(viewMonth, "MMMM yyyy")}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            aria-label="Next month"
            onClick={() =>
              onViewMonthChange(startOfMonth(addMonths(viewMonth, 1)))
            }
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-7 shrink-0 px-2 text-[11px] font-semibold",
              "border-emerald-600/45 bg-emerald-500/[0.14] text-emerald-950 shadow-none",
              "hover:border-emerald-600/55 hover:bg-emerald-500/22 hover:text-emerald-950",
              "dark:border-emerald-400/50 dark:bg-emerald-500/18 dark:text-emerald-50",
              "dark:hover:border-emerald-400/60 dark:hover:bg-emerald-500/26 dark:hover:text-emerald-50",
            )}
            onClick={() => {
              const t = startOfDay(new Date(todayClockMs));
              onViewMonthChange(startOfMonth(t));
              onSelectCalendarDay(t.getTime());
              onClearSessionFocus();
            }}
          >
            Today
          </Button>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-3 shrink-0 rounded-full bg-purple-500 shadow-sm dark:bg-purple-400"
              aria-hidden
            />
            Registered
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-3 shrink-0 rounded-full bg-sky-500 shadow-sm dark:bg-sky-400"
              aria-hidden
            />
            Not registered
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-3 shrink-0 rounded-full bg-slate-500 shadow-sm dark:bg-slate-400"
              aria-hidden
            />
            Closed
          </span>
        </div>
      </div>

      {!hasAnyMarker ? (
        <p className="pt-2 text-xs text-muted-foreground">
          No webinars on your certification path to show on the calendar yet.
        </p>
      ) : null}
      <div
        className={cn(
          "grid grid-cols-7 gap-px text-center text-[10px] font-bold uppercase tracking-wide text-orange-900 dark:text-orange-400",
          hasAnyMarker ? "mt-2" : "mt-1.5",
        )}
        aria-hidden
      >
        {weekShort.map((label, i) => (
          <div key={`${i}-${label}`} className="py-0.5 leading-none">
            {label}
          </div>
        ))}
      </div>
      <div
        className="mt-0.5 grid grid-cols-7 gap-px"
        role="grid"
        aria-label="Webinar dates by month"
      >
        {gridDays.map((day) => {
          const dk = startOfDay(day).getTime();
          const kinds = kindsByDay.get(dk);
          const inMonth = isSameMonth(day, viewMonth);
          const selected = ringDayMs != null && ringDayMs === dk;
          const todayCell = isSameDay(day, new Date(todayClockMs));
          const hasWorkshops = kinds != null && kinds.size > 0;
          return (
            <div
              key={dk}
              className="flex h-9 items-center justify-center"
            >
              <button
                type="button"
                role="gridcell"
                aria-current={todayCell ? "date" : undefined}
                aria-label={
                  todayCell
                    ? `${format(day, "EEEE d MMMM yyyy")} (today)`
                    : format(day, "EEEE d MMMM yyyy")
                }
                aria-selected={selected}
                onClick={() => {
                  onSelectCalendarDay(dk);
                  onClearSessionFocus();
                }}
                className={cn(
                  "relative flex size-9 shrink-0 flex-col items-center justify-center text-xs leading-none transition-colors",
                  inMonth
                    ? "text-foreground"
                    : todayCell
                      ? "text-emerald-950/95 dark:text-emerald-100"
                      : "text-muted-foreground/45",
                  selected
                    ? cn(
                        "z-[1] rounded-full border-2 border-amber-500 bg-amber-500/25 font-semibold shadow-sm dark:border-amber-400 dark:bg-amber-500/20",
                        todayCell &&
                          "ring-2 ring-emerald-500/80 ring-offset-0 dark:ring-emerald-400/70",
                      )
                    : todayCell
                      ? "rounded-full border-2 border-emerald-500 bg-emerald-500/35 font-semibold text-emerald-950 shadow-sm ring-2 ring-emerald-500/30 dark:border-emerald-400 dark:bg-emerald-500/25 dark:text-emerald-50 dark:ring-emerald-400/35"
                      : hasWorkshops
                        ? "rounded-full border-2 border-neutral-400 dark:border-neutral-500"
                        : "rounded-md border border-transparent",
                  !selected &&
                    !todayCell &&
                    "hover:bg-muted/80",
                  !selected &&
                    todayCell &&
                    "hover:border-emerald-600 hover:bg-emerald-500/45 dark:hover:border-emerald-300 dark:hover:bg-emerald-500/35",
                )}
              >
                <span className={cn("tabular-nums", todayCell && "font-semibold")}>
                  {format(day, "d")}
                </span>
                {kinds != null && kinds.size > 0 ? (
                  <span className="mt-0.5 flex min-h-2.5 items-center justify-center gap-0.5">
                    {kinds.has("registered") ? (
                      <span
                        className="size-2 shrink-0 rounded-full bg-purple-500 shadow-sm dark:bg-purple-400"
                        title="Registered"
                      />
                    ) : null}
                    {kinds.has("open") ? (
                      <span
                        className="size-2 shrink-0 rounded-full bg-sky-500 shadow-sm dark:bg-sky-400"
                        title="Not registered"
                      />
                    ) : null}
                    {kinds.has("closed") ? (
                      <span
                        className="size-2 shrink-0 rounded-full bg-slate-500 shadow-sm dark:bg-slate-400"
                        title="Closed"
                      />
                    ) : null}
                  </span>
                ) : null}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function workshopCardSelectHandler(
  e: MouseEvent,
  sessionId: Id<"workshopSessions">,
  startsAt: number,
  onRequestFocusSession: (id: Id<"workshopSessions">, startsAt: number) => void,
) {
  if ((e.target as HTMLElement).closest("a, button")) {
    return;
  }
  onRequestFocusSession(sessionId, startsAt);
}

function workshopListItemHighlightClass(
  sessionId: Id<"workshopSessions">,
  startsAt: number,
  calendarFocusedSessionId: Id<"workshopSessions"> | null,
  calendarSelectedDayMs: number | null,
): string {
  const dayMs = dayKeyFromMs(startsAt);
  const dayMatches =
    calendarSelectedDayMs != null && calendarSelectedDayMs === dayMs;
  if (calendarFocusedSessionId === sessionId) {
    return "ring-3 ring-amber-500 ring-offset-2 ring-offset-background";
  }
  if (dayMatches && calendarFocusedSessionId == null) {
    return "ring-3 ring-amber-400/90 ring-offset-2 ring-offset-background dark:ring-amber-400/70";
  }
  return "";
}

function workshopClosedReplayHref(
  unitId: Id<"units">,
  sessionId: Id<"workshopSessions">,
  levelId: Id<"certificationLevels"> | null,
): string {
  const q = new URLSearchParams();
  q.set("session", sessionId);
  q.set("from", "workshops");
  if (levelId) {
    q.set("level", levelId);
  }
  return `/units/${unitId}?${q.toString()}`;
}

/** Webinars page → unit: enables the “Join in Teams” strip and session-scoped join rules. */
function workshopsPageOpenUnitHref(
  unitId: Id<"units">,
  sessionId: Id<"workshopSessions">,
  levelId: Id<"certificationLevels"> | null,
): string {
  const q = new URLSearchParams();
  q.set("from", "workshops");
  q.set("session", sessionId);
  if (levelId) {
    q.set("level", levelId);
  }
  return `/units/${unitId}?${q.toString()}`;
}

function WorkshopSessionStatusRow({
  session,
  now,
  neutralAccent = "purple",
}: {
  session: LiveWorkshopSessionTimes;
  now: number;
  neutralAccent?: "purple" | "sky";
}) {
  const status = liveWorkshopSessionStatus(session, now);
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
      <Badge
        variant="outline"
        className={cn(
          "px-2 py-0 text-[10px] font-bold uppercase tracking-wide",
          liveWorkshopStatusBadgeClass(status.tone, neutralAccent),
        )}
      >
        {status.label}
      </Badge>
      {status.detail ? (
        <span className="text-[11px] leading-tight text-muted-foreground">
          {status.detail}
        </span>
      ) : null}
    </div>
  );
}

/** Open session on cert path — register only (no duplicate “Registered” badge). */
function OpenCertPathSessionCard({
  session,
  now,
  onRegister,
}: {
  session: WorkshopBrowseRow;
  now: number;
  onRegister: () => void;
}) {
  const teamsJoinTrimmed = session.externalJoinUrl?.trim() ?? "";
  return (
    <Card
      size="sm"
      className={cn(
        WORKSHOP_SESSION_TILE_CARD,
        WORKSHOP_SESSION_SKY_GRADIENT,
      )}
    >
      <CardHeader className={WORKSHOP_SESSION_TILE_HEADER}>
        <CardTitle className="text-base font-medium">
          {session.workshopTitle}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {formatWorkshopSessionRange(session.startsAt, session.endsAt)}
        </p>
        <WorkshopSessionStatusRow
          session={session}
          now={now}
          neutralAccent="sky"
        />
      </CardHeader>
      <CardContent className={WORKSHOP_SESSION_TILE_CONTENT}>
        <Button
          type="button"
          size="sm"
          className="bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
          disabled={session.full}
          onClick={onRegister}
        >
          {session.full ? "Full" : "Register"}
        </Button>
        <Link
          href={workshopsPageOpenUnitHref(
            session.workshopUnitId,
            session._id,
            null,
          )}
          title="Open webinar unit — live session (video, chat, screen share)"
          aria-label={`Open webinar unit: ${session.workshopTitle}`}
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "max-w-full rounded-full border-sky-500/35 bg-sky-500/10 px-3 font-medium text-sky-950 shadow-sm hover:bg-sky-500/18 dark:border-sky-400/40 dark:bg-sky-500/15 dark:text-sky-50 dark:hover:bg-sky-500/24",
          )}
        >
          <Video
            className="h-3.5 w-3.5 text-sky-800 dark:text-sky-200"
            aria-hidden
          />
          <span className="truncate">Open webinar unit</span>
        </Link>
        {session.externalJoinUrl ? (
          isMicrosoftTeamsSession(session) && teamsJoinTrimmed.length > 0 ? (
            <Button
              type="button"
              size="sm"
              disabled
              title="Register for this session to join in Microsoft Teams"
              aria-label="Join in Teams (register for this session first)"
              className="inline-flex gap-1.5 border-red-600/35 bg-red-600/10 text-red-950/60 dark:border-red-400/30 dark:bg-red-600/12 dark:text-red-50/60"
            >
              Join in Teams
              <ExternalLink
                className="h-3.5 w-3.5 shrink-0 text-red-800/50 dark:text-red-200/50"
                aria-hidden
              />
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled
              title="Register for this session to use the join link"
              aria-label="Join link (register for this session first)"
              className="inline-flex gap-1 text-sky-800/60 dark:text-sky-200/60"
            >
              Join link
              <ExternalLink className="h-3.5 w-3.5 opacity-60" />
            </Button>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Your registration on a certification-path workshop (single place — no third list). */
function RegisteredCertPathWorkshopCard({
  session,
  workshopTitle,
  workshopUnitCode,
  past,
  now,
  onUnregister,
  onTeamsJoinTracked,
  certPathLevelId,
}: {
  session: Doc<"workshopSessions">;
  workshopTitle: string;
  workshopUnitCode: string | null;
  past: boolean;
  now: number;
  onUnregister: () => void;
  onTeamsJoinTracked: (sessionId: Id<"workshopSessions">) => Promise<void>;
  certPathLevelId: Id<"certificationLevels"> | null;
}) {
  const teamsJoinTrimmed = session.externalJoinUrl?.trim() ?? "";
  const openWebinarUnitHref = workshopsPageOpenUnitHref(
    session.workshopUnitId,
    session._id,
    certPathLevelId,
  );

  return (
    <Card
      size="sm"
      className={cn(
        WORKSHOP_SESSION_TILE_CARD,
        WORKSHOP_SESSION_PURPLE_GRADIENT,
        past && "border-dashed opacity-80 [border-inline-start-style:solid]",
      )}
    >
      <CardHeader className={cn("gap-0.5", WORKSHOP_SESSION_TILE_HEADER)}>
        <Link
          href={openWebinarUnitHref}
          className={cn(
            "group flex w-full min-w-0 max-w-full flex-col gap-0 rounded-md outline-none transition-colors",
            "hover:bg-purple-200/90 focus-visible:bg-purple-200/90 focus-visible:ring-2 focus-visible:ring-purple-500/40 focus-visible:ring-offset-2 dark:hover:bg-purple-900/85 dark:focus-visible:bg-purple-900/85",
          )}
          aria-label={`Open webinar unit: ${workshopTitle}`}
        >
          <CardTitle className="min-w-0 text-base font-medium leading-snug text-foreground underline-offset-4 group-hover:underline">
            <span className="block truncate">{workshopTitle}</span>
          </CardTitle>
          {workshopUnitCode ? (
            <span className="w-full min-w-0 break-words font-mono text-[10px] font-semibold leading-snug tracking-wide text-muted-foreground [overflow-wrap:anywhere]">
              {workshopUnitCode}
            </span>
          ) : null}
        </Link>
        <p className="mt-1 text-xs leading-tight text-muted-foreground">
          {formatWorkshopSessionRange(session.startsAt, session.endsAt)}
          {past ? " · Past" : ""}
        </p>
        <WorkshopSessionStatusRow session={session} now={now} />
      </CardHeader>
      <CardContent className={WORKSHOP_SESSION_TILE_CONTENT}>
        {!past && session.status === "scheduled" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-amber-600/60 bg-amber-500/[0.22] text-amber-950 shadow-none hover:border-amber-600/75 hover:bg-amber-500/30 dark:border-amber-400/55 dark:bg-amber-500/28 dark:text-amber-50 dark:hover:border-amber-400/70 dark:hover:bg-amber-500/36"
            onClick={onUnregister}
          >
            Unregister
          </Button>
        ) : null}
        {session.externalJoinUrl && !past ? (
          isMicrosoftTeamsSession(session) ? (
            <>
              <Link
                href={openWebinarUnitHref}
                title="Open webinar unit — live session (video, chat, screen share)"
                aria-label={`Open webinar unit: ${workshopTitle}`}
                className={cn(
                  buttonVariants({ variant: "secondary", size: "sm" }),
                  "max-w-full rounded-full border-purple-500/35 bg-purple-500/10 px-3 font-medium text-purple-950 shadow-sm hover:bg-purple-500/18 dark:border-purple-400/40 dark:bg-purple-500/15 dark:text-purple-50 dark:hover:bg-purple-500/24",
                )}
              >
                <Video
                  className="h-3.5 w-3.5 text-purple-700 dark:text-purple-300"
                  aria-hidden
                />
                <span className="truncate">Open webinar unit</span>
              </Link>
              {teamsJoinTrimmed.length > 0 ? (
                <Link
                  href={workshopJoinHrefForLink(teamsJoinTrimmed)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "inline-flex gap-1.5 border-red-600/45 bg-red-600/15 text-red-950 hover:bg-red-600/25 dark:border-red-400/40 dark:bg-red-600/20 dark:text-red-50 dark:hover:bg-red-600/30",
                  )}
                  onClick={() => {
                    void onTeamsJoinTracked(session._id).catch(() => {});
                  }}
                >
                  Join in Teams
                  <ExternalLink className="h-3.5 w-3.5 text-red-800 dark:text-red-200" />
                </Link>
              ) : null}
            </>
          ) : (
            <Link
              href={session.externalJoinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "inline-flex gap-1.5 border-purple-500/30 bg-purple-500/10 text-purple-950 hover:bg-purple-500/18 dark:border-purple-400/25 dark:bg-purple-500/15 dark:text-purple-50 dark:hover:bg-purple-500/22",
              )}
            >
              Open join link
              <ExternalLink className="h-3.5 w-3.5 text-purple-700 dark:text-purple-300" />
            </Link>
          )
        ) : !past ? (
          <Link
            href={openWebinarUnitHref}
            title="Open webinar unit — live session (video, chat, screen share)"
            aria-label={`Open webinar unit: ${workshopTitle}`}
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "max-w-full rounded-full border-purple-500/35 bg-purple-500/10 px-3 font-medium text-purple-950 shadow-sm hover:bg-purple-500/18 dark:border-purple-400/40 dark:bg-purple-500/15 dark:text-purple-50 dark:hover:bg-purple-500/24",
            )}
          >
            <Video
              className="h-3.5 w-3.5 text-purple-700 dark:text-purple-300"
              aria-hidden
            />
            <span className="truncate">Open webinar unit</span>
          </Link>
        ) : null}
        {isMicrosoftTeamsSession(session) ? (
          <WorkshopSyncTracePanel
            sessionId={session._id}
            className="mt-0.5 w-full"
            defaultOpen={false}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Ended certification-path session — open the unit with `?session=` to load that run’s chat & whiteboard. */
function ClosedCertPathWorkshopCard({
  session,
  workshopTitle,
  levelId,
}: {
  session: Doc<"workshopSessions">;
  workshopTitle: string;
  levelId: Id<"certificationLevels"> | null;
}) {
  const href = workshopClosedReplayHref(
    session.workshopUnitId,
    session._id,
    levelId,
  );
  return (
    <Card
      size="sm"
      className={cn(
        WORKSHOP_SESSION_TILE_CARD,
        WORKSHOP_SESSION_SLATE_GRADIENT,
      )}
    >
      <CardHeader
        className={cn("gap-0.5", WORKSHOP_SESSION_TILE_HEADER)}
      >
        <CardTitle className="text-base font-medium text-foreground">
          {workshopTitle}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {formatWorkshopSessionRange(session.startsAt, session.endsAt)}
        </p>
        <Badge
          variant="outline"
          className="mt-0.5 w-fit border-slate-400/60 bg-slate-200/40 px-2 py-0 text-[10px] font-bold uppercase tracking-wide text-slate-800 dark:border-slate-500/50 dark:bg-slate-800/50 dark:text-slate-100"
        >
          Closed
        </Badge>
      </CardHeader>
      <CardContent className={WORKSHOP_SESSION_TILE_CONTENT}>
        <Link
          href={href}
          title="Open webinar unit — session chat and whiteboard"
          aria-label={`Open webinar unit: ${workshopTitle}`}
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "inline-flex max-w-full gap-1.5 rounded-full border-slate-400/45 bg-slate-200/50 px-3 font-medium text-slate-900 shadow-sm hover:bg-slate-200/80 dark:border-slate-500/50 dark:bg-slate-800/60 dark:text-slate-50 dark:hover:bg-slate-800/85",
          )}
        >
          <MessageSquare
            className="h-3.5 w-3.5 shrink-0 text-slate-700 dark:text-slate-300"
            aria-hidden
          />
          <span className="truncate">Open webinar unit</span>
        </Link>
      </CardContent>
    </Card>
  );
}

export default function WorkshopsClient() {
  const searchParams = useSearchParams();
  const filterUnitIdRaw = searchParams.get("unit");
  const filterLevelIdRaw = searchParams.get("level");
  const filterUnitId =
    filterUnitIdRaw && filterUnitIdRaw.length > 0
      ? (filterUnitIdRaw as Id<"units">)
      : null;
  const filterLevelId =
    filterLevelIdRaw && filterLevelIdRaw.length > 0
      ? (filterLevelIdRaw as Id<"certificationLevels">)
      : null;

  const upcomingPath = useQuery(api.workshops.listUpcomingOnMyCertificationPath, {
    certificationTier: "all",
  });
  const registeredOnPath = useQuery(
    api.workshops.myRegistrationsOnCertificationPath,
  );
  const filterUnit = useQuery(
    api.units.get,
    filterUnitId ? { unitId: filterUnitId } : "skip",
  );
  const register = useMutation(api.workshops.registerForSession);
  const unregister = useMutation(api.workshops.unregisterFromSession);
  const recordTeamsJoin = useMutation(api.workshops.recordTeamsJoin);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const [workshopCalendarViewMonth, setWorkshopCalendarViewMonth] = useState(
    () => startOfMonth(new Date()),
  );
  const [calendarSelectedDayMs, setCalendarSelectedDayMs] = useState<
    number | null
  >(null);
  const [calendarFocusedSessionId, setCalendarFocusedSessionId] = useState<
    Id<"workshopSessions"> | null
  >(null);

  const focusWorkshopFromList = useCallback(
    (sessionId: Id<"workshopSessions">, startsAt: number) => {
      setCalendarFocusedSessionId(sessionId);
      setCalendarSelectedDayMs(dayKeyFromMs(startsAt));
      setWorkshopCalendarViewMonth(startOfMonth(new Date(startsAt)));
    },
    [],
  );

  const clearCalendarSessionFocus = useCallback(() => {
    setCalendarFocusedSessionId(null);
  }, []);

  const pathListsReady =
    registeredOnPath !== undefined && upcomingPath !== undefined;

  useEffect(() => {
    if (!pathListsReady) {
      return;
    }
    const root = document.getElementById("workshop-upcoming-sessions");
    if (!root) {
      return;
    }
    if (calendarFocusedSessionId) {
      root
        .querySelector(
          `[data-workshop-session="${calendarFocusedSessionId}"]`,
        )
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }
    if (calendarSelectedDayMs != null) {
      root
        .querySelector(`[data-workshop-day="${calendarSelectedDayMs}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [
    pathListsReady,
    calendarFocusedSessionId,
    calendarSelectedDayMs,
  ]);

  const upcomingFiltered = useMemo(() => {
    if (!upcomingPath) {
      return undefined;
    }
    if (!filterUnitId) {
      return upcomingPath;
    }
    return upcomingPath.filter((s) => s.workshopUnitId === filterUnitId);
  }, [upcomingPath, filterUnitId]);

  const registeredOnPathFiltered = useMemo(() => {
    if (!registeredOnPath) {
      return undefined;
    }
    if (!filterUnitId) {
      return registeredOnPath;
    }
    return registeredOnPath.filter(
      ({ session }) => session.workshopUnitId === filterUnitId,
    );
  }, [registeredOnPath, filterUnitId]);

  const registeredActiveFiltered = useMemo(() => {
    if (!registeredOnPathFiltered) {
      return undefined;
    }
    return registeredOnPathFiltered.filter(
      ({ past, session }) => !past && session.status === "scheduled",
    );
  }, [registeredOnPathFiltered]);

  const closedWorkshopsFiltered = useMemo(() => {
    if (!registeredOnPathFiltered) {
      return undefined;
    }
    const rows = registeredOnPathFiltered.filter(
      ({ past, session }) => past && session.status === "scheduled",
    );
    rows.sort((a, b) => b.session.endsAt - a.session.endsAt);
    return rows;
  }, [registeredOnPathFiltered]);

  const openSessionsNeedRegister = useMemo(
    () => upcomingFiltered?.filter((s) => !s.registered) ?? [],
    [upcomingFiltered],
  );

  const certPathHref =
    filterLevelId != null
      ? `/certifications/${filterLevelId}?from=workshops#certification-path`
      : "/certifications";

  return (
    <div className="mx-auto max-w-4xl space-y-3 px-3 pb-4 pt-0 sm:px-4 sm:pb-6 sm:pt-1">
      {filterUnitId ? (
        <div
          className={cn(
            "flex flex-col gap-3 rounded-xl px-4 py-3 sm:flex-row sm:items-start sm:justify-between",
            WORKSHOP_FILTER_BANNER,
          )}
          role="region"
          aria-label="Filtered webinar unit"
        >
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {filterUnit === undefined
                ? "Loading this webinar…"
                : filterUnit === null
                  ? "Webinar unit unavailable"
                  : filterUnit.title}
            </p>
            <p className="text-sm text-muted-foreground">
              Register in{" "}
              <span className="font-medium text-foreground">
                Not registered yet
              </span>
              , or unregister from{" "}
              <span className="font-medium text-foreground">Registered</span> to
              pick another date.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-purple-500/40 text-purple-900 hover:bg-purple-500/10 dark:border-purple-400/45 dark:text-purple-100 dark:hover:bg-purple-500/15"
              nativeButton={false}
              render={<Link href="/workshops" />}
            >
              All webinars
            </Button>
            {filterLevelId ? (
              <Button
                variant="secondary"
                size="sm"
                className="border border-purple-500/30 bg-purple-500/15 text-purple-950 hover:bg-purple-500/22 dark:border-purple-400/25 dark:bg-purple-500/20 dark:text-purple-50 dark:hover:bg-purple-500/28"
                nativeButton={false}
                render={<Link href={certPathHref} />}
              >
                Certification path
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <section
        id="workshop-upcoming-sessions"
        className="scroll-mt-24 space-y-3"
        aria-label="Webinar sessions on your certifications"
      >
        {!pathListsReady ? (
          <p className="text-sm text-purple-900/70 dark:text-purple-200/75">
            Loading…
          </p>
        ) : (
          <div className="space-y-4">
            <UserWorkshopsPathCalendar
              registeredActive={registeredActiveFiltered ?? []}
              openSessions={openSessionsNeedRegister}
              closed={closedWorkshopsFiltered ?? []}
              viewMonth={workshopCalendarViewMonth}
              onViewMonthChange={setWorkshopCalendarViewMonth}
              selectedDayMs={calendarSelectedDayMs}
              focusedSessionId={calendarFocusedSessionId}
              onSelectCalendarDay={setCalendarSelectedDayMs}
              onClearSessionFocus={clearCalendarSessionFocus}
              todayClockMs={now}
            />
            <div
              className={cn(
                "flex min-h-[4rem] flex-col gap-2 rounded-xl p-3",
                WORKSHOP_SECTION_REGISTERED,
              )}
              aria-labelledby="workshop-list-registered-heading"
            >
              <h3
                id="workshop-list-registered-heading"
                className="text-base font-semibold text-purple-950 dark:text-purple-50"
              >
                Registered
              </h3>
              {!registeredActiveFiltered ||
              registeredActiveFiltered.length === 0 ? (
                <p className="text-sm text-purple-950/80 dark:text-purple-100/85">
                  No upcoming registrations on your certification path
                  {filterUnitId ? " for this unit" : ""} yet.
                </p>
              ) : (
                <ul className="grid list-none grid-cols-1 gap-2 p-0 md:grid-cols-2">
                  {registeredActiveFiltered.map(
                    ({
                      session,
                      workshopTitle,
                      workshopUnitCode,
                      past,
                    }) => (
                      <li
                        key={session._id}
                        className={cn(
                          "min-w-0 rounded-xl transition-shadow",
                          workshopListItemHighlightClass(
                            session._id,
                            session.startsAt,
                            calendarFocusedSessionId,
                            calendarSelectedDayMs,
                          ),
                        )}
                        data-workshop-session={session._id}
                        data-workshop-day={dayKeyFromMs(session.startsAt)}
                        onClick={(e) =>
                          workshopCardSelectHandler(
                            e,
                            session._id,
                            session.startsAt,
                            focusWorkshopFromList,
                          )
                        }
                      >
                        <RegisteredCertPathWorkshopCard
                          session={session}
                          workshopTitle={workshopTitle}
                          workshopUnitCode={workshopUnitCode}
                          past={past}
                          now={now}
                          certPathLevelId={filterLevelId}
                          onTeamsJoinTracked={async (sessionId) => {
                            await recordTeamsJoin({ sessionId });
                          }}
                          onUnregister={() => {
                            void (async () => {
                              try {
                                await unregister({ sessionId: session._id });
                                toast.success("Unregistered");
                              } catch (e) {
                                toast.error(
                                  e instanceof Error ? e.message : "Failed",
                                );
                              }
                            })();
                          }}
                        />
                      </li>
                    ),
                  )}
                </ul>
              )}
            </div>
            <div
              className={cn(
                "flex min-h-[4rem] flex-col gap-2 rounded-xl p-3",
                WORKSHOP_SECTION_OPEN,
              )}
              aria-labelledby="workshop-list-open-heading"
            >
              <h3
                id="workshop-list-open-heading"
                className="text-base font-semibold text-sky-950 dark:text-sky-50"
              >
                Not registered yet
              </h3>
              {openSessionsNeedRegister.length === 0 ? (
                <p className="text-sm text-sky-950/80 dark:text-sky-100/85">
                  No open sessions to join on your path right now, or you are on
                  every upcoming one.
                </p>
              ) : (
                <ul className="grid list-none grid-cols-1 gap-2 p-0 md:grid-cols-2">
                  {openSessionsNeedRegister.map((s) => (
                    <li
                      key={s._id}
                      className={cn(
                        "min-w-0 rounded-xl transition-shadow",
                        workshopListItemHighlightClass(
                          s._id,
                          s.startsAt,
                          calendarFocusedSessionId,
                          calendarSelectedDayMs,
                        ),
                      )}
                      data-workshop-session={s._id}
                      data-workshop-day={dayKeyFromMs(s.startsAt)}
                      onClick={(e) =>
                        workshopCardSelectHandler(
                          e,
                          s._id,
                          s.startsAt,
                          focusWorkshopFromList,
                        )
                      }
                    >
                      <OpenCertPathSessionCard
                        session={s}
                        now={now}
                        onRegister={() => {
                          void (async () => {
                            try {
                              await register({ sessionId: s._id });
                              toast.success("Registered");
                            } catch (e) {
                              toast.error(
                                e instanceof Error ? e.message : "Failed",
                              );
                            }
                          })();
                        }}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div
              className={cn(
                "flex min-h-[4rem] flex-col gap-2 rounded-xl p-3",
                WORKSHOP_SECTION_CLOSED,
              )}
              aria-labelledby="workshop-list-closed-heading"
            >
              <h3
                id="workshop-list-closed-heading"
                className="text-base font-semibold text-slate-900 dark:text-slate-50"
              >
                Closed
              </h3>
              {!closedWorkshopsFiltered ||
              closedWorkshopsFiltered.length === 0 ? (
                <p className="text-sm text-slate-800/80 dark:text-slate-100/85">
                  No closed webinars on your path
                  {filterUnitId ? " for this unit" : ""} yet.
                </p>
              ) : (
                <ul className="grid list-none grid-cols-1 gap-2 p-0 md:grid-cols-2">
                  {closedWorkshopsFiltered.map(({ session, workshopTitle }) => (
                    <li
                      key={session._id}
                      className={cn(
                        "min-w-0 rounded-xl transition-shadow",
                        workshopListItemHighlightClass(
                          session._id,
                          session.startsAt,
                          calendarFocusedSessionId,
                          calendarSelectedDayMs,
                        ),
                      )}
                      data-workshop-session={session._id}
                      data-workshop-day={dayKeyFromMs(session.startsAt)}
                      onClick={(e) =>
                        workshopCardSelectHandler(
                          e,
                          session._id,
                          session.startsAt,
                          focusWorkshopFromList,
                        )
                      }
                    >
                      <ClosedCertPathWorkshopCard
                        session={session}
                        workshopTitle={workshopTitle}
                        levelId={filterLevelId}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

    </div>
  );
}
