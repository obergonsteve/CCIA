"use client";

import { useEffect, useState } from "react";

export type SessionUser = {
  userId: string;
  email: string;
  name: string;
  role: "operator" | "supervisor" | "admin" | "content_creator";
  companyId: string;
};

/**
 * Logged-in user from the httpOnly session cookie (see `/api/auth/session`).
 * Convex `users.me` is not per-browser login in this app — use this for display.
 */
export function useSessionUser(): {
  user: SessionUser | null;
  isLoading: boolean;
} {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    let cancel = false;
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
  }, []);
  return { user, isLoading };
}
