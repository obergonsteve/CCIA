"use client";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { ChevronDown, ExternalLink, GripVertical, Video, X } from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useSessionUser } from "@/lib/use-session-user";
import {
  clampNotifPosition,
  defaultNotifPosition,
  loadNotifPositions,
  removeNotifPosition,
  saveNotifPositions,
} from "@/lib/notification-positions";
import {
  type NotificationImportance,
  NOTIFICATION_IMPORTANCE,
  NotificationImportanceGlyph,
} from "@/lib/notification-importance";
import {
  postItCardWidthClass,
  postItChromeForNotification,
  postItFirstRowClassName,
} from "@/lib/notification-post-it-surface";
import {
  CCIA_PINNED_SAVED_EVENT,
  isPointOverPinnedInAppDrop,
  setPinnedInAppDropHover,
} from "@/lib/pinned-in-app-drop";
import { cn } from "@/lib/utils";
import { WebinarReminderBodyParagraph } from "@/components/webinar-reminder-body-paragraph";
import { toast } from "sonner";

const NOTE_W = 256;
const PIN_POINTER_SLOP_PX = 4;

function DraggableNote({
  row,
  x,
  y,
  z,
  forUserId,
  onPositionChange,
  onDismiss,
  onFocusNote,
}: {
  row: Doc<"userNotifications">;
  x: number;
  y: number;
  z: number;
  forUserId: string;
  onPositionChange: (x: number, y: number) => void;
  onDismiss: () => void;
  onFocusNote: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const gripRef = useRef<HTMLButtonElement>(null);
  const importance = (row.importance ?? "normal") as NotificationImportance;
  const th = postItChromeForNotification(row);
  const a11yIcon =
    row.kind === "webinar_reminder"
      ? "Webinar reminder"
      : NOTIFICATION_IMPORTANCE[importance].human;
  const [expanded, setExpanded] = useState(false);
  const hasBody =
    Boolean(row.body != null && row.body.trim() !== "") ||
    (row.kind === "webinar_reminder" &&
      row.linkRef?.kind === "workshopSession");
  const hasLink = Boolean(row.linkHref && row.linkHref.trim() !== "");
  /** Step link / body text live in the same collapsible area. */
  const hasDetails = hasBody || hasLink;
  const linkLabel = row.linkLabel?.trim() || "Open";
  const pinM = useMutation(api.userNotifications.pinInApp);
  const pinUserId = forUserId as Id<"users">;
  const pinTrackRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    slopMet: boolean;
  } | null>(null);
  /** document capture listeners (see onCardPointerDown) */
  const pinDocListenersRef = useRef<{
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
  } | null>(null);

  const dismissOnceRef = useRef(false);
  const finishDismiss = useCallback(() => {
    if (dismissOnceRef.current) {
      return;
    }
    dismissOnceRef.current = true;
    removeNotifPosition(forUserId, row._id);
    onDismiss();
  }, [forUserId, onDismiss, row._id]);

  const onHandlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    onFocusNote();
    const pointerId = e.pointerId;
    const startClientX0 = e.clientX;
    const startClientY0 = e.clientY;
    const startX = e.clientX - x;
    const startY = e.clientY - y;
    const el = e.currentTarget;
    /** Slop for “drag onto Pinned” (same as card); moving the handle counts as a drag. */
    const slop = { met: false };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) {
        return;
      }
      const w = cardRef.current?.offsetWidth ?? NOTE_W;
      const h = cardRef.current?.offsetHeight ?? 100;
      const { innerWidth, innerHeight } = window;
      const nx = ev.clientX - startX;
      const ny = ev.clientY - startY;
      const c = clampNotifPosition(nx, ny, innerWidth, innerHeight, w, h);
      onPositionChange(c.x, c.y);

      const d2FromStart =
        (ev.clientX - startClientX0) * (ev.clientX - startClientX0) +
        (ev.clientY - startClientY0) * (ev.clientY - startClientY0);
      const slop2 = PIN_POINTER_SLOP_PX * PIN_POINTER_SLOP_PX;
      if (d2FromStart >= slop2) {
        slop.met = true;
      }
      const movedEnough = slop.met || d2FromStart >= slop2;
      setPinnedInAppDropHover(
        movedEnough && isPointOverPinnedInAppDrop(ev.clientX, ev.clientY),
      );
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) {
        return;
      }
      if (el.hasPointerCapture?.(ev.pointerId)) {
        el.releasePointerCapture(ev.pointerId);
      }
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onUp, true);

      setPinnedInAppDropHover(false);
      const d2 =
        (ev.clientX - startClientX0) * (ev.clientX - startClientX0) +
        (ev.clientY - startClientY0) * (ev.clientY - startClientY0);
      const slop2 = PIN_POINTER_SLOP_PX * PIN_POINTER_SLOP_PX;
      const movedEnough = slop.met || d2 >= slop2;
      if (
        movedEnough &&
        isPointOverPinnedInAppDrop(ev.clientX, ev.clientY)
      ) {
        void runPinInHeader();
        return;
      }
    };

    el.setPointerCapture(pointerId);
    document.addEventListener("pointermove", onMove, { capture: true, passive: true });
    document.addEventListener("pointerup", onUp, { capture: true });
    document.addEventListener("pointercancel", onUp, { capture: true });
  };

  const endPinToHeaderListeners = useCallback(() => {
    const w = pinDocListenersRef.current;
    if (w != null) {
      document.removeEventListener("pointermove", w.move, true);
      document.removeEventListener("pointerup", w.up, true);
      document.removeEventListener("pointercancel", w.up, true);
      pinDocListenersRef.current = null;
    }
    pinTrackRef.current = null;
    setPinnedInAppDropHover(false);
  }, []);

  const runPinInHeader = useCallback(async () => {
    try {
      const r = await pinM({
        forUserId: pinUserId,
        notificationId: row._id,
      });
      if (r.ok) {
        if (r.already) {
          toast.message("Already in Pinned.");
        } else {
          window.dispatchEvent(
            new CustomEvent(CCIA_PINNED_SAVED_EVENT, {
              detail: { expand: true } as { expand: boolean },
            }),
          );
        }
      } else if (r.reason === "max_pins") {
        toast.error("Pinned list is full (20). Unpin one first.");
      } else if (r.reason === "not_active") {
        toast.error("That note is no longer available.");
      } else {
        toast.error("Could not add to Pinned.");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not add to Pinned.",
      );
    }
  }, [pinM, pinUserId, row._id]);

  useEffect(() => {
    return () => {
      setPinnedInAppDropHover(false);
      const w = pinDocListenersRef.current;
      if (w != null) {
        document.removeEventListener("pointermove", w.move, true);
        document.removeEventListener("pointerup", w.up, true);
        document.removeEventListener("pointercancel", w.up, true);
        pinDocListenersRef.current = null;
      }
    };
  }, []);

  const onCardPointerDown = (e: React.PointerEvent) => {
    onFocusNote();
    if (e.button !== 0) {
      return;
    }
    const t = e.target;
    if (!(t instanceof Element)) {
      return;
    }
    if (gripRef.current != null && gripRef.current.contains(t)) {
      return;
    }
    if (t.closest("button, a[href]")) {
      return;
    }

    endPinToHeaderListeners();
    const session = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      slopMet: false,
    };
    pinTrackRef.current = session;
    /** `document` + capture phase: we always see pointer position even when
     *  the note (z-200) covers the header; the card’s own listeners do not. */

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== session.pointerId) {
        return;
      }
      const s = pinTrackRef.current;
      if (s == null) {
        return;
      }
      const d2FromStart =
        (ev.clientX - s.startX) * (ev.clientX - s.startX) +
        (ev.clientY - s.startY) * (ev.clientY - s.startY);
      const slop2 = PIN_POINTER_SLOP_PX * PIN_POINTER_SLOP_PX;
      if (d2FromStart >= slop2) {
        s.slopMet = true;
      }
      const movedEnough = s.slopMet || d2FromStart >= slop2;
      const onTarget = isPointOverPinnedInAppDrop(ev.clientX, ev.clientY);
      setPinnedInAppDropHover(movedEnough && onTarget);
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== session.pointerId) {
        return;
      }
      const s = pinTrackRef.current;
      const startX = s?.startX ?? 0;
      const startY = s?.startY ?? 0;
      endPinToHeaderListeners();
      if (s == null) {
        return;
      }
      const d2 =
        (ev.clientX - startX) * (ev.clientX - startX) +
        (ev.clientY - startY) * (ev.clientY - startY);
      const slop2 = PIN_POINTER_SLOP_PX * PIN_POINTER_SLOP_PX;
      const movedEnough = s.slopMet || d2 >= slop2;
      if (!movedEnough) {
        return;
      }
      if (!isPointOverPinnedInAppDrop(ev.clientX, ev.clientY)) {
        return;
      }
      void runPinInHeader();
    };

    pinDocListenersRef.current = { move: onMove, up: onUp };
    document.addEventListener("pointermove", onMove, { capture: true, passive: true });
    document.addEventListener("pointerup", onUp, { capture: true });
    document.addEventListener("pointercancel", onUp, { capture: true });
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        "fixed cursor-grab select-none active:cursor-grabbing",
        postItCardWidthClass,
      )}
      style={{
        left: 0,
        top: 0,
        transform: `translate(${x}px, ${y}px)`,
        zIndex: z,
      }}
      title="Drag the handle or the card onto Pinned in the header to add this note to Pinned"
      onPointerDown={onCardPointerDown}
    >
      <div className={cn("w-full overflow-hidden", th.shell)}>
        <div
          className={postItFirstRowClassName(
            th.hairline,
            hasDetails,
            expanded,
          )}
        >
          <button
            ref={gripRef}
            type="button"
            className="cursor-grab touch-none rounded p-0.5 text-foreground/70 hover:bg-black/5 dark:hover:bg-white/10 active:cursor-grabbing"
            title="Drag to move; release over Pinned in the header to save"
            aria-label="Drag to move"
            draggable={false}
            onPointerDown={onHandlePointerDown}
          >
            <GripVertical className="h-3.5 w-3.5" aria-hidden />
          </button>
          <span
            className="inline-flex shrink-0"
            title={a11yIcon}
            aria-label={a11yIcon}
            role="img"
          >
            {row.kind === "webinar_reminder" ? (
              <Video
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
              draggable={false}
              className="shrink-0 cursor-default rounded p-0.5 text-foreground/80 hover:bg-black/10 dark:hover:bg-white/15"
              onClick={(e) => {
                e.stopPropagation();
                onFocusNote();
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
            draggable={false}
            className="cursor-default rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/15"
            onClick={(e) => {
              e.stopPropagation();
              onFocusNote();
              finishDismiss();
            }}
            title="Dismiss"
            aria-label="Dismiss notification"
          >
            <X className="h-3.5 w-3.5" />
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
              <div
                className={cn("px-0.5", hasBody && "mt-2")}
              >
                <Link
                  href={row.linkHref}
                  draggable={false}
                  className={cn(
                    "inline-flex w-full min-w-0 max-w-full cursor-pointer items-center justify-center gap-1.5 overflow-hidden",
                    "rounded-md border border-current/18 bg-foreground/5 py-1 text-center text-[0.65rem] font-medium leading-tight",
                    th.muted,
                    "hover:bg-foreground/10 focus-visible:outline focus-visible:ring-2 focus-visible:ring-foreground/25",
                  )}
                  title={
                    linkLabel !== "Open" ? linkLabel : (row.linkHref ?? "Open")
                  }
                  onClick={onFocusNote}
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
  );
}

export function NotificationStack() {
  const { user: sessionUser } = useSessionUser();
  const userIdString = sessionUser?.userId?.trim();
  const forUserId =
    userIdString != null && userIdString.length > 0
      ? (userIdString as Id<"users">)
      : undefined;
  const forUserKey = userIdString ?? "";

  const rows = useQuery(
    api.userNotifications.listActiveForUser,
    forUserId != null
      ? { forUserId, limit: 12 as const }
      : "skip",
  );
  const dismissM = useMutation(api.userNotifications.dismiss);
  const dismissAllM = useMutation(api.userNotifications.dismissAll);

  const [mounted, setMounted] = useState(false);
  const [positions, setPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const zNext = useRef(1000);
  const [zById, setZById] = useState<Record<string, number>>({});
  const prevNotifIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
  }, []);

  /** New session or user: reset stacking. */
  useEffect(() => {
    prevNotifIdsRef.current = new Set();
    setZById({});
    zNext.current = 1000;
  }, [forUserId]);

  useLayoutEffect(() => {
    if (forUserId == null || !rows || rows.length === 0) {
      return;
    }
    setPositions((prev) => {
      const stored = loadNotifPositions(forUserKey);
      const w = window.innerWidth;
      const h = window.innerHeight;
      const next: Record<string, { x: number; y: number }> = {};
      for (const r of rows) {
        const id = r._id;
        /** `localStorage` first so unpin’s `saveNotifPositions` isn’t losing to stale `prev`. */
        const existing = stored[id] ?? prev[id];
        if (existing) {
          next[id] = clampNotifPosition(
            existing.x,
            existing.y,
            w,
            h,
            NOTE_W,
            100,
          );
        } else {
          next[id] = defaultNotifPosition(0, w, h);
        }
      }
      saveNotifPositions(forUserKey, next);
      return next;
    });
  }, [forUserId, forUserKey, rows]);

  useEffect(() => {
    if (forUserId == null) {
      return;
    }
    const onResize = () => {
      setPositions((prev) => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const next: Record<string, { x: number; y: number }> = {};
        for (const k of Object.keys(prev)) {
          const p = prev[k]!;
          next[k] = clampNotifPosition(
            p.x,
            p.y,
            w,
            h,
            NOTE_W,
            100,
          );
        }
        saveNotifPositions(forUserKey, next);
        return next;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [forUserId, forUserKey]);

  /** Newest / newly added notes get the highest z so they appear on top. */
  useLayoutEffect(() => {
    if (forUserId == null || !rows?.length) {
      return;
    }
    const byIndex = new Map(rows.map((r, i) => [r._id, i] as const));
    const currentIds = rows.map((r) => r._id);
    const newIds = currentIds.filter((id) => !prevNotifIdsRef.current.has(id));
    if (newIds.length === 0) {
      prevNotifIdsRef.current = new Set(currentIds);
      return;
    }
    const olderFirst = [...newIds].sort(
      (a, b) => (byIndex.get(b) ?? 0) - (byIndex.get(a) ?? 0),
    );
    setZById((m) => {
      const next = { ...m };
      for (const id of olderFirst) {
        zNext.current += 1;
        next[id] = zNext.current;
      }
      return next;
    });
    prevNotifIdsRef.current = new Set(currentIds);
  }, [forUserId, rows]);

  const bringToFront = useCallback((id: string) => {
    zNext.current += 1;
    const z = zNext.current;
    setZById((m) => ({ ...m, [id]: z }));
  }, []);

  const setPosition = useCallback(
    (id: string, x: number, y: number) => {
      setPositions((m) => {
        const n = { ...m, [id]: { x, y } };
        saveNotifPositions(forUserKey, n);
        return n;
      });
    },
    [forUserKey],
  );

  const onDismiss = useCallback(
    (id: Id<"userNotifications">) => {
      if (forUserId == null) {
        return;
      }
      void dismissM({ forUserId, notificationId: id });
    },
    [dismissM, forUserId],
  );

  if (
    !mounted ||
    forUserId == null ||
    rows === undefined ||
    rows.length === 0
  ) {
    return null;
  }

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[200]"
      aria-live="polite"
    >
      <div className="contents">
        {rows.map((row, i) => {
          const id = row._id;
          const pos = positions[id] ?? defaultNotifPosition(
            0,
            typeof window !== "undefined" ? window.innerWidth : 1200,
            typeof window !== "undefined" ? window.innerHeight : 800,
          );
          const z =
            zById[id] ?? 200 + (rows.length - 1 - i) * 10;
          return (
            <div
              key={id}
              className="pointer-events-auto"
            >
              <DraggableNote
                row={row}
                x={pos.x}
                y={pos.y}
                z={z}
                forUserId={forUserKey}
                onPositionChange={(nx, ny) => setPosition(id, nx, ny)}
                onDismiss={() => onDismiss(id)}
                onFocusNote={() => bringToFront(id)}
              />
            </div>
          );
        })}
        {rows.length > 1 ? (
          <div
            className="pointer-events-auto fixed right-4 bottom-1 z-[30000] max-[480px]:right-2 max-[480px]:bottom-1"
          >
            <Button
              type="button"
              size="sm"
              className={cn(
                "text-xs font-medium shadow-md",
                "border border-brand-lime/60 bg-brand-lime/90 text-foreground",
                "hover:bg-brand-lime dark:border-brand-lime/50 dark:bg-brand-lime/80 dark:hover:bg-brand-lime/90",
              )}
              onClick={() => {
                for (const r of rows) {
                  removeNotifPosition(forUserKey, r._id);
                }
                void dismissAllM({ forUserId });
              }}
            >
              Dismiss all
            </Button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
