"use client";

import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Shield } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSessionUser } from "@/lib/use-session-user";
import type { AuthMode } from "@/lib/auth-mode";

const AUTH_MODE_LABEL: Record<AuthMode, string> = {
  legacy: "Legacy (session cookies + deployment user)",
  convex: "Convex Auth (JWT + per-user access)",
};

export function AdminAuthModePanel() {
  const { user, isLoading: userLoading } = useSessionUser();
  const settings = useQuery(api.appSettings.getAuthModeForUi);
  const setMode = useMutation(api.appSettings.setAuthMode);
  const [saving, setSaving] = useState(false);
  const [localMode, setLocalMode] = useState<AuthMode | null>(null);

  const canAccess =
    user?.role === "admin" || user?.role === "content_creator";
  const effective = settings?.effectiveMode ?? "legacy";
  const displayMode = localMode ?? effective;
  if (userLoading) {
    return null;
  }
  if (!canAccess) {
    return null;
  }

  async function save() {
    const m = localMode;
    if (m === null || m === effective) {
      return;
    }
    setSaving(true);
    try {
      await setMode({ authMode: m });
      const res = await fetch("/api/app-settings/mirror-cookie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ authMode: m }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error ?? "Could not set mirror cookie");
      }
      setLocalMode(null);
      toast.success("Authentication mode updated. You may need to sign in again.");
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border border-red-200/80 bg-red-50/50 ring-1 ring-red-200/60 dark:border-red-500/30 dark:bg-red-950/30 dark:ring-red-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-red-950 dark:text-red-100">
          <Shield className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden />
          Authentication
        </CardTitle>
        <CardDescription className="text-red-950/80 dark:text-red-100/80">
          Choose how sign-in is handled. Use legacy (session cookies) only as a
          temporary fallback while investigating Convex Auth issues.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2 min-w-0">
            <Label>Active mode</Label>
            <Select
              value={displayMode}
              onValueChange={(v) => setLocalMode(v as AuthMode)}
              disabled={saving || !canAccess}
            >
              <SelectTrigger
                className="h-auto min-h-8 w-full min-w-0 items-start py-2 whitespace-normal sm:!w-96"
              >
                <SelectValue className="!line-clamp-none text-left break-words whitespace-normal">
                  {AUTH_MODE_LABEL[displayMode]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="legacy">
                  {AUTH_MODE_LABEL.legacy}
                </SelectItem>
                <SelectItem value="convex">
                  {AUTH_MODE_LABEL.convex}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => void save()}
            disabled={
              saving || !canAccess || localMode === null || localMode === effective
            }
            className="shrink-0"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
        <div
          className="flex gap-2 rounded-md border border-red-200/70 bg-red-100/80 px-3 py-2 text-sm text-red-950 dark:border-red-500/35 dark:bg-red-500/15 dark:text-red-50"
          role="status"
        >
          <AlertTriangle
            className="h-4 w-4 shrink-0 text-red-600 dark:text-red-300"
            aria-hidden
          />
          <p>
            Switching modes can sign out active users or require a full page reload.
            Test on staging before using in production.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
