"use client";

import { useAuthModeContext } from "@/components/auth-mode-context";
import { api } from "@/convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { useEffect, useState } from "react";

export type SessionUser = {
  userId: string;
  email: string;
  name: string;
  role: "operator" | "supervisor" | "admin" | "content_creator";
  /** Omitted for student (non-member) accounts. */
  companyId?: string;
  /**
   * IANA time zone from the user’s company profile (`companies.timezone`), when set.
   * Use with `Intl` / date libraries for in-app local times; omit to use the browser default.
   */
  companyTimezone?: string;
};

/**
 * Logged-in user: legacy = httpOnly session cookie; Convex Auth = `users.me` with JWT.
 */
export function useSessionUser(): {
  user: SessionUser | null;
  isLoading: boolean;
} {
  const authMode = useAuthModeContext();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(
    api.users.me,
    authMode === "convex" && isAuthenticated && !authLoading
      ? {}
      : "skip",
  );
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const legacy = authMode === "legacy";
  const convex = authMode === "convex";

  useEffect(() => {
    if (convex) {
      if (authLoading) {
        setIsLoading(true);
        return;
      }
      if (!isAuthenticated) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      if (me === undefined) {
        setIsLoading(true);
        return;
      }
      if (me === null) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      setUser({
        userId: me._id,
        email: me.email,
        name: me.name,
        role: me.role,
        ...(me.companyId != null ? { companyId: me.companyId } : {}),
        ...(me.companyTimezone != null ? { companyTimezone: me.companyTimezone } : {}),
      });
      setIsLoading(false);
    }
  }, [convex, authLoading, isAuthenticated, me]);

  useEffect(() => {
    if (!legacy) {
      return;
    }
    let cancel = false;
    setIsLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/auth/session", { credentials: "include" });
        const data = (await res.json()) as { user: SessionUser | null };
        if (!cancel) {
          setUser(data.user);
        }
      } catch {
        if (!cancel) {
          setUser(null);
        }
      } finally {
        if (!cancel) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [legacy]);

  return { user, isLoading };
}
