"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Id } from "@/convex/_generated/dataModel";
import { useSessionUser } from "@/lib/use-session-user";
import { Bell } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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
  /**
   * When the dialog opens, set “Who receives it” to this scope
   * (e.g. `"company"` on Users admin, `"students"` on Students admin).
   */
  initialAudience?: "all" | "company" | "students";
  label?: string;
  className?: string;
  /**
   * Learner: label “Note to self”, green button, in-app note only to the signed-in
   * user. Requires a page `preset` (cert or unit) so the link target is set.
   */
  selfNote?: boolean;
};

/**
 * Default admin entry point: “Send in-app note…” (ruby) with an internal dialog.
 * Use one instance per page area that shares a single preset (or `preset={null}` for
 * the open admin flow).
 */
export function SendInAppNoticeTextButton({
  preset,
  presetSummary,
  defaultCompanyId,
  initialAudience = "all",
  label = "Send in-app note…",
  className,
  selfNote = false,
}: TextButtonProps) {
  const { user: sessionUser } = useSessionUser();
  const [open, setOpen] = useState(false);
  const selfUserId = sessionUser?.userId as Id<"users"> | undefined;
  return (
    <>
      <Button
        type="button"
        variant={selfNote ? "limeInverse" : "ruby"}
        size="sm"
        className={cn("gap-2 shadow-md", className)}
        disabled={selfNote && !selfUserId}
        onClick={() => {
          if (selfNote && !selfUserId) {
            toast.error("Sign in to add a personal note.");
            return;
          }
          if (selfNote && !preset) {
            toast.error("A page link is required for a personal note.");
            return;
          }
          setOpen(true);
        }}
      >
        <Bell className="h-4 w-4" aria-hidden />
        {selfNote ? "Note to self" : label}
      </Button>
      <SendInAppNoticeDialog
        open={open}
        onOpenChange={setOpen}
        preset={preset}
        presetSummary={presetSummary}
        defaultCompanyId={defaultCompanyId}
        initialAudience={initialAudience}
        targetUserId={selfNote ? selfUserId : undefined}
        targetUserSummary={
          selfNote && sessionUser
            ? [sessionUser.name, sessionUser.email]
                .map((s) => s?.trim())
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
        selfNoteToCurrentUser={selfNote}
      />
    </>
  );
}

const NOTE_ROW_ICON_TIP = "Send in-app note to users (links to this item)";

type RowIconProps = {
  onOpen: () => void;
  className?: string;
  /** Smaller hit target + icon (e.g. stacked unit content row actions). */
  compact?: boolean;
  title?: string;
  tooltip?: string;
};

/**
 * Compact in-app note affordance for admin list rows (training board drag lists).
 * Parent should open a single {@link SendInAppNoticeDialog} (controlled) to avoid
 * one dialog per row in large lists.
 */
export function SendInAppNoticeRowIconButton({
  onOpen,
  className,
  compact,
  title = NOTE_ROW_ICON_TIP,
  tooltip = "Send in-app note…",
}: RowIconProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "rounded-none text-brand-gold hover:bg-brand-gold/15 hover:text-brand-gold dark:text-brand-gold/90 dark:hover:bg-brand-gold/22 dark:hover:text-brand-gold",
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
