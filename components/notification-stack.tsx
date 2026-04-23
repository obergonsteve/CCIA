"use client";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useCallback } from "react";
import { StickyNote } from "lucide-react";
import { useSessionUser } from "@/lib/use-session-user";
import { cn } from "@/lib/utils";

function hashRotation(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 33 + id.charCodeAt(i) * (i + 3)) | 0;
  }
  const t = h % 5;
  return t - 2; // approx -2 .. 2
}

function NotificationPostIt({
  row,
  stackIndex,
  onDismiss,
}: {
  row: Doc<"userNotifications">;
  stackIndex: number;
  onDismiss: (id: Id<"userNotifications">) => void;
}) {
  const r = hashRotation(row._id);
  const nudge = 10 * stackIndex;
  return (
    <div
      className="absolute right-0 top-0 w-full max-w-[18rem] origin-top-right pl-1 pt-0.5 transition-transform will-change-transform"
      style={{
        zIndex: 30 - stackIndex,
        transform: `translate(-${nudge}px, ${6 + nudge * 0.4}px) rotate(${r}deg)`,
      }}
    >
      <div
        role="group"
        tabIndex={0}
        onClick={() => onDismiss(row._id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onDismiss(row._id);
          }
        }}
        className={cn(
          "cursor-pointer rounded border border-amber-200/60 bg-amber-50/92 px-3.5 py-2.5 text-left shadow-md ring-1 ring-amber-900/5 transition hover:bg-amber-100/95 focus-visible:outline focus-visible:ring-2 focus-visible:ring-brand-gold/50 dark:border-amber-500/20 dark:bg-amber-400/20 dark:ring-amber-100/10 dark:hover:bg-amber-500/16",
        )}
        aria-label={`${row.title}. Click the note to dismiss.`}
      >
        <div className="flex items-start gap-2">
          <StickyNote
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-800/40 dark:text-amber-200/50"
            aria-hidden
          />
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-[0.8rem] font-bold leading-tight text-amber-950 dark:text-amber-50/95">
              {row.title}
            </p>
            {row.body ? (
              <p className="line-clamp-4 text-sm leading-snug text-amber-900/80 dark:text-amber-100/80">
                {row.body}
              </p>
            ) : null}
            {row.linkHref ? (
              <p className="pt-1.5 text-xs text-amber-800/60 dark:text-amber-200/50">
                <Link
                  href={row.linkHref}
                  className="font-medium text-amber-900/80 underline dark:text-amber-100/75"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss(row._id);
                  }}
                >
                  Open link
                </Link>{" "}
                — or click the note to dismiss
              </p>
            ) : (
              <p className="pt-1.5 text-[0.7rem] text-amber-800/55 dark:text-amber-200/45">
                Click to dismiss
              </p>
            )}
          </div>
        </div>
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

  const rows = useQuery(
    api.userNotifications.listActiveForUser,
    forUserId != null
      ? { forUserId, limit: 12 as const }
      : "skip",
  );
  const dismissM = useMutation(api.userNotifications.dismiss);
  const dismissAllM = useMutation(api.userNotifications.dismissAll);

  const onDismiss = useCallback(
    (id: Id<"userNotifications">) => {
      if (forUserId == null) {
        return;
      }
      void dismissM({ forUserId, notificationId: id }).catch(() => {
        /* server validates forUserId */
      });
    },
    [dismissM, forUserId],
  );

  if (rows === undefined || rows.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed right-3 top-20 z-[100] w-[min(20rem,calc(100vw-1.5rem))] sm:right-4 sm:top-24"
      role="region"
      aria-label="In-app notifications"
    >
      <div
        className="pointer-events-auto flex flex-col items-stretch"
        style={{
          minHeight: `${5 + Math.max(0, rows.length - 1) * 2.2}rem`,
        }}
      >
        <div className="relative ml-auto min-h-0 w-full max-w-[18rem]">
          {rows.map((row, i) => (
            <NotificationPostIt
              key={row._id}
              row={row}
              stackIndex={i}
              onDismiss={onDismiss}
            />
          ))}
        </div>
        {rows.length > 1 && forUserId != null ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-end text-xs text-muted-foreground hover:text-foreground"
            onClick={() => void dismissAllM({ forUserId })}
          >
            Dismiss all
          </Button>
        ) : null}
      </div>
    </div>
  );
}
