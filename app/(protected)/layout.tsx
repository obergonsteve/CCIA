import { AppShell } from "@/components/layout/app-shell";
import { appPageGradientClass } from "@/lib/app-page-surface";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { Suspense } from "react";

/** All routes here use Convex (`useQuery` under provider). Avoid static prerender at build when env may be unset. */
export const dynamic = "force-dynamic";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div
          className={cn(
            "flex h-svh items-center justify-center text-sm text-muted-foreground",
            appPageGradientClass,
          )}
        >
          Loading…
        </div>
      }
    >
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
