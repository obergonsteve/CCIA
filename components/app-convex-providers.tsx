"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { useMemo, type ReactNode } from "react";
import { AuthModeProvider } from "@/components/auth-mode-context";
import { ConvexClientProvider } from "@/components/convex-provider";
import { AdminTestModeProvider } from "@/lib/admin-test-mode-context";
import type { AuthMode } from "@/lib/auth-mode";

function makeClient(): ConvexReactClient | null {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
  if (!url) {
    return null;
  }
  return new ConvexReactClient(url);
}

/**
 * Picks legacy cookie-based Convex auth vs Convex Auth (JWT) based on `authMode`
 * (from env + cookie; see [lib/auth-mode.ts]).
 */
export function AppConvexProviders({
  authMode,
  children,
}: {
  authMode: AuthMode;
  children: ReactNode;
}) {
  const client = useMemo(() => makeClient(), []);

  if (client === null) {
    if (typeof window !== "undefined") {
      console.error(
        "[convex] NEXT_PUBLIC_CONVEX_URL is not set. Add it in .env.local or your host.",
      );
    }
    return (
      <AuthModeProvider mode={authMode}>
        <AdminTestModeProvider>{children}</AdminTestModeProvider>
      </AuthModeProvider>
    );
  }

  return (
    <AuthModeProvider mode={authMode}>
      <AdminTestModeProvider>
        {authMode === "convex" ? (
          <ConvexAuthNextjsProvider client={client}>
            {children}
          </ConvexAuthNextjsProvider>
        ) : (
          <ConvexClientProvider clientOverride={client}>
            {children}
          </ConvexClientProvider>
        )}
      </AdminTestModeProvider>
    </AuthModeProvider>
  );
}
