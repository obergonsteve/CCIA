"use client";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkshopPlannerCalendar } from "@/components/admin/workshop-planner-calendar";
import { useMutation, useQuery } from "convex/react";
import { format, isSameDay, startOfDay } from "date-fns";
import { useMemo, useState } from "react";
import { toast } from "sonner";

function toLocalInputValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseLocalInput(s: string): number {
  const t = Date.parse(s);
  if (Number.isNaN(t)) {
    throw new Error("Invalid date/time");
  }
  return t;
}

type UpdateSessionArgs = {
  sessionId: Id<"workshopSessions">;
  startsAt: number;
  endsAt: number;
  status: "scheduled" | "cancelled";
  capacity: number | null;
  externalJoinUrl: string | null;
};

export default function AdminWorkshopsClient() {
  const sessions = useQuery(api.workshops.listSessionsAdmin);
  const liveUnits = useQuery(api.workshops.listLiveWorkshopUnitsAdmin);
  const createSession = useMutation(api.workshops.createSession);
  const updateSession = useMutation(api.workshops.updateSession);
  const backfillTiers = useMutation(api.workshops.backfillCertificationTiers);

  const [unitId, setUnitId] = useState<string>("");
  const [startsLocal, setStartsLocal] = useState(() =>
    toLocalInputValue(Date.now() + 86400000),
  );
  const [endsLocal, setEndsLocal] = useState(() =>
    toLocalInputValue(Date.now() + 86400000 + 3600000),
  );
  const [capacity, setCapacity] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [plannerSelectedDay, setPlannerSelectedDay] = useState(() =>
    startOfDay(new Date()),
  );

  const sortedSessions = useMemo(() => {
    if (!sessions) {
      return [];
    }
    return [...sessions].sort((a, b) => a.startsAt - b.startsAt);
  }, [sessions]);

  const sessionsOnPlannerDay = useMemo(() => {
    return sortedSessions.filter((s) =>
      isSameDay(new Date(s.startsAt), plannerSelectedDay),
    );
  }, [sortedSessions, plannerSelectedDay]);

  const calendarMarkers = useMemo(
    () =>
      sortedSessions.map((s) => ({
        startsAt: s.startsAt,
        status: s.status,
      })),
    [sortedSessions],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Timetable</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Schedule live sessions for units marked as{" "}
          <span className="font-medium text-foreground">Live workshop</span> in
          Training Content. Learners register in the Workshops area.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Backfill certification tiers</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sets missing certification rows to Bronze (safe to run more than
            once).
          </p>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              try {
                const r = await backfillTiers({});
                toast.success(`Updated ${r.patched} certification(s).`);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
              }
            }}
          >
            Run tier backfill
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">New session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Workshop unit</Label>
              {liveUnits === undefined ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : liveUnits.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No live workshop units yet. Edit a unit in Training Content and
                  set delivery to Live workshop.
                </p>
              ) : (
                <Select
                  value={unitId || "__none__"}
                  onValueChange={(v) =>
                    setUnitId(v === "__none__" ? "" : (v ?? ""))
                  }
                  itemToStringLabel={(v) => {
                    if (v == null || v === "" || v === "__none__") {
                      return "Select unit…";
                    }
                    const u = liveUnits.find((x) => x._id === v);
                    return u?.title ?? String(v);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" label="Select unit…">
                      Select unit…
                    </SelectItem>
                    {liveUnits.map((u) => (
                      <SelectItem key={u._id} value={u._id} label={u.title}>
                        {u.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="ws-start">Starts</Label>
              <Input
                id="ws-start"
                type="datetime-local"
                value={startsLocal}
                onChange={(e) => setStartsLocal(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ws-end">Ends</Label>
              <Input
                id="ws-end"
                type="datetime-local"
                value={endsLocal}
                onChange={(e) => setEndsLocal(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ws-cap">Capacity (optional)</Label>
              <Input
                id="ws-cap"
                type="number"
                min={1}
                placeholder="Unlimited if empty"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="ws-url">External join URL (optional)</Label>
              <Input
                id="ws-url"
                placeholder="https://… until LiveKit is wired"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
              />
            </div>
          </div>
          <Button
            type="button"
            onClick={async () => {
              if (!unitId) {
                toast.error("Select a workshop unit");
                return;
              }
              try {
                const startsAt = parseLocalInput(startsLocal);
                const endsAt = parseLocalInput(endsLocal);
                const capRaw = capacity.trim();
                const cap =
                  capRaw === "" ? undefined : Number.parseInt(capRaw, 10);
                if (capRaw !== "" && (Number.isNaN(cap!) || cap! < 1)) {
                  toast.error("Capacity must be a positive number");
                  return;
                }
                await createSession({
                  workshopUnitId: unitId as Id<"units">,
                  startsAt,
                  endsAt,
                  capacity: cap,
                  externalJoinUrl: externalUrl.trim() || undefined,
                });
                toast.success("Session created");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
              }
            }}
          >
            Create session
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Workshop calendar</CardTitle>
          <p className="text-sm text-muted-foreground">
            Pick a date to see scheduled sessions for that day (by start time in
            your local timezone).
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,17rem)_1fr] lg:items-start">
            <WorkshopPlannerCalendar
              sessions={calendarMarkers}
              selectedDay={plannerSelectedDay}
              onSelectDay={(d) => {
                if (d != null) {
                  setPlannerSelectedDay(startOfDay(d));
                }
              }}
            />
            <div className="min-w-0 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                {format(plannerSelectedDay, "EEEE, d MMMM yyyy")}
              </h3>
              {sessions === undefined ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : sessionsOnPlannerDay.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No workshop sessions start on this date.
                </p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {sessionsOnPlannerDay.map((s) => (
                    <SessionAdminRow
                      key={s._id}
                      row={s}
                      onSave={(args: UpdateSessionArgs) => updateSession(args)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Scheduled sessions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Full list in chronological order (all dates).
          </p>
        </CardHeader>
        <CardContent>
          {sessions === undefined ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : sortedSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions yet.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {sortedSessions.map((s) => (
                <SessionAdminRow
                  key={s._id}
                  row={s}
                  onSave={(args: UpdateSessionArgs) => updateSession(args)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SessionAdminRow({
  row,
  onSave,
}: {
  row: Doc<"workshopSessions"> & {
    workshopTitle: string;
    registrationCount: number;
  };
  onSave: (args: UpdateSessionArgs) => Promise<unknown>;
}) {
  const [startsLocal, setStartsLocal] = useState(() =>
    toLocalInputValue(row.startsAt),
  );
  const [endsLocal, setEndsLocal] = useState(() =>
    toLocalInputValue(row.endsAt),
  );
  const [status, setStatus] = useState<"scheduled" | "cancelled">(row.status);
  const [capacity, setCapacity] = useState(
    row.capacity != null ? String(row.capacity) : "",
  );
  const [externalUrl, setExternalUrl] = useState(row.externalJoinUrl ?? "");

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="font-medium leading-snug">{row.workshopTitle}</p>
        <p className="text-xs text-muted-foreground">
          {row.registrationCount} registration
          {row.registrationCount === 1 ? "" : "s"} ·{" "}
          <span className="font-mono text-[11px]">{row._id}</span>
        </p>
      </div>
      <div className="grid w-full gap-2 sm:max-w-xl sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Starts</Label>
          <Input
            type="datetime-local"
            value={startsLocal}
            onChange={(e) => setStartsLocal(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Ends</Label>
          <Input
            type="datetime-local"
            value={endsLocal}
            onChange={(e) => setEndsLocal(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select
            value={status}
            onValueChange={(v) =>
              setStatus((v ?? "scheduled") as "scheduled" | "cancelled")
            }
          >
            <SelectTrigger>
              <SelectValue />
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
          <Label className="text-xs">Capacity</Label>
          <Input
            type="number"
            min={1}
            placeholder="Unlimited"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">External URL</Label>
          <Input
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>
        <div className="sm:col-span-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={async () => {
              try {
                const startsAt = parseLocalInput(startsLocal);
                const endsAt = parseLocalInput(endsLocal);
                const capRaw = capacity.trim();
                const capNum =
                  capRaw === "" ? null : Number.parseInt(capRaw, 10);
                if (
                  capRaw !== "" &&
                  (Number.isNaN(capNum!) || capNum! < 1)
                ) {
                  toast.error("Capacity must be a positive number");
                  return;
                }
                await onSave({
                  sessionId: row._id,
                  startsAt,
                  endsAt,
                  status,
                  capacity: capNum,
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
    </li>
  );
}
