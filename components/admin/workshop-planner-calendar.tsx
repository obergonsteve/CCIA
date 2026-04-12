"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";
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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const WEEK_STARTS_ON = 1 as const;

/** Drop target id prefix for admin Training Content → Workshops tab. */
export const WORKSHOP_CAL_DAY_PREFIX = "workshop-cal-day:";

export function workshopCalendarDayDropId(day: Date): string {
  return `${WORKSHOP_CAL_DAY_PREFIX}${startOfDay(day).getTime()}`;
}

export type WorkshopPlannerSessionMarker = {
  startsAt: number;
  status: "scheduled" | "cancelled";
};

function sessionsForCalendarDay(
  sessions: WorkshopPlannerSessionMarker[],
  day: Date,
) {
  return sessions.filter((s) => isSameDay(new Date(s.startsAt), day));
}

function DroppablePlannerDayCell({
  day,
  viewMonth,
  selectedDay,
  sessions,
  onSelectDay,
  dropHighlightDayMs,
}: {
  day: Date;
  viewMonth: Date;
  selectedDay: Date;
  sessions: WorkshopPlannerSessionMarker[];
  onSelectDay: (day: Date) => void;
  dropHighlightDayMs?: number | null;
}) {
  const dayStart = startOfDay(day);
  const droppableId = workshopCalendarDayDropId(day);
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });
  const inMonth = isSameMonth(day, viewMonth);
  const selected = isSameDay(day, selectedDay);
  const daySessions = sessionsForCalendarDay(sessions, day);
  const scheduled = daySessions.filter((s) => s.status === "scheduled").length;
  const cancelled = daySessions.filter((s) => s.status === "cancelled").length;
  const highlighted =
    dropHighlightDayMs != null && dropHighlightDayMs === dayStart.getTime();

  return (
    <button
      ref={setNodeRef}
      type="button"
      role="gridcell"
      aria-label={format(day, "EEEE d MMMM yyyy")}
      aria-selected={selected}
      onClick={() => onSelectDay(dayStart)}
      className={cn(
        "relative flex aspect-square max-h-11 flex-col items-center justify-center rounded-md border border-transparent text-sm transition-colors",
        inMonth ? "text-foreground" : "text-muted-foreground/45",
        selected
          ? "border-brand-gold/60 bg-brand-gold/15 font-semibold"
          : "hover:bg-muted/80",
        (isOver || highlighted) &&
          "ring-2 ring-inset ring-purple-500/55 dark:ring-purple-400/50",
      )}
    >
      <span className="tabular-nums">{format(day, "d")}</span>
      {(scheduled > 0 || cancelled > 0) && (
        <span className="mt-0.5 flex h-3 items-center justify-center gap-0.5">
          {scheduled > 0 ? (
            <span
              className="size-1.5 rounded-full bg-brand-lime"
              title={`${scheduled} scheduled`}
            />
          ) : null}
          {cancelled > 0 ? (
            <span
              className="size-1.5 rounded-full bg-muted-foreground/50"
              title={`${cancelled} cancelled`}
            />
          ) : null}
        </span>
      )}
    </button>
  );
}

function StaticPlannerDayCell({
  day,
  viewMonth,
  selectedDay,
  sessions,
  onSelectDay,
}: {
  day: Date;
  viewMonth: Date;
  selectedDay: Date;
  sessions: WorkshopPlannerSessionMarker[];
  onSelectDay: (day: Date) => void;
}) {
  const dayStart = startOfDay(day);
  const inMonth = isSameMonth(day, viewMonth);
  const selected = isSameDay(day, selectedDay);
  const daySessions = sessionsForCalendarDay(sessions, day);
  const scheduled = daySessions.filter((s) => s.status === "scheduled").length;
  const cancelled = daySessions.filter((s) => s.status === "cancelled").length;

  return (
    <button
      type="button"
      role="gridcell"
      aria-label={format(day, "EEEE d MMMM yyyy")}
      aria-selected={selected}
      onClick={() => onSelectDay(dayStart)}
      className={cn(
        "relative flex aspect-square max-h-11 flex-col items-center justify-center rounded-md border border-transparent text-sm transition-colors",
        inMonth ? "text-foreground" : "text-muted-foreground/45",
        selected
          ? "border-brand-gold/60 bg-brand-gold/15 font-semibold"
          : "hover:bg-muted/80",
      )}
    >
      <span className="tabular-nums">{format(day, "d")}</span>
      {(scheduled > 0 || cancelled > 0) && (
        <span className="mt-0.5 flex h-3 items-center justify-center gap-0.5">
          {scheduled > 0 ? (
            <span
              className="size-1.5 rounded-full bg-brand-lime"
              title={`${scheduled} scheduled`}
            />
          ) : null}
          {cancelled > 0 ? (
            <span
              className="size-1.5 rounded-full bg-muted-foreground/50"
              title={`${cancelled} cancelled`}
            />
          ) : null}
        </span>
      )}
    </button>
  );
}

export function WorkshopPlannerCalendar({
  sessions,
  selectedDay,
  onSelectDay,
  droppableDays = false,
  dropHighlightDayMs,
  onViewMonthChange,
}: {
  sessions: WorkshopPlannerSessionMarker[];
  selectedDay: Date;
  onSelectDay: (day: Date) => void;
  /** When true, each day is a @dnd-kit drop target (Training Content workshops tab). */
  droppableDays?: boolean;
  /** Optional drag-over highlight (day start ms, same as drop id payload). */
  dropHighlightDayMs?: number | null;
  /** Fired when the visible month changes (for session counts in the shell). */
  onViewMonthChange?: (monthStart: Date) => void;
}) {
  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(startOfDay(selectedDay)),
  );

  /** Parent often passes an inline handler; keep out of effect deps to avoid update loops. */
  const onViewMonthChangeRef = useRef(onViewMonthChange);
  onViewMonthChangeRef.current = onViewMonthChange;

  useEffect(() => {
    onViewMonthChangeRef.current?.(startOfMonth(viewMonth));
  }, [viewMonth]);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: WEEK_STARTS_ON });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: WEEK_STARTS_ON });
  const gridDays = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd],
  );

  /** Mon–Sun short names (locale-aware). */
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1 sm:justify-start">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label="Previous month"
            onClick={() => setViewMonth((m) => subMonths(m, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="min-w-0 flex-1 text-center text-sm font-semibold tabular-nums sm:flex-none">
            {format(viewMonth, "MMMM yyyy")}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label="Next month"
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 text-xs"
          onClick={() => {
            const t = startOfDay(new Date());
            onSelectDay(t);
            setViewMonth(startOfMonth(t));
          }}
        >
          Today
        </Button>
      </div>

      <div
        className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
        aria-hidden
      >
        {weekShort.map((label, i) => (
          <div key={`${i}-${label}`} className="py-1">
            {label}
          </div>
        ))}
      </div>

      <div
        className="grid grid-cols-7 gap-1"
        role="grid"
        aria-label="Workshop dates"
      >
        {gridDays.map((day) =>
          droppableDays ? (
            <DroppablePlannerDayCell
              key={day.getTime()}
              day={day}
              viewMonth={viewMonth}
              selectedDay={selectedDay}
              sessions={sessions}
              onSelectDay={onSelectDay}
              dropHighlightDayMs={dropHighlightDayMs}
            />
          ) : (
            <StaticPlannerDayCell
              key={day.getTime()}
              day={day}
              viewMonth={viewMonth}
              selectedDay={selectedDay}
              sessions={sessions}
              onSelectDay={onSelectDay}
            />
          ),
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-brand-lime" /> Scheduled
        </span>
        {" · "}
        <span className="inline-flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-muted-foreground/50" />{" "}
          Cancelled
        </span>
        {droppableDays ? (
          <>
            {" · "}
            <span className="text-foreground/80">
              Drag a workshop unit onto a date to schedule.
            </span>
          </>
        ) : null}
      </p>
    </div>
  );
}
