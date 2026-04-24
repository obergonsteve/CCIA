"use client";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMutation, useQuery } from "convex/react";
import {
  ChevronDown,
  ExternalLink,
  GripVertical,
  Pin,
  PinOff,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  NOTIFICATION_IMPORTANCE,
  NotificationImportanceGlyph,
  type NotificationImportance,
} from "@/lib/notification-importance";
import {
  postItCardWidthClass,
  postItFirstRowClassName,
  postItImportanceClassNames,
} from "@/lib/notification-post-it-surface";
import {
  CCIA_PINNED_HOVER_EVENT,
  CCIA_PINNED_SAVED_EVENT,
  PINNED_IN_APP_DROP_ID,
} from "@/lib/pinned-in-app-drop";
import {
  defaultNotifPosition,
  loadNotifPositions,
  saveNotifPositions,
} from "@/lib/notification-positions";
import { useSessionUser } from "@/lib/use-session-user";
import { cn } from "@/lib/utils";

const DRAG_TYPE_PREFIX = "cciaNotification:";

export function PinnedInAppNotices() {
  const { user: sessionUser } = useSessionUser();
  const forUserId = sessionUser?.userId
    ? (sessionUser.userId as Id<"users">)
    : undefined;
  const [expanded, setExpanded] = useState(false);
  const [over, setOver] = useState(false);

  const pinned = useQuery(
    api.userNotifications.listPinnedForUser,
    forUserId != null ? { forUserId } : "skip",
  );
  const unpinM = useMutation(api.userNotifications.unpinInApp);

  const count = pinned?.length ?? 0;
  const noticeCountLabel =
    count === 1
      ? "1 pinned notice"
      : `${count} pinned notices`;

  useEffect(() => {
    const onHover = (e: Event) => {
      const d = (e as CustomEvent<{ over: boolean }>).detail;
      if (d && typeof d.over === "boolean") {
        setOver(d.over);
      }
    };
    const onSaved = (e: Event) => {
      if ((e as CustomEvent<{ expand?: boolean }>).detail?.expand) {
        setExpanded(true);
      }
    };
    window.addEventListener(CCIA_PINNED_HOVER_EVENT, onHover);
    window.addEventListener(CCIA_PINNED_SAVED_EVENT, onSaved);
    return () => {
      window.removeEventListener(CCIA_PINNED_HOVER_EVENT, onHover);
      window.removeEventListener(CCIA_PINNED_SAVED_EVENT, onSaved);
    };
  }, []);

  const onUnpin = useCallback(
    async (id: Id<"userNotifications">) => {
      if (forUserId == null) {
        return;
      }
      try {
        await unpinM({ forUserId, notificationId: id });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Unpin failed");
      }
    },
    [forUserId, unpinM],
  );

  if (forUserId == null) {
    return null;
  }

  return (
    <div
      id={PINNED_IN_APP_DROP_ID}
      role="region"
      aria-label="Pinned in header"
      className={cn(
        "relative z-30 shrink-0 rounded-lg transition-shadow duration-150",
        over &&
          "z-40 ring-2 ring-brand-sky ring-offset-2 ring-offset-background dark:ring-offset-card",
        over && "shadow-lg shadow-brand-sky/20 dark:shadow-brand-sky/10",
      )}
    >
      <div
        className={cn(
          "flex min-h-0 w-full min-w-[9.25rem] max-w-full items-stretch justify-stretch gap-0 rounded-lg border border-dashed border-brand-sky/55 bg-gradient-to-r from-brand-sky/18 via-brand-lime/[0.1] to-brand-gold/14 px-2 py-0.5 shadow-sm shadow-brand-sky/15 transition-[border-color,background-color,box-shadow,transform] duration-150 sm:min-w-[10.25rem] sm:px-2.5",
          "dark:border-brand-sky/50 dark:from-brand-sky/[0.14] dark:via-brand-lime/[0.09] dark:to-brand-gold/[0.11] dark:shadow-brand-sky/20",
          over && [
            "border-brand-sky/90 border-solid bg-brand-sky/20 dark:border-brand-sky/70",
            "dark:bg-[color-mix(in_oklab,var(--card)_80%,#0ea5e9_18%)]",
            "scale-[1.02]",
          ],
        )}
        data-pinned-drop-hint={over || undefined}
      >
        <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 w-full min-w-0 justify-between gap-1.5 px-1.5 text-[0.75rem] leading-tight text-foreground/88",
                /* `ghost` sets `hover:bg-muted` and `aria-expanded:bg-muted` — override so the chip never picks up that gray. */
                "!bg-transparent hover:!bg-black/[0.06] dark:hover:!bg-white/[0.08]",
                "aria-expanded:!bg-transparent dark:aria-expanded:!bg-transparent",
                "data-[state=instant-open]:!bg-transparent data-[state=delayed-open]:!bg-transparent",
                "focus-visible:!bg-transparent",
              )}
              aria-expanded={expanded}
              aria-label={`Pinned in header — ${noticeCountLabel}`}
              onClick={() => setExpanded((e) => !e)}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <Pin
                  className="size-3.5 shrink-0 text-brand-sky"
                  aria-hidden
                />
                {count > 0 ? (
                  <span
                    className="min-w-0 text-left text-[0.75rem] font-normal tabular-nums leading-tight text-[color-mix(in_srgb,var(--brand-gold),#0a0a0a_28%)] dark:text-[color-mix(in_srgb,var(--brand-gold),#000_14%)]"
                    aria-label={noticeCountLabel}
                  >
                    {noticeCountLabel}
                  </span>
                ) : (
                  <span className="text-[0.75rem] text-muted-foreground/80">
                    {noticeCountLabel}
                  </span>
                )}
              </span>
              <ChevronDown
                className={cn(
                  "size-3.5 shrink-0 text-foreground/45 transition-transform dark:text-foreground/50",
                  expanded && "rotate-180",
                )}
                aria-hidden
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            className="w-64 max-w-[min(16rem,calc(100vw-0.5rem))] px-2 py-1 text-left text-[0.7rem] font-normal leading-snug text-popover-foreground"
          >
            Drag a notice here to pin it. Oldest first when opened.
          </TooltipContent>
        </Tooltip>
        </TooltipProvider>
      </div>

      {expanded && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-[min(100vw-2rem,18rem)] rounded-lg border border-slate-300/85 bg-slate-200/90 p-1.5 text-foreground shadow-lg ring-1 ring-slate-400/25 dark:border-slate-600/55 dark:bg-slate-800/65 dark:ring-slate-600/30"
        >
          {pinned === undefined ? (
            <p className="px-1 py-3 text-center text-xs text-muted-foreground">
              Loading…
            </p>
          ) : pinned.length === 0 ? (
            <p className="px-1 py-3 text-center text-xs text-muted-foreground">
              Drag a notice here to pin it
            </p>
          ) : (
            <ol className="m-0 max-h-[min(50vh,22rem)] list-none space-y-1.5 overflow-y-auto p-0 pr-0.5">
              {pinned.map((row) => (
                <PinnedLine
                  key={row._id}
                  row={row}
                  forUserId={String(forUserId)}
                  onUnpin={onUnpin}
                />
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function PinnedLine({
  row,
  forUserId,
  onUnpin,
}: {
  row: Doc<"userNotifications">;
  forUserId: string;
  onUnpin: (id: Id<"userNotifications">) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const importance = (row.importance ?? "normal") as NotificationImportance;
  const th = postItImportanceClassNames(importance);
  const hasBody = Boolean(row.body != null && row.body.trim() !== "");
  const hasLink = Boolean(row.linkHref && row.linkHref.trim() !== "");
  const hasDetails = hasBody || hasLink;
  const linkLabel = row.linkLabel?.trim() || "Open";

  const unpinToDesktop = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const m = loadNotifPositions(forUserId);
    const pos = defaultNotifPosition(0, w, h);
    saveNotifPositions(forUserId, { ...m, [row._id]: pos });
    void onUnpin(row._id);
  }, [forUserId, onUnpin, row._id]);

  return (
    <li className="list-none">
      <div
        className={cn("mx-auto w-full min-w-0 overflow-hidden", postItCardWidthClass, th.shell)}
      >
        <div
          className={postItFirstRowClassName(
            th.hairline,
            hasDetails,
            expanded,
          )}
        >
          <button
            type="button"
            tabIndex={-1}
            className="invisible pointer-events-none touch-none rounded p-0.5"
            disabled
            aria-hidden
          >
            <GripVertical className="h-3.5 w-3.5" aria-hidden />
          </button>
          <span
            className="inline-flex shrink-0"
            title={NOTIFICATION_IMPORTANCE[importance].human}
            aria-label={NOTIFICATION_IMPORTANCE[importance].human}
            role="img"
          >
            <NotificationImportanceGlyph
              level={importance}
              className={th.icon}
            />
          </span>
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-left text-[0.7rem] font-bold leading-tight",
              th.title,
            )}
          >
            {row.title}
          </span>
          {hasDetails ? (
            <button
              type="button"
              className="shrink-0 cursor-default rounded p-0.5 text-foreground/80 hover:bg-black/10 dark:hover:bg-white/15"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              title={expanded ? "Collapse" : "Expand"}
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse details" : "Expand details"}
            >
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  !expanded && "-rotate-90",
                )}
                aria-hidden
              />
            </button>
          ) : null}
          <button
            type="button"
            className="shrink-0 cursor-default rounded p-0.5 text-foreground/80 hover:bg-black/10 dark:hover:bg-white/15"
            onClick={(e) => {
              e.stopPropagation();
              unpinToDesktop();
            }}
            title="Unpin to desktop (top-right stack)"
            aria-label="Unpin to desktop"
          >
            <PinOff className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
        {hasDetails && (
          <div
            className={cn(
              "overflow-hidden px-2.5 text-left transition-[max-height,opacity] duration-200",
              th.text,
              expanded
                ? "max-h-[32rem] py-2 opacity-100"
                : "max-h-0 py-0 opacity-0 pointer-events-none",
            )}
            aria-hidden={!expanded}
          >
            {row.body ? (
              <p className="line-clamp-6 text-xs leading-relaxed tracking-tight">
                {row.body}
              </p>
            ) : null}
            {row.linkHref ? (
              <div className={cn("px-0.5", hasBody && "mt-2")}>
                <Link
                  href={row.linkHref}
                  className={cn(
                    "inline-flex w-full min-w-0 max-w-full items-center justify-center gap-1.5 overflow-hidden",
                    "rounded-md border border-current/18 bg-foreground/5 py-1 text-center text-[0.65rem] font-medium leading-tight",
                    th.muted,
                    "hover:bg-foreground/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-foreground/25",
                  )}
                  title={
                    linkLabel !== "Open" ? linkLabel : (row.linkHref ?? "Open")
                  }
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <ExternalLink
                    className="h-3 w-3 shrink-0 opacity-80"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">{linkLabel}</span>
                </Link>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </li>
  );
}

export function getPinnedDragPayload(notificationId: string): string {
  return `${DRAG_TYPE_PREFIX}${notificationId}`;
}

export function parsePinnedDropPayload(data: string): string | null {
  const t = data.trim();
  if (!t) {
    return null;
  }
  if (t.startsWith(DRAG_TYPE_PREFIX)) {
    return t.slice(DRAG_TYPE_PREFIX.length) || null;
  }
  return t;
}
