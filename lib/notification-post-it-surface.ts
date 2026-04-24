import { cn } from "@/lib/utils";
import type { NotificationImportance } from "@/lib/notification-importance";

const glassShadow =
  "shadow-[0_2px_12px_rgba(0,0,0,0.04),0_6px_24px_-4px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.35)] " +
  "dark:shadow-[0_3px_20px_rgba(0,0,0,0.16),0_0_0_1px_rgba(255,255,255,0.04)_inset] " +
  "backdrop-blur-xl";

/**
 * Frosted “bubble” with distinct importance tints (post-it + pinned header).
 * Keep in sync with the Draggable note chrome.
 */
export function postItImportanceClassNames(
  level: NotificationImportance | undefined,
) {
  const n = (level ?? "normal") as NotificationImportance;
  switch (n) {
    case "low":
      return {
        shell: cn(
          "rounded-2xl overflow-hidden",
          "border border-slate-300/28 dark:border-slate-500/20",
          "border-l-[2.5px] border-l-slate-500/90 dark:border-l-slate-300/88",
          "bg-gradient-to-br from-sky-100/16 via-slate-100/10 to-slate-300/8 " +
            "dark:from-slate-500/12 dark:via-slate-800/10 dark:to-slate-900/8",
          glassShadow,
        ),
        hairline:
          "border-b border-slate-400/12 bg-white/[0.05] dark:border-white/[0.06] dark:bg-slate-900/8",
        icon: "text-slate-600 dark:text-slate-300",
        title:
          "text-slate-900/95 [text-shadow:0_1px_0_rgba(255,255,255,0.45)] dark:text-slate-50",
        text: "text-slate-800/95 dark:text-slate-100/95",
        muted: "text-slate-600/88 dark:text-slate-300/85",
      };
    case "normal":
      return {
        shell: cn(
          "rounded-2xl overflow-hidden",
          "border border-amber-300/26 dark:border-amber-600/20",
          "border-l-[2.5px] border-l-amber-500/90 dark:border-l-amber-300/88",
          "bg-gradient-to-br from-amber-200/16 from-20% via-amber-100/10 to-amber-300/12 " +
            "dark:from-amber-500/12 dark:via-amber-800/9 dark:to-amber-950/8",
          glassShadow,
        ),
        hairline:
          "border-b border-amber-500/12 bg-amber-50/10 dark:border-amber-400/8 dark:bg-amber-900/10",
        icon: "text-amber-700 dark:text-amber-300",
        title:
          "text-amber-950/95 [text-shadow:0_1px_0_rgba(255,255,255,0.4)] dark:text-amber-50",
        text: "text-amber-950/95 dark:text-amber-50/95",
        muted: "text-amber-900/80 dark:text-amber-100/80",
      };
    case "high":
      return {
        shell: cn(
          "rounded-2xl overflow-hidden",
          "border border-orange-300/28 dark:border-orange-500/22",
          "border-l-[2.5px] border-l-orange-500/90 dark:border-l-orange-300/88",
          "bg-gradient-to-br from-orange-200/17 from-20% via-orange-100/10 to-orange-300/12 " +
            "dark:from-orange-500/12 dark:via-orange-800/9 dark:to-orange-950/9",
          glassShadow,
        ),
        hairline:
          "border-b border-orange-500/12 bg-orange-50/8 dark:border-orange-400/8 dark:bg-orange-950/10",
        icon: "text-orange-700 dark:text-orange-300",
        title:
          "text-orange-950/95 [text-shadow:0_1px_0_rgba(255,255,255,0.4)] dark:text-orange-50",
        text: "text-orange-950/95 dark:text-orange-50/95",
        muted: "text-orange-900/80 dark:text-orange-100/80",
      };
    case "urgent":
      return {
        shell: cn(
          "rounded-2xl overflow-hidden",
          "border border-rose-300/26 dark:border-rose-500/22",
          "border-l-[2.5px] border-l-rose-500/90 dark:border-l-rose-300/88",
          "bg-gradient-to-br from-rose-200/18 from-20% via-rose-100/10 to-rose-300/12 " +
            "dark:from-rose-500/12 dark:via-rose-800/9 dark:to-rose-950/9",
          glassShadow,
        ),
        hairline:
          "border-b border-rose-500/12 bg-rose-50/8 dark:border-rose-400/8 dark:bg-rose-950/10",
        icon: "text-rose-700 dark:text-rose-300",
        title:
          "text-rose-950/95 [text-shadow:0_1px_0_rgba(255,255,255,0.4)] dark:text-rose-50",
        text: "text-rose-950/95 dark:text-rose-50/95",
        muted: "text-rose-900/80 dark:text-rose-100/80",
      };
    default:
      return postItImportanceClassNames("normal");
  }
}

/** Must match the floating `DraggableNote` outer: `w-64` in the app shell. */
export const postItCardWidthClass = "w-64 max-w-[min(16rem,calc(100vw-0.5rem))]";

/**
 * Shared top row: **fixed h-7** and identical padding so every notice (floating or in the
 * pinned list) has the same chrome. Use the same `hasDetails` / `expanded` pattern as
 * the floating post-it.
 */
export function postItFirstRowClassName(
  hairline: string,
  hasDetails: boolean,
  expanded: boolean,
) {
  return cn(
    "box-border flex h-7 w-full shrink-0 items-center gap-0.5 px-2 py-0",
    hairline,
    hasDetails && !expanded && "border-b-0",
  );
}
