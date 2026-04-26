import { cn } from "@/lib/utils";

/**
 * Diagonal page wash: corners barely tinted, center is `background` — **same
 * corner strength** (light + dark) so the edge/center step stays minimal.
 * (Earlier versions mixed weak corners + stronger lime in dark, which *raised* contrast.)
 */
export const appPageGradientClass = cn(
  "bg-gradient-to-br from-brand-sky/4 via-background to-brand-lime/4",
  "dark:from-brand-sky/6 dark:via-background dark:to-brand-lime/6",
);
