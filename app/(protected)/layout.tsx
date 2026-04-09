import { AppShell } from "@/components/layout/app-shell";
import type { ReactNode } from "react";

/** All routes here use Convex (`useQuery` under provider). Avoid static prerender at build when env may be unset. */
export const dynamic = "force-dynamic";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
