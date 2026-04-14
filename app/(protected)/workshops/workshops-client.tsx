"use client";

import { api } from "@/convex/_generated/api";
import type { WorkshopBrowseRow } from "@/convex/workshops";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { format, isSameDay } from "date-fns";
import { ExternalLink, MessageSquare, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

/** Date + hours:minutes only (no seconds). Same calendar day → one date, two times. */
function formatWorkshopSessionRange(startMs: number, endMs: number): string {
  const start = new Date(startMs);
  const end = new Date(endMs);
  const startTime = format(start, "HH:mm");
  const endTime = format(end, "HH:mm");
  if (isSameDay(start, end)) {
    return `${format(start, "dd/MM/yyyy")}, ${startTime} — ${endTime}`;
  }
  return `${format(start, "dd/MM/yyyy")}, ${startTime} — ${format(end, "dd/MM/yyyy")}, ${endTime}`;
}

function workshopClosedReplayHref(
  unitId: Id<"units">,
  sessionId: Id<"workshopSessions">,
  levelId: Id<"certificationLevels"> | null,
): string {
  const q = new URLSearchParams();
  q.set("session", sessionId);
  if (levelId) {
    q.set("level", levelId);
  }
  return `/units/${unitId}?${q.toString()}`;
}

type LiveWorkshopSessionTimes = Pick<
  Doc<"workshopSessions">,
  "startsAt" | "endsAt" | "status" | "liveRoomOpenedAt"
>;

function liveWorkshopSessionStatus(
  session: LiveWorkshopSessionTimes,
  now: number,
): {
  label: string;
  detail?: string;
  tone: "neutral" | "waiting" | "live" | "ended";
} {
  if (session.status === "cancelled") {
    return { label: "Cancelled", tone: "ended" };
  }
  if (now >= session.endsAt) {
    return { label: "Closed", tone: "ended" };
  }
  if (now < session.startsAt) {
    return { label: "Not started", tone: "neutral" };
  }
  if (session.liveRoomOpenedAt != null) {
    return {
      label: "In progress",
      detail: `Started ${format(new Date(session.liveRoomOpenedAt), "dd/MM/yyyy, HH:mm")}`,
      tone: "live",
    };
  }
  return {
    label: "In progress",
    detail: "Live room not open yet",
    tone: "waiting",
  };
}

function liveWorkshopStatusBadgeClass(
  tone: "neutral" | "waiting" | "live" | "ended",
  neutralAccent: "purple" | "sky" = "purple",
) {
  switch (tone) {
    case "live":
      return "border-emerald-600/45 bg-emerald-600/12 text-emerald-950 dark:border-emerald-400/50 dark:bg-emerald-500/15 dark:text-emerald-50";
    case "waiting":
      return "border-amber-600/40 bg-amber-500/12 text-amber-950 dark:border-amber-400/45 dark:bg-amber-500/14 dark:text-amber-50";
    case "ended":
      return "border-border/70 bg-muted/90 text-muted-foreground dark:bg-muted/50";
    default:
      if (neutralAccent === "sky") {
        return "border-sky-500/45 bg-sky-500/12 text-sky-950 dark:border-sky-400/50 dark:bg-sky-500/16 dark:text-sky-50";
      }
      return "border-purple-500/40 bg-purple-500/10 text-purple-900 dark:border-purple-400/45 dark:bg-purple-500/15 dark:text-purple-100";
  }
}

function WorkshopSessionStatusRow({
  session,
  now,
  neutralAccent = "purple",
}: {
  session: LiveWorkshopSessionTimes;
  now: number;
  neutralAccent?: "purple" | "sky";
}) {
  const status = liveWorkshopSessionStatus(session, now);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
      <Badge
        variant="outline"
        className={cn(
          "px-2 py-0 text-[10px] font-bold uppercase tracking-wide",
          liveWorkshopStatusBadgeClass(status.tone, neutralAccent),
        )}
      >
        {status.label}
      </Badge>
      {status.detail ? (
        <span className="text-[11px] leading-tight text-muted-foreground">
          {status.detail}
        </span>
      ) : null}
    </div>
  );
}

/** Open session on cert path — register only (no duplicate “Registered” badge). */
function OpenCertPathSessionCard({
  session,
  now,
  onRegister,
}: {
  session: WorkshopBrowseRow;
  now: number;
  onRegister: () => void;
}) {
  return (
    <Card
      size="sm"
      className="border border-sky-500/30 bg-sky-500/[0.05] shadow-sm dark:border-sky-400/25 dark:bg-sky-500/[0.09]"
    >
      <CardHeader className="py-2">
        <CardTitle className="text-base font-medium">
          {session.workshopTitle}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {formatWorkshopSessionRange(session.startsAt, session.endsAt)}
        </p>
        <WorkshopSessionStatusRow
          session={session}
          now={now}
          neutralAccent="sky"
        />
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 pb-2">
        <Button
          type="button"
          size="sm"
          className="bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
          disabled={session.full}
          onClick={onRegister}
        >
          {session.full ? "Full" : "Register"}
        </Button>
        {session.externalJoinUrl ? (
          <Link
            href={session.externalJoinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "inline-flex gap-1 text-sky-800 hover:bg-sky-500/15 hover:text-sky-950 dark:text-sky-200 dark:hover:bg-sky-500/20 dark:hover:text-sky-50",
            )}
          >
            Join link
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Your registration on a certification-path workshop (single place — no third list). */
function RegisteredCertPathWorkshopCard({
  session,
  workshopTitle,
  past,
  now,
  onUnregister,
}: {
  session: Doc<"workshopSessions">;
  workshopTitle: string;
  past: boolean;
  now: number;
  onUnregister: () => void;
}) {
  return (
    <Card
      size="sm"
      className={cn(
        "border border-purple-200/90 bg-purple-50 shadow-sm dark:border-purple-800/85 dark:bg-purple-950",
        past && "border-dashed opacity-80",
      )}
    >
      <Link
        href={`/units/${session.workshopUnitId}`}
        className={cn(
          "group block rounded-t-xl outline-none transition-colors",
          "hover:bg-purple-100/95 focus-visible:bg-purple-100/95 focus-visible:ring-2 focus-visible:ring-purple-500/40 focus-visible:ring-offset-2 dark:hover:bg-purple-900/75 dark:focus-visible:bg-purple-900/75",
        )}
        aria-label={`Open workshop unit: ${workshopTitle}`}
      >
        <CardHeader className="py-2">
          <CardTitle className="text-base font-medium text-foreground underline-offset-4 group-hover:underline">
            {workshopTitle}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {formatWorkshopSessionRange(session.startsAt, session.endsAt)}
            {past ? " · Past" : ""}
          </p>
          <WorkshopSessionStatusRow session={session} now={now} />
        </CardHeader>
      </Link>
      <CardContent className="flex flex-wrap gap-2 pb-2">
        {session.externalJoinUrl && !past ? (
          <Link
            href={session.externalJoinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "inline-flex gap-1.5 border-purple-500/30 bg-purple-500/10 text-purple-950 hover:bg-purple-500/18 dark:border-purple-400/25 dark:bg-purple-500/15 dark:text-purple-50 dark:hover:bg-purple-500/22",
            )}
          >
            Open join link
            <ExternalLink className="h-3.5 w-3.5 text-purple-700 dark:text-purple-300" />
          </Link>
        ) : !past ? (
          <Link
            href={`/units/${session.workshopUnitId}`}
            title="Open unit page — Live workshop (video, chat, screen share)"
            aria-label="Open unit page — Live workshop (video, chat, screen share)"
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "max-w-full rounded-full border-purple-500/35 bg-purple-500/10 px-3 font-medium text-purple-950 shadow-sm hover:bg-purple-500/18 dark:border-purple-400/40 dark:bg-purple-500/15 dark:text-purple-50 dark:hover:bg-purple-500/24",
            )}
          >
            <Video
              className="h-3.5 w-3.5 text-purple-700 dark:text-purple-300"
              aria-hidden
            />
            <span className="truncate">Open unit · Live workshop</span>
          </Link>
        ) : null}
        {!past && session.status === "scheduled" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-purple-500/40 text-purple-900 hover:bg-purple-500/10 dark:border-purple-400/45 dark:text-purple-100 dark:hover:bg-purple-500/15"
            onClick={onUnregister}
          >
            Unregister
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Ended certification-path session — open the unit with `?session=` to load that run’s chat & whiteboard. */
function ClosedCertPathWorkshopCard({
  session,
  workshopTitle,
  levelId,
}: {
  session: Doc<"workshopSessions">;
  workshopTitle: string;
  levelId: Id<"certificationLevels"> | null;
}) {
  const href = workshopClosedReplayHref(
    session.workshopUnitId,
    session._id,
    levelId,
  );
  return (
    <Card
      size="sm"
      className="border border-slate-300/90 bg-slate-50 shadow-sm dark:border-slate-700/90 dark:bg-slate-950"
    >
      <CardHeader className="py-2">
        <CardTitle className="text-base font-medium text-foreground">
          {workshopTitle}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {formatWorkshopSessionRange(session.startsAt, session.endsAt)}
        </p>
        <Badge
          variant="outline"
          className="mt-1 w-fit border-slate-400/60 bg-slate-200/40 px-2 py-0 text-[10px] font-bold uppercase tracking-wide text-slate-800 dark:border-slate-500/50 dark:bg-slate-800/50 dark:text-slate-100"
        >
          Closed
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 pb-2">
        <Link
          href={href}
          title="Open this workshop unit with session chat and whiteboard"
          aria-label={`Open unit for closed workshop: ${workshopTitle}`}
          className={cn(
            buttonVariants({ variant: "secondary", size: "sm" }),
            "inline-flex max-w-full gap-1.5 rounded-full border-slate-400/45 bg-slate-200/50 px-3 font-medium text-slate-900 shadow-sm hover:bg-slate-200/80 dark:border-slate-500/50 dark:bg-slate-800/60 dark:text-slate-50 dark:hover:bg-slate-800/85",
          )}
        >
          <MessageSquare
            className="h-3.5 w-3.5 shrink-0 text-slate-700 dark:text-slate-300"
            aria-hidden
          />
          <span className="truncate">Open unit · chat & whiteboard</span>
        </Link>
      </CardContent>
    </Card>
  );
}

export default function WorkshopsClient() {
  const searchParams = useSearchParams();
  const filterUnitIdRaw = searchParams.get("unit");
  const filterLevelIdRaw = searchParams.get("level");
  const filterUnitId =
    filterUnitIdRaw && filterUnitIdRaw.length > 0
      ? (filterUnitIdRaw as Id<"units">)
      : null;
  const filterLevelId =
    filterLevelIdRaw && filterLevelIdRaw.length > 0
      ? (filterLevelIdRaw as Id<"certificationLevels">)
      : null;

  const upcomingPath = useQuery(api.workshops.listUpcomingOnMyCertificationPath, {
    certificationTier: "all",
  });
  const registeredOnPath = useQuery(
    api.workshops.myRegistrationsOnCertificationPath,
  );
  const filterUnit = useQuery(
    api.units.get,
    filterUnitId ? { unitId: filterUnitId } : "skip",
  );
  const register = useMutation(api.workshops.registerForSession);
  const unregister = useMutation(api.workshops.unregisterFromSession);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const upcomingFiltered = useMemo(() => {
    if (!upcomingPath) {
      return undefined;
    }
    if (!filterUnitId) {
      return upcomingPath;
    }
    return upcomingPath.filter((s) => s.workshopUnitId === filterUnitId);
  }, [upcomingPath, filterUnitId]);

  const registeredOnPathFiltered = useMemo(() => {
    if (!registeredOnPath) {
      return undefined;
    }
    if (!filterUnitId) {
      return registeredOnPath;
    }
    return registeredOnPath.filter(
      ({ session }) => session.workshopUnitId === filterUnitId,
    );
  }, [registeredOnPath, filterUnitId]);

  const registeredActiveFiltered = useMemo(() => {
    if (!registeredOnPathFiltered) {
      return undefined;
    }
    return registeredOnPathFiltered.filter(
      ({ past, session }) => !past && session.status === "scheduled",
    );
  }, [registeredOnPathFiltered]);

  const closedWorkshopsFiltered = useMemo(() => {
    if (!registeredOnPathFiltered) {
      return undefined;
    }
    const rows = registeredOnPathFiltered.filter(
      ({ past, session }) => past && session.status === "scheduled",
    );
    rows.sort((a, b) => b.session.endsAt - a.session.endsAt);
    return rows;
  }, [registeredOnPathFiltered]);

  const openSessionsNeedRegister = useMemo(
    () => upcomingFiltered?.filter((s) => !s.registered) ?? [],
    [upcomingFiltered],
  );

  const pathListsReady =
    registeredOnPath !== undefined && upcomingPath !== undefined;

  const certPathHref =
    filterLevelId != null
      ? `/certifications/${filterLevelId}#certification-path`
      : "/certifications";

  return (
    <div className="mx-auto max-w-4xl space-y-3 px-3 pb-4 pt-0 sm:px-4 sm:pb-6 sm:pt-1">
      {filterUnitId ? (
        <div
          className="flex flex-col gap-3 rounded-xl border border-purple-500/35 bg-purple-500/[0.06] px-4 py-3 dark:border-purple-400/30 dark:bg-purple-500/[0.08] sm:flex-row sm:items-start sm:justify-between"
          role="region"
          aria-label="Filtered workshop unit"
        >
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {filterUnit === undefined
                ? "Loading this workshop…"
                : filterUnit === null
                  ? "Workshop unit unavailable"
                  : filterUnit.title}
            </p>
            <p className="text-sm text-muted-foreground">
              Register in{" "}
              <span className="font-medium text-foreground">
                Not registered yet
              </span>
              , or unregister from{" "}
              <span className="font-medium text-foreground">Registered</span> to
              pick another date.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-purple-500/40 text-purple-900 hover:bg-purple-500/10 dark:border-purple-400/45 dark:text-purple-100 dark:hover:bg-purple-500/15"
              nativeButton={false}
              render={<Link href="/workshops" />}
            >
              All workshops
            </Button>
            {filterLevelId ? (
              <Button
                variant="secondary"
                size="sm"
                className="border border-purple-500/30 bg-purple-500/15 text-purple-950 hover:bg-purple-500/22 dark:border-purple-400/25 dark:bg-purple-500/20 dark:text-purple-50 dark:hover:bg-purple-500/28"
                nativeButton={false}
                render={<Link href={certPathHref} />}
              >
                Certification path
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <section
        id="workshop-upcoming-sessions"
        className="scroll-mt-24 space-y-3"
        aria-label="Workshop sessions on your certifications"
      >
        {!pathListsReady ? (
          <p className="text-sm text-purple-900/70 dark:text-purple-200/75">
            Loading…
          </p>
        ) : (
          <div className="space-y-4">
            <div
              className="flex min-h-[4rem] flex-col gap-2 rounded-xl border-2 border-amber-500/45 bg-amber-500/[0.08] p-3 dark:border-amber-400/40 dark:bg-amber-500/[0.11]"
              aria-labelledby="workshop-list-registered-heading"
            >
              <h3
                id="workshop-list-registered-heading"
                className="text-base font-semibold text-amber-950 dark:text-amber-50"
              >
                Registered
              </h3>
              {!registeredActiveFiltered ||
              registeredActiveFiltered.length === 0 ? (
                <p className="text-sm text-amber-950/80 dark:text-amber-100/85">
                  No upcoming registrations on your certification path
                  {filterUnitId ? " for this unit" : ""} yet.
                </p>
              ) : (
                <ul className="grid list-none grid-cols-1 gap-2 p-0 md:grid-cols-2">
                  {registeredActiveFiltered.map(
                    ({ session, workshopTitle, past }) => (
                      <li key={session._id} className="min-w-0">
                        <RegisteredCertPathWorkshopCard
                          session={session}
                          workshopTitle={workshopTitle}
                          past={past}
                          now={now}
                          onUnregister={() => {
                            void (async () => {
                              try {
                                await unregister({ sessionId: session._id });
                                toast.success("Unregistered");
                              } catch (e) {
                                toast.error(
                                  e instanceof Error ? e.message : "Failed",
                                );
                              }
                            })();
                          }}
                        />
                      </li>
                    ),
                  )}
                </ul>
              )}
            </div>
            <div
              className="flex min-h-[4rem] flex-col gap-2 rounded-xl border-2 border-dashed border-sky-500/45 bg-sky-500/[0.06] p-3 dark:border-sky-400/40 dark:bg-sky-500/[0.1]"
              aria-labelledby="workshop-list-open-heading"
            >
              <h3
                id="workshop-list-open-heading"
                className="text-base font-semibold text-sky-950 dark:text-sky-50"
              >
                Not registered yet
              </h3>
              {openSessionsNeedRegister.length === 0 ? (
                <p className="text-sm text-sky-950/80 dark:text-sky-100/85">
                  No open sessions to join on your path right now, or you are on
                  every upcoming one.
                </p>
              ) : (
                <ul className="grid list-none grid-cols-1 gap-2 p-0 md:grid-cols-2">
                  {openSessionsNeedRegister.map((s) => (
                    <li key={s._id} className="min-w-0">
                      <OpenCertPathSessionCard
                        session={s}
                        now={now}
                        onRegister={() => {
                          void (async () => {
                            try {
                              await register({ sessionId: s._id });
                              toast.success("Registered");
                            } catch (e) {
                              toast.error(
                                e instanceof Error ? e.message : "Failed",
                              );
                            }
                          })();
                        }}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div
              className="flex min-h-[4rem] flex-col gap-2 rounded-xl border-2 border-slate-400/40 bg-slate-500/[0.06] p-3 dark:border-slate-500/40 dark:bg-slate-500/[0.1]"
              aria-labelledby="workshop-list-closed-heading"
            >
              <h3
                id="workshop-list-closed-heading"
                className="text-base font-semibold text-slate-900 dark:text-slate-50"
              >
                Closed
              </h3>
              {!closedWorkshopsFiltered ||
              closedWorkshopsFiltered.length === 0 ? (
                <p className="text-sm text-slate-800/80 dark:text-slate-100/85">
                  No closed workshops on your path
                  {filterUnitId ? " for this unit" : ""} yet.
                </p>
              ) : (
                <ul className="grid list-none grid-cols-1 gap-2 p-0 md:grid-cols-2">
                  {closedWorkshopsFiltered.map(({ session, workshopTitle }) => (
                    <li key={session._id} className="min-w-0">
                      <ClosedCertPathWorkshopCard
                        session={session}
                        workshopTitle={workshopTitle}
                        levelId={filterLevelId}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

    </div>
  );
}
