"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

export function WorkshopSyncTracePanel({
  sessionId,
  className,
  defaultOpen = true,
}: {
  sessionId: Id<"workshopSessions"> | null | undefined;
  className?: string;
  /** When false, the trace starts collapsed. */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const logs = useQuery(
    api.workshops.workshopSessionSyncTrace,
    sessionId ? { sessionId, limit: 80 } : "skip",
  );

  if (!sessionId) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-md border border-dashed border-border/90 bg-muted/25 text-left dark:border-white/15 dark:bg-black/20",
        className,
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/50 dark:hover:bg-white/5"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
        )}
        Debug: Teams / Resend trace
      </button>
      {open ? (
        <div className="max-h-52 overflow-y-auto border-t border-border/60 px-2 py-1.5 font-mono text-[11px] leading-snug dark:border-white/10">
          {logs === undefined ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : logs.length === 0 ? (
            <p className="text-muted-foreground">
              No lines yet. After you save a Teams session or register, Convex
              jobs append steps here (Graph token, POST/PATCH, Resend).
            </p>
          ) : (
            <ul className="space-y-1.5">
              {logs.map((row) => (
                <li key={row._id} className="break-words [overflow-wrap:anywhere]">
                  <span className="tabular-nums text-muted-foreground">
                    {new Date(row.at).toLocaleTimeString()}
                  </span>{" "}
                  <span
                    className={cn(
                      "font-semibold",
                      row.source === "graph" && "text-sky-700 dark:text-sky-300",
                      row.source === "resend" &&
                        "text-violet-700 dark:text-violet-300",
                      row.source === "system" &&
                        "text-foreground/80 dark:text-foreground/70",
                    )}
                  >
                    [{row.source}]
                  </span>{" "}
                  <span
                    className={cn(
                      row.level === "error" && "text-destructive",
                      row.level === "warn" &&
                        "text-amber-800 dark:text-amber-200/90",
                      row.level === "info" && "text-foreground/90",
                    )}
                  >
                    {row.level}:
                  </span>{" "}
                  <span className="text-foreground/95">{row.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
