"use client";

import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkshopSyncTracePanel } from "@/components/workshop-sync-trace-panel";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { isMicrosoftTeamsSession } from "@/lib/workshopConference";
import { useQuery } from "convex/react";
import {
  parseLocalInput,
  toLocalInputValue,
} from "@/lib/workshop-datetime-local";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export type WorkshopSessionSaveArgs = {
  sessionId: Id<"workshopSessions">;
  startsAt: number;
  endsAt: number;
  status: "scheduled" | "cancelled";
  capacity: number | null;
  externalJoinUrl: string | null;
  conferenceProvider: "livekit" | "microsoft_teams";
  timeZone: string | null;
};

export function WorkshopSessionEditRow({
  session,
  onSave,
  compact = false,
}: {
  session: Doc<"workshopSessions">;
  onSave: (args: WorkshopSessionSaveArgs) => Promise<unknown>;
  /** Tighter layout for e.g. Edit unit dialog. */
  compact?: boolean;
}) {
  const [startsLocal, setStartsLocal] = useState(() =>
    toLocalInputValue(session.startsAt),
  );
  const [endsLocal, setEndsLocal] = useState(() =>
    toLocalInputValue(session.endsAt),
  );
  const [status, setStatus] = useState<"scheduled" | "cancelled">(
    session.status,
  );
  const [capacity, setCapacity] = useState(
    session.capacity != null ? String(session.capacity) : "",
  );
  const [externalUrl, setExternalUrl] = useState(session.externalJoinUrl ?? "");
  const [conferenceProvider, setConferenceProvider] = useState<
    "livekit" | "microsoft_teams"
  >(session.conferenceProvider ?? "livekit");
  const [timeZone, setTimeZone] = useState(
    session.timeZone ?? "Australia/Sydney",
  );
  const teamsSimulationOn = useQuery(
    api.workshops.workshopTeamsSimulationEnabled,
    {},
  );

  useEffect(() => {
    setStartsLocal(toLocalInputValue(session.startsAt));
    setEndsLocal(toLocalInputValue(session.endsAt));
    setStatus(session.status);
    setCapacity(session.capacity != null ? String(session.capacity) : "");
    setExternalUrl(session.externalJoinUrl ?? "");
    setConferenceProvider(session.conferenceProvider ?? "livekit");
    setTimeZone(session.timeZone ?? "Australia/Sydney");
  }, [
    session._id,
    session.startsAt,
    session.endsAt,
    session.status,
    session.capacity,
    session.externalJoinUrl,
    session.conferenceProvider,
    session.timeZone,
  ]);

  return (
    <div
      className={cn(
        "grid w-full gap-2",
        compact ? "sm:grid-cols-2" : "sm:max-w-xl sm:grid-cols-2",
      )}
    >
      <div className="space-y-1">
        <Label className={compact ? "text-[11px]" : "text-xs"}>Starts</Label>
        <Input
          type="datetime-local"
          value={startsLocal}
          onChange={(e) => {
            const v = e.target.value;
            setStartsLocal(v);
            if (!v || !endsLocal) {
              return;
            }
            try {
              const s = parseLocalInput(v);
              const eMs = parseLocalInput(endsLocal);
              if (eMs <= s) {
                const bump = new Date(s);
                bump.setHours(bump.getHours() + 1);
                setEndsLocal(toLocalInputValue(bump.getTime()));
              }
            } catch {
              /* wait for valid values on save */
            }
          }}
          className={compact ? "h-8 text-xs" : undefined}
        />
      </div>
      <div className="space-y-1">
        <Label className={compact ? "text-[11px]" : "text-xs"}>Ends</Label>
        <Input
          type="datetime-local"
          value={endsLocal}
          onChange={(e) => setEndsLocal(e.target.value)}
          className={compact ? "h-8 text-xs" : undefined}
        />
      </div>
      <div className="space-y-1">
        <Label className={compact ? "text-[11px]" : "text-xs"}>Status</Label>
        <Select
          value={status}
          onValueChange={(v) =>
            setStatus((v ?? "scheduled") as "scheduled" | "cancelled")
          }
        >
          <SelectTrigger className={compact ? "h-8 text-xs" : undefined}>
            <SelectValue>
              {status === "scheduled" ? "Scheduled" : "Cancelled"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="scheduled" label="Scheduled">
              Scheduled
            </SelectItem>
            <SelectItem value="cancelled" label="Cancelled">
              Cancelled
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className={compact ? "text-[11px]" : "text-xs"}>Capacity</Label>
        <Input
          type="number"
          min={1}
          placeholder="Unlimited"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          className={compact ? "h-8 text-xs" : undefined}
        />
      </div>
      <div className="space-y-1">
        <Label className={compact ? "text-[11px]" : "text-xs"}>
          Conference
        </Label>
        <Select
          value={conferenceProvider}
          onValueChange={(v) =>
            setConferenceProvider(
              (v ?? "livekit") as "livekit" | "microsoft_teams",
            )
          }
        >
          <SelectTrigger className={compact ? "h-8 text-xs" : undefined}>
            <SelectValue>
              {conferenceProvider === "microsoft_teams"
                ? "Microsoft Teams (Graph)"
                : "Embedded LiveKit"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="livekit" label="Embedded LiveKit">
              Embedded LiveKit
            </SelectItem>
            <SelectItem value="microsoft_teams" label="Microsoft Teams (Graph)">
              Microsoft Teams (Graph)
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      {isMicrosoftTeamsSession({ conferenceProvider }) ? (
        <div className="space-y-1">
          <Label className={compact ? "text-[11px]" : "text-xs"}>
            IANA time zone
          </Label>
          <Input
            value={timeZone}
            onChange={(e) => setTimeZone(e.target.value)}
            placeholder="Australia/Sydney"
            className={compact ? "h-8 text-xs" : undefined}
          />
        </div>
      ) : null}
      <div className="space-y-1 sm:col-span-2">
        <Label className={compact ? "text-[11px]" : "text-xs"}>
          External join URL (optional override)
        </Label>
        <Input
          value={externalUrl}
          onChange={(e) => setExternalUrl(e.target.value)}
          placeholder="Manual Teams link if Graph is not used"
          className={compact ? "h-8 text-xs" : undefined}
        />
      </div>
      {isMicrosoftTeamsSession(session) ? (
        <div className="space-y-0.5 sm:col-span-2 text-[11px] text-muted-foreground">
          {session.teamsGraphEventId ? (
            <p>Teams event synced (Graph id present).</p>
          ) : (
            <p>Teams meeting: creation runs shortly after save when using Graph.</p>
          )}
          {session.teamsLastSyncAt != null ? (
            <p>
              Last Graph sync:{" "}
              {new Date(session.teamsLastSyncAt).toLocaleString()}
            </p>
          ) : null}
          {session.teamsLastError && teamsSimulationOn !== true ? (
            <p className="text-destructive [overflow-wrap:anywhere]">
              Graph error: {session.teamsLastError}
            </p>
          ) : null}
          <WorkshopSyncTracePanel
            sessionId={session._id}
            className="sm:col-span-2"
            defaultOpen
          />
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className={compact ? "h-8 text-xs" : undefined}
          onClick={async () => {
            try {
              if (!startsLocal.trim() || !endsLocal.trim()) {
                toast.error("Set both start and end date and time.");
                return;
              }
              const startsAt = parseLocalInput(startsLocal);
              const endsAt = parseLocalInput(endsLocal);
              if (endsAt <= startsAt) {
                toast.error(
                  "End time must be after the start time. Adjust the end field or set end after you set start.",
                );
                return;
              }
              const capRaw = capacity.trim();
              let capacityArg: number | null = null;
              if (capRaw !== "") {
                const capNum = Number.parseInt(capRaw, 10);
                if (Number.isNaN(capNum) || capNum < 1) {
                  toast.error("Capacity must be a positive number");
                  return;
                }
                capacityArg = capNum;
              }
              await onSave({
                sessionId: session._id,
                startsAt,
                endsAt,
                status,
                capacity: capacityArg,
                externalJoinUrl: externalUrl.trim() || null,
                conferenceProvider,
                timeZone: timeZone.trim() || null,
              });
              toast.success("Session updated");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Failed");
            }
          }}
        >
          Save session
        </Button>
      </div>
    </div>
  );
}
