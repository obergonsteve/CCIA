"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * §5 — offline-aware training surface: cached shell may load; remind users connectivity for fresh progress sync.
 */
export function OfflineTrainingBanner() {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    function up() {
      setOnline(true);
    }
    function down() {
      setOnline(false);
    }
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  if (online) {
    return null;
  }

  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>
        You appear offline. You can still review cached pages; progress and
        assessments sync when you reconnect.
      </span>
    </div>
  );
}
