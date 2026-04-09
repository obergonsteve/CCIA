"use client";

import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;

const convex = new ConvexReactClient(convexUrl);

function useCookieConvexAuth() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/session", { credentials: "include" });
        const data = (await res.json()) as { user: unknown };
        if (!cancelled) {
          setIsAuthenticated(Boolean(data.user));
        }
      } catch {
        if (!cancelled) {
          setIsAuthenticated(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchAccessToken = useCallback(
    async (args: { forceRefreshToken: boolean }) => {
      if (args.forceRefreshToken) {
        await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
        });
      }
      const res = await fetch("/api/auth/convex-token", {
        credentials: "include",
      });
      if (!res.ok) {
        return null;
      }
      const data = (await res.json()) as { token: string | null };
      return data.token;
    },
    [],
  );

  return {
    isLoading,
    isAuthenticated,
    fetchAccessToken,
  };
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useCookieConvexAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}
