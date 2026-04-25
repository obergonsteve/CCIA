import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

/**
 * Row surface for **Admin → Students** only: pale gradient + left accent on the
 * neutral/slate parent card. Do **not** use inside a card that already has
 * a heavy brand-sky fill/border (e.g. company user list) — it doubles the treatment.
 */
export function AdminStudentDirectoryRow({
  className,
  children,
  ...rest
}: ComponentProps<"li">) {
  return (
    <li
      className={cn(
        "rounded-lg border border-slate-300/50 border-l-4 border-l-brand-sky/80 bg-gradient-to-br from-brand-sky/10 via-slate-50/95 to-brand-lime/12 shadow-sm",
        "dark:border-slate-600/50 dark:border-l-brand-sky/65 dark:from-brand-sky/[0.11] dark:via-slate-900/50 dark:to-brand-lime/[0.1] dark:shadow-none",
        className,
      )}
      {...rest}
    >
      {children}
    </li>
  );
}
