import { AppShell } from "@/components/layout/app-shell";
import type { ReactNode } from "react";
import { Suspense } from "react";

/** All routes here use Convex (`useQuery` under provider). Avoid static prerender at build when env may be unset. */
export const dynamic = "force-dynamic";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-svh items-center justify-center bg-background text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
