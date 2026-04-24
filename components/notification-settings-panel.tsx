"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQuery } from "convex/react";
import { Bell, CalendarClock, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSessionUser } from "@/lib/use-session-user";

function fromStoredHours(
  h: number,
): { value: number; unit: "hours" | "days" } {
  if (h >= 24 && h % 24 === 0) {
    return { unit: "days", value: h / 24 };
  }
  return { unit: "hours", value: h };
}

function toHours(value: number, unit: "hours" | "days") {
  return unit === "days" ? value * 24 : value;
}

const MAX_DAYS = 30;
const MAX_HOURS = 7 * 24;

export function NotificationSettingsPanel({ showIntro }: { showIntro?: boolean }) {
  const { user, isLoading: sessionLoading } = useSessionUser();
  const forUserId = (user?.userId ?? null) as Id<"users"> | null;
  const settings = useQuery(
    api.userNotificationSettings.get,
    forUserId ? { forUserId } : "skip",
  );
  const update = useMutation(api.userNotificationSettings.update);

  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState(24);
  const [unit, setUnit] = useState<"hours" | "days">("hours");
  const [almostThere, setAlmostThere] = useState(80);
  const [formBootstrapped, setFormBootstrapped] = useState(false);

  useEffect(() => {
    setFormBootstrapped(false);
  }, [forUserId]);

  useEffect(() => {
    if (!settings || formBootstrapped) return;
    const a = fromStoredHours(settings.webinarReminderHoursBefore);
    setValue(a.value);
    setUnit(a.unit);
    setAlmostThere(settings.unitAlmostTherePercent);
    setFormBootstrapped(true);
  }, [settings, formBootstrapped]);

  const maxLead =
    unit === "days" ? MAX_DAYS : Math.min(MAX_HOURS, MAX_DAYS * 24);

  async function handleSave() {
    if (!forUserId || !settings) return;
    const raw = toHours(value, unit);
    const hours = Math.min(30 * 24, Math.max(1, Math.round(raw)));
    setSaving(true);
    try {
      await update({
        forUserId,
        webinarReminderHoursBefore: hours,
        unitAlmostTherePercent: almostThere,
        notifyNewContentRoadmapOnly: settings.notifyNewContentRoadmapOnly,
      });
      toast.success("Notification settings saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (sessionLoading) {
    return (
      <p className="text-muted-foreground" role="status">
        Loading…
      </p>
    );
  }
  if (!user) {
    return (
      <p className="text-muted-foreground" role="status">
        You need to be signed in to change these settings.
      </p>
    );
  }
  if (settings === undefined) {
    return (
      <p className="text-muted-foreground" role="status">
        Loading notification settings…
      </p>
    );
  }
  if (settings === null) {
    return (
      <p className="text-muted-foreground" role="status">
        Could not load your notification preferences.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {showIntro !== false ? (
        <p className="text-muted-foreground max-w-2xl">
          Control in-app post-it reminders: webinar timing, progress nudges, and
          new content alerts (when those features run for your account).
        </p>
      ) : null}

      <section
        aria-label="Notification preferences"
        className="max-w-2xl space-y-6 rounded-lg border border-brand-sky/40 bg-brand-sky/[0.08] p-4 shadow-sm ring-1 ring-brand-sky/15 sm:p-5 dark:border-brand-sky/45 dark:bg-brand-sky/[0.12] dark:ring-brand-sky/20"
      >
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Bell
              className="h-5 w-5 shrink-0 text-brand-sky"
              aria-hidden
            />
            Notifications
          </h2>
          {showIntro === false ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Webinar reminders and progress nudges.
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
        <Card
          className={cn(
            "border border-violet-300/50 bg-gradient-to-br from-violet-50/90 via-fuchsia-50/50 to-purple-50/50 ring-1 ring-violet-200/50 dark:border-violet-500/40 dark:from-violet-950/45 dark:via-fuchsia-950/28 dark:to-purple-950/22 dark:ring-violet-500/25",
          )}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarClock
                className="h-5 w-5 text-violet-600 dark:text-violet-300"
                aria-hidden
              />
              Webinar you registered for
            </CardTitle>
            <CardDescription>
              In-app post-it for webinars you&apos;re registered for. Pick how
              long before the live session you want a heads-up.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="flex max-w-2xl flex-wrap items-baseline gap-x-2 gap-y-2.5 text-sm leading-relaxed"
              role="group"
              aria-label="Time before a registered webinar to show a reminder"
            >
              <span className="shrink-0 text-foreground">Remind me</span>
              <Input
                id="ns-lead-amount"
                type="number"
                min={1}
                max={maxLead}
                value={value}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isNaN(n)) return;
                  setValue(Math.min(maxLead, Math.max(1, n)));
                }}
                className="h-9 w-16 min-w-0 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-label="How many (hours or days, next control)"
                autoComplete="off"
              />
              <div className="w-[5.75rem] shrink-0 sm:w-28">
                <Select
                  value={unit}
                  onValueChange={(v) => {
                    if (v !== "hours" && v !== "days") return;
                    setUnit(v);
                    if (v === "days" && value > MAX_DAYS) {
                      setValue(MAX_DAYS);
                    }
                    if (v === "hours" && value > MAX_HOURS) {
                      setValue(MAX_HOURS);
                    }
                  }}
                >
                  <SelectTrigger
                    id="ns-lead-unit"
                    className="h-9 w-full"
                    aria-label="Count in hours or days"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">hour(s)</SelectItem>
                    <SelectItem value="days">day(s)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <span className="shrink-0 text-muted-foreground">
                before the session starts.
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp
                className="h-5 w-5 text-brand-lime"
                aria-hidden
              />
              &quot;Almost there!&quot; on your progress
            </CardTitle>
            <CardDescription>
              When your completion for a unit hits this high, we can show an
              encouraging nudge in the app.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="ns-almost-pct"
                type="number"
                min={50}
                max={99}
                value={almostThere}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isNaN(n)) return;
                  setAlmostThere(Math.min(99, Math.max(50, Math.round(n))));
                }}
                className="w-20"
                aria-label="Show nudge at this percent of unit completion"
              />
              <span className="text-sm text-muted-foreground">% complete</span>
            </div>
          </CardContent>
        </Card>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="min-w-[7rem] border-0 bg-brand-sky font-semibold text-white shadow-md hover:bg-brand-sky/90 w-fit"
          >
            {saving ? "Saving…" : "Save notification settings"}
          </Button>
        </div>
      </section>
    </div>
  );
}
