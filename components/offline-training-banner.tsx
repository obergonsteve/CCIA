"use client";

import { WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

/** SSR + first client paint must match; real `navigator.onLine` only after hydrate. */
function getServerOnlineSnapshot() {
  return true;
}

/**
 * §5 — offline-aware training surface: cached shell may load; remind users connectivity for fresh progress sync.
 */
export function OfflineTrainingBanner() {
  const online = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getServerOnlineSnapshot,
  );

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
