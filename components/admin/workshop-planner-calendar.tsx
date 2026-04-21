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
  selectedDay: Date | null;
  sessions: WorkshopPlannerSessionMarker[];
  onSelectDay: (day: Date) => void;
  dropHighlightDayMs?: number | null;
}) {
  const dayStart = startOfDay(day);
  const droppableId = workshopCalendarDayDropId(day);
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });
  const inMonth = isSameMonth(day, viewMonth);
  const selected =
    selectedDay != null && isSameDay(day, selectedDay);
  const daySessions = sessionsForCalendarDay(sessions, day);
  const scheduled = daySessions.filter((s) => s.status === "scheduled").length;
  const cancelled = daySessions.filter((s) => s.status === "cancelled").length;
  const highlighted =
    dropHighlightDayMs != null && dropHighlightDayMs === dayStart.getTime();
  const hasScheduledWorkshop = scheduled > 0;

  return (
    <button
      ref={setNodeRef}
      type="button"
      role="gridcell"
      aria-label={format(day, "EEEE d MMMM yyyy")}
      aria-selected={selected}
      onClick={() => onSelectDay(dayStart)}
      className={cn(
        "relative flex aspect-square max-h-11 flex-col items-center justify-center border border-transparent text-sm transition-colors",
        hasScheduledWorkshop && !selected
          ? "rounded-full ring-1 ring-inset ring-muted-foreground/40 dark:ring-muted-foreground/35"
          : "rounded-md",
        inMonth ? "text-foreground" : "text-muted-foreground/45",
        selected
          ? "z-[1] border-2 border-brand-gold bg-brand-gold/35 font-semibold text-foreground shadow-sm shadow-brand-gold/25 dark:border-amber-400 dark:bg-brand-gold/40 dark:shadow-brand-gold/30"
          : "hover:bg-muted/80",
        (isOver || highlighted) &&
          "ring-2 ring-inset ring-purple-500/55 dark:ring-purple-400/50",
      )}
    >
      <span className="tabular-nums leading-none">{format(day, "d")}</span>
      {(scheduled > 0 || cancelled > 0) && (
        <span className="mt-px flex h-2.5 shrink-0 items-center justify-center gap-0.5">
          {scheduled > 0 ? (
            <span
              className="size-1.5 rounded-full bg-purple-500 dark:bg-purple-400"
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
  selectedDay: Date | null;
  sessions: WorkshopPlannerSessionMarker[];
  onSelectDay: (day: Date) => void;
}) {
  const dayStart = startOfDay(day);
  const inMonth = isSameMonth(day, viewMonth);
  const selected =
    selectedDay != null && isSameDay(day, selectedDay);
  const daySessions = sessionsForCalendarDay(sessions, day);
  const scheduled = daySessions.filter((s) => s.status === "scheduled").length;
  const cancelled = daySessions.filter((s) => s.status === "cancelled").length;
  const hasScheduledWorkshop = scheduled > 0;

  return (
    <button
      type="button"
      role="gridcell"
      aria-label={format(day, "EEEE d MMMM yyyy")}
      aria-selected={selected}
      onClick={() => onSelectDay(dayStart)}
      className={cn(
        "relative flex aspect-square max-h-11 flex-col items-center justify-center border border-transparent text-sm transition-colors",
        hasScheduledWorkshop && !selected
          ? "rounded-full ring-1 ring-inset ring-muted-foreground/40 dark:ring-muted-foreground/35"
          : "rounded-md",
        inMonth ? "text-foreground" : "text-muted-foreground/45",
        selected
          ? "z-[1] border-2 border-brand-gold bg-brand-gold/35 font-semibold text-foreground shadow-sm shadow-brand-gold/25 dark:border-amber-400 dark:bg-brand-gold/40 dark:shadow-brand-gold/30"
          : "hover:bg-muted/80",
      )}
    >
      <span className="tabular-nums leading-none">{format(day, "d")}</span>
      {(scheduled > 0 || cancelled > 0) && (
        <span className="mt-px flex h-2.5 shrink-0 items-center justify-center gap-0.5">
          {scheduled > 0 ? (
            <span
              className="size-1.5 rounded-full bg-purple-500 dark:bg-purple-400"
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
  className,
  toolbarVariant = "default",
}: {
  sessions: WorkshopPlannerSessionMarker[];
  /** `null` = no day filter (e.g. show all workshop units in Training Content centre column). */
  selectedDay: Date | null;
  onSelectDay: (day: Date | null) => void;
  /** When true, each day is a @dnd-kit drop target (Training Content workshops tab). */
  droppableDays?: boolean;
  /** Optional drag-over highlight (day start ms, same as drop id payload). */
  dropHighlightDayMs?: number | null;
  /** Fired when the visible month changes (for session counts in the shell). */
  onViewMonthChange?: (monthStart: Date) => void;
  /** Merged onto the root (e.g. `space-y-2` for a denser timetable column). */
  className?: string;
  /** Stronger toolbar contrast on the admin Timetable purple wash (month nav + Today). */
  toolbarVariant?: "default" | "purplePanel";
}) {
  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(startOfDay(selectedDay ?? new Date())),
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

  const purpleToolbar = toolbarVariant === "purplePanel";

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1 sm:justify-start">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 shrink-0",
              purpleToolbar &&
                "text-foreground hover:bg-purple-500/18 dark:hover:bg-purple-400/14",
            )}
            aria-label="Previous month"
            onClick={() => setViewMonth((m) => subMonths(m, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p
            className={cn(
              "min-w-0 flex-1 text-center text-sm font-semibold tabular-nums sm:flex-none",
              purpleToolbar && "text-purple-950 dark:text-purple-50",
            )}
          >
            {format(viewMonth, "MMMM yyyy")}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 shrink-0",
              purpleToolbar &&
                "text-foreground hover:bg-purple-500/18 dark:hover:bg-purple-400/14",
            )}
            aria-label="Next month"
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-8 text-xs",
              purpleToolbar &&
                "border-purple-500/50 bg-[color-mix(in_oklab,purple_12%,var(--card))] text-foreground shadow-sm hover:border-purple-600 hover:bg-[color-mix(in_oklab,purple_20%,var(--card))] hover:text-foreground dark:border-purple-400/45 dark:bg-[color-mix(in_oklab,purple_10%,var(--card))] dark:hover:border-purple-300 dark:hover:bg-[color-mix(in_oklab,purple_18%,var(--card))]",
            )}
            onClick={() => {
              const t = startOfDay(new Date());
              onSelectDay(t);
              setViewMonth(startOfMonth(t));
            }}
          >
            Today
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-wide",
          purpleToolbar
            ? "text-purple-950/75 dark:text-purple-100/80"
            : "text-muted-foreground",
        )}
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
        aria-label="Webinar dates"
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
    </div>
  );
}
