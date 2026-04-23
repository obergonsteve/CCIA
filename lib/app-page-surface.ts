import { cn } from "@/lib/utils";

/**
 * Diagonal page wash (lime → page surface → sky) for public and app shells.
 * Softer tints so dense pages (e.g. admin) stay readable; used site-wide.
 */
export const appPageGradientClass = cn(
  "bg-gradient-to-br from-brand-lime/12 via-background to-brand-sky/16",
  "dark:from-brand-lime/18 dark:via-background dark:to-brand-sky/24",
);
