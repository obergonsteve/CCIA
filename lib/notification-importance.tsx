import {
  AlertTriangle,
  Bell,
  Flame,
  Info,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NotificationImportance = "low" | "normal" | "high" | "urgent";

export const NOTIFICATION_IMPORTANCE: Record<
  NotificationImportance,
  { human: string; short: string; Icon: LucideIcon }
> = {
  low: { human: "Low importance", short: "Low", Icon: Info },
  normal: { human: "Normal", short: "Normal", Icon: Bell },
  high: { human: "High importance", short: "High", Icon: AlertTriangle },
  urgent: { human: "Urgent", short: "Urgent", Icon: Flame },
};

const ORDER: NotificationImportance[] = [
  "low",
  "normal",
  "high",
  "urgent",
];

/** Importance icon in the post-it header (sized for quick scanning). */
export function NotificationImportanceGlyph({
  level,
  className,
}: {
  level: NotificationImportance;
  className: string;
}) {
  const meta = NOTIFICATION_IMPORTANCE[level] ?? NOTIFICATION_IMPORTANCE.normal;
  const Icon = meta.Icon;
  return (
    <Icon
      className={cn("h-5 w-5 shrink-0 opacity-90", className)}
      aria-hidden
    />
  );
}

/** Legend row (e.g. under a test “importance” field). */
export function NotificationImportanceLegend({
  className,
}: {
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem] text-muted-foreground",
        className,
      )}
      aria-label="Icon key for importance"
    >
      {ORDER.map((key) => {
        const { short, human, Icon } = NOTIFICATION_IMPORTANCE[key];
        return (
          <li
            key={key}
            className="inline-flex items-center gap-1"
            title={human}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 text-foreground/80" />
            <span>{short}</span>
          </li>
        );
      })}
    </ul>
  );
}
