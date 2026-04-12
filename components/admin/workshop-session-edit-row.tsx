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
import { cn } from "@/lib/utils";
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

  useEffect(() => {
    setStartsLocal(toLocalInputValue(session.startsAt));
    setEndsLocal(toLocalInputValue(session.endsAt));
    setStatus(session.status);
    setCapacity(session.capacity != null ? String(session.capacity) : "");
    setExternalUrl(session.externalJoinUrl ?? "");
  }, [
    session._id,
    session.startsAt,
    session.endsAt,
    session.status,
    session.capacity,
    session.externalJoinUrl,
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
          onChange={(e) => setStartsLocal(e.target.value)}
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
      <div className="space-y-1 sm:col-span-2">
        <Label className={compact ? "text-[11px]" : "text-xs"}>
          External URL
        </Label>
        <Input
          value={externalUrl}
          onChange={(e) => setExternalUrl(e.target.value)}
          placeholder="https://…"
          className={compact ? "h-8 text-xs" : undefined}
        />
      </div>
      <div className="sm:col-span-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className={compact ? "h-8 text-xs" : undefined}
          onClick={async () => {
            try {
              const startsAt = parseLocalInput(startsLocal);
              const endsAt = parseLocalInput(endsLocal);
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
