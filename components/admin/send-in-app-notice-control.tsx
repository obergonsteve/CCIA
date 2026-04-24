"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Id } from "@/convex/_generated/dataModel";
import { Bell } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  SendInAppNoticeDialog,
  type SendInAppNoticePreset,
} from "./send-in-app-notice-dialog";

export type { SendInAppNoticePreset } from "./send-in-app-notice-dialog";

/**
 * Picks a certification id for in-app link metadata when a unit can belong to
 * multiple tracks — prefer the cert currently selected in the admin training board.
 */
export function resolveLevelIdForInAppLink(
  u: {
    certificationLevelIds?: Id<"certificationLevels">[] | null;
    levelId?: Id<"certificationLevels"> | null;
  },
  filterCertId: Id<"certificationLevels"> | null,
): Id<"certificationLevels"> | undefined {
  const levelIds = u.certificationLevelIds ?? [];
  if (filterCertId && levelIds.includes(filterCertId)) {
    return filterCertId;
  }
  if (u.levelId) {
    return u.levelId;
  }
  return levelIds[0];
}

type TextButtonProps = {
  /** When `null`, the full send form is shown (pick link, audience, etc.). */
  preset: SendInAppNoticePreset | null;
  /** Shown in the dialog when `preset` is set (e.g. entity title). */
  presetSummary?: string;
  defaultCompanyId?: Id<"companies">;
  label?: string;
  className?: string;
};

/**
 * Default admin entry point: “Send in-app notice…” (ruby) with an internal dialog.
 * Use one instance per page area that shares a single preset (or `preset={null}` for
 * the open admin flow).
 */
export function SendInAppNoticeTextButton({
  preset,
  presetSummary,
  defaultCompanyId,
  label = "Send in-app notice…",
  className,
}: TextButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ruby"
        size="sm"
        className={cn("gap-2 shadow-md", className)}
        onClick={() => setOpen(true)}
      >
        <Bell className="h-4 w-4" aria-hidden />
        {label}
      </Button>
      <SendInAppNoticeDialog
        open={open}
        onOpenChange={setOpen}
        preset={preset}
        presetSummary={presetSummary}
        defaultCompanyId={defaultCompanyId}
      />
    </>
  );
}

const NOTICE_ROW_ICON_TIP = "Send in-app notice to learners (links to this item)";

type RowIconProps = {
  onOpen: () => void;
  className?: string;
  /** Smaller hit target + icon (e.g. stacked unit content row actions). */
  compact?: boolean;
  title?: string;
  tooltip?: string;
};

/**
 * Compact notice affordance for admin list rows (training board drag lists).
 * Parent should open a single {@link SendInAppNoticeDialog} (controlled) to avoid
 * one dialog per row in large lists.
 */
export function SendInAppNoticeRowIconButton({
  onOpen,
  className,
  compact,
  title = NOTICE_ROW_ICON_TIP,
  tooltip = "Send in-app notice…",
}: RowIconProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "rounded-none text-red-800/90 hover:bg-red-500/15 hover:text-red-900 dark:text-red-400/95 dark:hover:bg-red-500/20 dark:hover:text-red-200",
            compact ? "h-6 w-6" : "h-7 w-7",
            className,
          )}
          title={title}
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          <Bell
            className={compact ? "h-2.5 w-2.5" : "h-3 w-3"}
            aria-hidden
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
