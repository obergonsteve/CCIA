import { cn } from "@/lib/utils";

/**
 * Diagonal page wash (lime → page surface → sky) for public and app shells.
 * Use on full-page columns or <main> so the gradient is consistent site-wide.
 */
export const appPageGradientClass = cn(
  "bg-gradient-to-br from-brand-lime/25 via-background to-brand-sky/30",
  "dark:from-brand-lime/35 dark:via-background dark:to-brand-sky/40",
);
