"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    function onBip(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (!deferred || dismissed) {
    return null;
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-foreground">
        Install the Land Lease Living Training app for quicker access on site.
      </span>
      <Button
        size="sm"
        className="gap-1"
        onClick={async () => {
          await deferred.prompt();
          await deferred.userChoice;
          setDeferred(null);
        }}
      >
        <Download className="h-4 w-4" />
        Install
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
        Not now
      </Button>
    </div>
  );
}
