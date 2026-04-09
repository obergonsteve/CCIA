"use client";

import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";


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
  const client = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
    if (!url) {
      return null;
    }
    return new ConvexReactClient(url);
  }, []);

  // Avoid `new ConvexReactClient()` at module scope: `next build` prerenders
  // routes (e.g. /_not-found) where CI may not inject NEXT_PUBLIC_* yet.
  if (client === null) {
    if (typeof window !== "undefined") {
      console.error(
        "[convex] NEXT_PUBLIC_CONVEX_URL is not set. Add it in .env.local or your host (e.g. Vercel) Environment Variables.",
      );
    }
    return <>{children}</>;
  }

  return (
    <ConvexProviderWithAuth client={client} useAuth={useCookieConvexAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}
