"use client";

import { sidebarMainPageHeading } from "@/lib/sidebar-nav";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

/**
 * On routes that map 1:1 to a sidebar item, shows the same icon + label as the nav.
 * Nested routes (e.g. a certification level) omit this.
 */
export function SidebarMainPageHeading() {
  const pathname = usePathname();
  const meta = sidebarMainPageHeading(pathname);
  if (!meta) {
    return null;
  }
  const Icon = meta.icon;
  return (
    <header className="flex items-start gap-3 pb-2">
      <span
        className={cn(
          "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-muted/30",
        )}
        aria-hidden
      >
        <Icon className={cn("h-5 w-5", meta.iconClassName)} />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {meta.label}
        </h1>
        {meta.subheading ? (
          <p className="text-sm leading-snug text-muted-foreground">
            {meta.subheading}
          </p>
        ) : null}
      </div>
    </header>
  );
}
