"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "ccia_disable_admin_test";

type AdminTestModeValue = {
  disableAdmin: boolean;
  setDisableAdmin: (v: boolean) => void;
};

const AdminTestModeContext = createContext<AdminTestModeValue | null>(null);

export function AdminTestModeProvider({ children }: { children: ReactNode }) {
  const [disableAdmin, setDisableAdminState] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") {
        setDisableAdminState(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const setDisableAdmin = useCallback((v: boolean) => {
    setDisableAdminState(v);
    try {
      if (v) {
        localStorage.setItem(STORAGE_KEY, "1");
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(
    () => ({ disableAdmin, setDisableAdmin }),
    [disableAdmin, setDisableAdmin],
  );

  return (
    <AdminTestModeContext.Provider value={value}>
      {children}
    </AdminTestModeContext.Provider>
  );
}

export function useAdminTestMode(): AdminTestModeValue {
  const ctx = useContext(AdminTestModeContext);
  if (ctx == null) {
    return {
      disableAdmin: false,
      setDisableAdmin: () => {},
    };
  }
  return ctx;
}
