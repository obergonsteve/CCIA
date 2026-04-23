import { cn } from "@/lib/utils";

/**
 * Diagonal page wash (sky → page surface → lime) for public and app shells.
 * Low-opacity tints so the page stays light and airy.
 */
export const appPageGradientClass = cn(
  "bg-gradient-to-br from-brand-sky/12 via-background to-brand-lime/15",
  "dark:from-brand-sky/18 dark:via-background dark:to-brand-lime/22",
);
