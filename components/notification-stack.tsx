"use client";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { ChevronDown, GripVertical, StickyNote, X } from "lucide-react";
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
import { cn } from "@/lib/utils";

const NOTE_W = 256;

type Importance = "low" | "normal" | "high" | "urgent";

const glassShadow =
  "shadow-[0_2px_16px_rgba(0,0,0,0.05),0_8px_32px_-4px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.5)] " +
  "dark:shadow-[0_4px_28px_rgba(0,0,0,0.24),0_0_0_1px_rgba(255,255,255,0.06)_inset] " +
  "backdrop-blur-2xl";

/** One frosted “bubble” with stronger, distinct importance tints. */
function importanceClassNames(level: Importance | undefined) {
  const n = (level ?? "normal") as Importance;
  switch (n) {
    case "low":
      return {
        shell: cn(
          "rounded-2xl overflow-hidden border-l-[5px] border-slate-500/50",
          "border border-slate-300/45 border-l-slate-500/50 dark:border-slate-500/30 dark:border-l-slate-400/55",
          "bg-gradient-to-br from-sky-100/35 via-slate-100/20 to-slate-300/15 " +
            "dark:from-slate-500/22 dark:via-slate-800/20 dark:to-slate-900/16",
          glassShadow,
        ),
        hairline:
          "border-b border-slate-400/20 bg-white/12 dark:border-white/10 dark:bg-slate-900/15",
        icon: "text-slate-600 dark:text-slate-300",
        title:
          "text-slate-900/95 [text-shadow:0_1px_0_rgba(255,255,255,0.45)] dark:text-slate-50",
        text: "text-slate-800/95 dark:text-slate-100/95",
        muted: "text-slate-600/88 dark:text-slate-300/85",
      };
    case "normal":
      return {
        shell: cn(
          "rounded-2xl overflow-hidden border-l-[5px] border-amber-500/50",
          "border border-amber-300/40 border-l-amber-500/55 dark:border-amber-600/28 dark:border-l-amber-400/50",
          "bg-gradient-to-br from-amber-200/35 from-20% via-amber-100/20 to-amber-300/22 " +
            "dark:from-amber-500/22 dark:via-amber-800/18 dark:to-amber-950/18",
          glassShadow,
        ),
        hairline:
          "border-b border-amber-500/20 bg-amber-50/20 dark:border-amber-400/12 dark:bg-amber-900/20",
        icon: "text-amber-700 dark:text-amber-300",
        title:
          "text-amber-950/95 [text-shadow:0_1px_0_rgba(255,255,255,0.4)] dark:text-amber-50",
        text: "text-amber-950/95 dark:text-amber-50/95",
        muted: "text-amber-900/80 dark:text-amber-100/80",
      };
    case "high":
      return {
        shell: cn(
          "rounded-2xl overflow-hidden border-l-[5px] border-orange-500/55",
          "border border-orange-300/42 border-l-orange-500/60 dark:border-orange-500/32 dark:border-l-orange-400/50",
          "bg-gradient-to-br from-orange-200/38 from-20% via-orange-100/22 to-orange-300/24 " +
            "dark:from-orange-500/25 dark:via-orange-800/20 dark:to-orange-950/20",
          glassShadow,
        ),
        hairline:
          "border-b border-orange-500/22 bg-orange-50/18 dark:border-orange-400/12 dark:bg-orange-950/20",
        icon: "text-orange-700 dark:text-orange-300",
        title:
          "text-orange-950/95 [text-shadow:0_1px_0_rgba(255,255,255,0.4)] dark:text-orange-50",
        text: "text-orange-950/95 dark:text-orange-50/95",
        muted: "text-orange-900/80 dark:text-orange-100/80",
      };
    case "urgent":
      return {
        shell: cn(
          "rounded-2xl overflow-hidden border-l-[5px] border-rose-500/55",
          "border border-rose-300/40 border-l-rose-500/60 dark:border-rose-500/32 dark:border-l-rose-400/55",
          "bg-gradient-to-br from-rose-200/40 from-20% via-rose-100/22 to-rose-300/25 " +
            "dark:from-rose-500/26 dark:via-rose-800/20 dark:to-rose-950/20",
          glassShadow,
        ),
        hairline:
          "border-b border-rose-500/22 bg-rose-50/20 dark:border-rose-400/12 dark:bg-rose-950/20",
        icon: "text-rose-700 dark:text-rose-300",
        title:
          "text-rose-950/95 [text-shadow:0_1px_0_rgba(255,255,255,0.4)] dark:text-rose-50",
        text: "text-rose-950/95 dark:text-rose-50/95",
        muted: "text-rose-900/80 dark:text-rose-100/80",
      };
    default:
      return importanceClassNames("normal");
  }
}

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
  const importance = (row.importance ?? "normal") as Importance;
  const th = importanceClassNames(importance);
  const [expanded, setExpanded] = useState(true);
  const hasDetails = Boolean(
    (row.body != null && row.body.trim() !== "") || row.linkHref,
  );

  const onHandlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    onFocusNote();
    const startX = e.clientX - x;
    const startY = e.clientY - y;
    const el = e.currentTarget;

    const onMove = (ev: PointerEvent) => {
      const w = cardRef.current?.offsetWidth ?? NOTE_W;
      const h = cardRef.current?.offsetHeight ?? 100;
      const { innerWidth, innerHeight } = window;
      const nx = ev.clientX - startX;
      const ny = ev.clientY - startY;
      const c = clampNotifPosition(nx, ny, innerWidth, innerHeight, w, h);
      onPositionChange(c.x, c.y);
    };

    const onUp = (ev: PointerEvent) => {
      if (el.hasPointerCapture?.(ev.pointerId)) {
        el.releasePointerCapture(ev.pointerId);
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    el.setPointerCapture(e.pointerId);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      ref={cardRef}
      className="fixed w-64 max-w-[min(16rem,calc(100vw-0.5rem))] select-none"
      style={{
        left: 0,
        top: 0,
        transform: `translate(${x}px, ${y}px)`,
        zIndex: z,
      }}
      onPointerDown={() => onFocusNote()}
    >
      <div className={cn("overflow-hidden", th.shell)}>
        <div
          className={cn(
            "flex min-h-8 items-center gap-0.5 px-2",
            th.hairline,
            hasDetails && !expanded && "border-b-0",
          )}
        >
          <button
            type="button"
            className="touch-none rounded p-0.5 text-foreground/70 hover:bg-black/5 dark:hover:bg-white/10 cursor-grab active:cursor-grabbing"
            title="Drag"
            aria-label="Drag to move"
            onPointerDown={onHandlePointerDown}
          >
            <GripVertical className="h-3.5 w-3.5" aria-hidden />
          </button>
          <StickyNote
            className={cn("h-3 w-3 shrink-0 opacity-90", th.icon)}
            aria-hidden
          />
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
              className="shrink-0 rounded p-0.5 text-foreground/80 hover:bg-black/10 dark:hover:bg-white/15"
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
            className="rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/15"
            onClick={(e) => {
              e.stopPropagation();
              onFocusNote();
              removeNotifPosition(forUserId, row._id);
              onDismiss();
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
            {row.body ? (
              <p className="line-clamp-6 text-xs leading-relaxed tracking-tight">
                {row.body}
              </p>
            ) : null}
            {row.linkHref ? (
              <p className={cn("pt-1.5 text-[0.7rem] leading-tight", th.muted)}>
                <Link
                  href={row.linkHref}
                  className="font-medium underline"
                  onClick={onFocusNote}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  Open link
                </Link>
              </p>
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
      for (let i = 0; i < rows.length; i += 1) {
        const r = rows[i]!;
        const id = r._id;
        const existing = prev[id] ?? stored[id];
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
          next[id] = defaultNotifPosition(i, w, h);
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
            i,
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
            className="pointer-events-auto fixed bottom-4 right-4 z-[30000]"
          >
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="text-xs shadow-md"
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
