import { appPageGradientClass } from "@/lib/app-page-surface";
import { cn } from "@/lib/utils";
import nextDynamic from "next/dynamic";
import type { ReactNode } from "react";
import { Suspense } from "react";

/** All routes here use Convex (`useQuery` under provider). Avoid static prerender at build when env may be unset. */
export const dynamic = "force-dynamic";

const loadingShell = (
  <div
    className={cn(
      "flex h-svh items-center justify-center text-sm text-muted-foreground",
      appPageGradientClass,
    )}
  >
    Loading…
  </div>
);

const ProtectedLayoutClient = nextDynamic(
  () =>
    import("./protected-layout-client").then(
      (m) => m.ProtectedLayoutClient,
    ),
  { loading: () => loadingShell },
);

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={loadingShell}>
      <ProtectedLayoutClient>{children}</ProtectedLayoutClient>
    </Suspense>
  );
}
