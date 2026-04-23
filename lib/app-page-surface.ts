import { cn } from "@/lib/utils";

/**
 * Diagonal page wash (sky → page surface → lime) for public and app shells.
 * Softer tints so dense pages (e.g. admin) stay readable; used site-wide.
 */
export const appPageGradientClass = cn(
  "bg-gradient-to-br from-brand-sky/12 via-background to-brand-lime/16",
  "dark:from-brand-sky/18 dark:via-background dark:to-brand-lime/24",
);
