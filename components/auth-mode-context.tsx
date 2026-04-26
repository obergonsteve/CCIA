"use client";

import type { AuthMode } from "@/lib/auth-mode";
import { createContext, useContext, type ReactNode } from "react";

const AuthModeContext = createContext<AuthMode>("legacy");

export function AuthModeProvider({
  mode,
  children,
}: {
  mode: AuthMode;
  children: ReactNode;
}) {
  return (
    <AuthModeContext.Provider value={mode}>{children}</AuthModeContext.Provider>
  );
}

export function useAuthModeContext(): AuthMode {
  return useContext(AuthModeContext);
}
