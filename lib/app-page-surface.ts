import { cn } from "@/lib/utils";

/**
 * Diagonal page wash: corners barely tinted, center is `background`. Light/dark
 * use matched relative opacity so the edge/center step stays minimal.
 */
export const appPageGradientClass = cn(
  "bg-gradient-to-br from-brand-sky/2 via-background to-brand-lime/2",
  "dark:from-brand-sky/4 dark:via-background dark:to-brand-lime/4",
);
