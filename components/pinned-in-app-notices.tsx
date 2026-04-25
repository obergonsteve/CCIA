"use client";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ExternalLink,
  TrendingUp,
  Video,
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
  postItChromeForNotification,
  postItFirstRowClassName,
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
import { WebinarReminderBodyParagraph } from "@/components/webinar-reminder-body-paragraph";

const DRAG_TYPE_PREFIX = "cciaNotification:";

const PIN_CONTROL_HINT =
  "Drag a note above to stash it for later. Oldest first when opened.";

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
  const noteCountLabel =
    count === 1
      ? "1 stashed note"
      : `${count} stashed notes`;

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

  const returnStashedNoteToDesktop = useCallback(
    async (id: Id<"userNotifications">) => {
      if (forUserId == null) {
        return;
      }
      try {
        await unpinM({ forUserId, notificationId: id });
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Couldn’t return note to desktop",
        );
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
      aria-label="Stashed in header"
      className={cn(
        "relative z-30 shrink-0 rounded-lg transition-shadow duration-150",
        over &&
          "z-40 ring-2 ring-brand-sky ring-offset-2 ring-offset-background dark:ring-offset-card",
        over && "shadow-lg shadow-brand-sky/20 dark:shadow-brand-sky/10",
      )}
    >
      <div
        className={cn(
          "flex min-h-0 w-full min-w-[9.99rem] max-w-full items-stretch justify-stretch gap-0 rounded-lg border border-dashed border-brand-sky/55 bg-gradient-to-r from-brand-sky/18 via-brand-lime/[0.1] to-brand-gold/14 px-2 py-0.5 shadow-sm shadow-brand-sky/15 transition-[border-color,background-color,box-shadow,transform] duration-150 sm:min-w-[11.07rem] sm:px-2.5",
          "dark:border-brand-sky/50 dark:from-brand-sky/[0.14] dark:via-brand-lime/[0.09] dark:to-brand-gold/[0.11] dark:shadow-brand-sky/20",
          over && [
            "border-brand-sky/90 border-solid bg-brand-sky/20 dark:border-brand-sky/70",
            "dark:bg-[color-mix(in_oklab,var(--card)_80%,#0ea5e9_18%)]",
            "scale-[1.02]",
          ],
        )}
        data-pinned-drop-hint={over || undefined}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 w-full min-w-0 justify-between gap-1.5 px-1.5 text-[0.75rem] leading-tight text-foreground/88",
            /* `ghost` sets `hover:bg-muted` and `aria-expanded:bg-muted` — override so the chip never picks up that gray. */
            "!bg-transparent hover:!bg-black/[0.06] dark:hover:!bg-white/[0.08]",
            "aria-expanded:!bg-transparent dark:aria-expanded:!bg-transparent",
            "focus-visible:!bg-transparent",
          )}
          aria-expanded={expanded}
          title={PIN_CONTROL_HINT}
          aria-label={`Stashed in header — ${noteCountLabel}. ${PIN_CONTROL_HINT}`}
          onClick={() => setExpanded((e) => !e)}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <Archive className="size-4 shrink-0 text-brand-sky" aria-hidden />
            {count > 0 ? (
              <span
                className="min-w-0 text-left text-[0.75rem] font-normal tabular-nums leading-tight text-[color-mix(in_srgb,var(--brand-gold),#0a0a0a_28%)] dark:text-[color-mix(in_srgb,var(--brand-gold),#000_14%)]"
              >
                {noteCountLabel}
              </span>
            ) : (
              <span className="text-[0.75rem] text-muted-foreground/80">
                {noteCountLabel}
              </span>
            )}
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-foreground/45 transition-transform dark:text-foreground/50",
              expanded && "rotate-180",
            )}
            aria-hidden
          />
        </Button>
      </div>

      {expanded && (
        <div
          className="absolute right-0 top-full z-50 mt-0.5 w-max min-w-0 max-w-[min(100vw-2rem,18rem)] overflow-x-hidden rounded-lg border border-slate-300/88 bg-slate-200/92 p-1.5 text-foreground shadow-lg ring-1 ring-slate-400/28 dark:border-slate-600/58 dark:bg-slate-800/70 dark:ring-slate-600/32"
        >
          {pinned === undefined ? (
            <p className="px-1 py-3 text-center text-xs text-muted-foreground">
              Loading…
            </p>
          ) : pinned.length === 0 ? (
            <p className="px-1 py-3 text-center text-xs text-muted-foreground">
              Drag a note onto above
              <br />
              to stash it for later
            </p>
          ) : (
            <ol className="m-0 list-none space-y-1.5 p-0">
              {pinned.map((row) => (
                <PinnedLine
                  key={row._id}
                  row={row}
                  forUserId={String(forUserId)}
                  onReturnFromStash={returnStashedNoteToDesktop}
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
  onReturnFromStash,
}: {
  row: Doc<"userNotifications">;
  forUserId: string;
  onReturnFromStash: (id: Id<"userNotifications">) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const importance = (row.importance ?? "normal") as NotificationImportance;
  const th = postItChromeForNotification(row);
  const a11yIcon =
    row.kind === "webinar_reminder"
      ? "Webinar reminder"
      : row.kind === "unit_progress_nudge"
        ? "Progress nudge"
        : NOTIFICATION_IMPORTANCE[importance].human;
  const hasBody =
    Boolean(row.body != null && row.body.trim() !== "") ||
    (row.kind === "webinar_reminder" &&
      row.linkRef?.kind === "workshopSession");
  const hasLink = Boolean(row.linkHref && row.linkHref.trim() !== "");
  const hasDetails = hasBody || hasLink;
  const linkLabel = row.linkLabel?.trim() || "Open";

  const returnStashToDesktop = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const m = loadNotifPositions(forUserId);
    const pos = defaultNotifPosition(0, w, h);
    saveNotifPositions(forUserId, { ...m, [row._id]: pos });
    void onReturnFromStash(row._id);
  }, [forUserId, onReturnFromStash, row._id]);

  return (
    <li className="list-none">
      <div className={cn(postItCardWidthClass, "shrink-0")}>
        <div className={cn("w-full overflow-hidden", th.shell)}>
        <div
          className={postItFirstRowClassName(th.hairline, hasDetails, expanded)}
        >
          <span
            className="inline-flex shrink-0 mr-1"
            title={a11yIcon}
            aria-label={a11yIcon}
            role="img"
          >
            {row.kind === "webinar_reminder" ? (
              <Video
                className={cn("h-4 w-4 shrink-0 opacity-90", th.icon)}
                aria-hidden
              />
            ) : row.kind === "unit_progress_nudge" ? (
              <TrendingUp
                className={cn("h-4 w-4 shrink-0 opacity-90", th.icon)}
                aria-hidden
              />
            ) : (
              <NotificationImportanceGlyph
                level={importance}
                className={cn("h-4 w-4", th.icon)}
              />
            )}
          </span>
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-left text-[0.7rem] font-normal leading-tight",
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
            className="shrink-0 cursor-default rounded p-0.5 text-foreground/65 hover:bg-black/10 hover:text-foreground/90 dark:text-foreground/60 dark:hover:bg-white/15 dark:hover:text-foreground/90"
            onClick={(e) => {
              e.stopPropagation();
              returnStashToDesktop();
            }}
            title="Take this note out of the stash: it reappears in the floating stack (top of the screen)"
            aria-label="Return stashed note to the desktop"
          >
            <ArchiveRestore
              className="h-4 w-4"
              strokeWidth={2.25}
              aria-hidden
            />
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
            {row.kind === "webinar_reminder" &&
            row.linkRef?.kind === "workshopSession" ? (
              <WebinarReminderBodyParagraph
                row={row}
                className="line-clamp-6 text-xs leading-relaxed tracking-tight"
              />
            ) : row.body ? (
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
