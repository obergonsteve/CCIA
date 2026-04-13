"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CertificationTierMedallion } from "@/components/certification-tier-medallion";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  certificationTierBadgeClass,
  certificationTierLabel,
  certificationTierSectionTitle,
} from "@/lib/certificationTier";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { CalendarDays, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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

  const [tierFilter, setTierFilter] = useState<
    "all" | "bronze" | "silver" | "gold"
  >("all");
  const upcoming = useQuery(api.workshops.listUpcomingForUser, {
    certificationTier: tierFilter,
  });
  const mine = useQuery(api.workshops.myRegistrations);
  const filterUnit = useQuery(
    api.units.get,
    filterUnitId ? { unitId: filterUnitId } : "skip",
  );
  const register = useMutation(api.workshops.registerForSession);
  const unregister = useMutation(api.workshops.unregisterFromSession);

  const upcomingSessions = useMemo(() => {
    if (!upcoming) {
      return undefined;
    }
    if (!filterUnitId) {
      return upcoming;
    }
    return upcoming.filter((s) => s.workshopUnitId === filterUnitId);
  }, [upcoming, filterUnitId]);

  const mySessionsForUnit = useMemo(() => {
    if (!mine) {
      return undefined;
    }
    if (!filterUnitId) {
      return mine;
    }
    return mine.filter(({ session }) => session.workshopUnitId === filterUnitId);
  }, [mine, filterUnitId]);

  const certPathHref =
    filterLevelId != null
      ? `/certifications/${filterLevelId}#certification-path`
      : "/certifications";

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-8">
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
              Pick a scheduled session below to register, or unregister under{" "}
              <span className="font-medium text-foreground">My workshops</span>{" "}
              to choose a different date.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/workshops">All workshops</Link>
            </Button>
            {filterLevelId ? (
              <Button variant="secondary" size="sm" asChild>
                <Link href={certPathHref}>Certification path</Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-7 w-7 text-brand-gold" aria-hidden />
            Workshops
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse upcoming live sessions and add them to{" "}
            <span className="font-medium text-foreground">My workshops</span>.
            In-app list only — calendar export may come later.
          </p>
        </div>
        <div className="space-y-1 sm:w-56">
          <span className="text-xs font-medium text-muted-foreground">
            Filter by certification tier
          </span>
          <Select
            value={tierFilter}
            onValueChange={(v) =>
              setTierFilter(
                (v ?? "all") as "all" | "bronze" | "silver" | "gold",
              )
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" label="All tiers">
                All tiers
              </SelectItem>
              <SelectItem value="bronze" label="Bronze">
                Bronze
              </SelectItem>
              <SelectItem value="silver" label="Silver">
                Silver
              </SelectItem>
              <SelectItem value="gold" label="Gold">
                Gold
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          {filterUnitId ? "My workshops (this unit)" : "My workshops"}
        </h2>
        {mySessionsForUnit === undefined ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : mySessionsForUnit.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {filterUnitId
              ? "You have no registration for this workshop yet. Choose a session under Upcoming sessions."
              : "You have not registered for any sessions yet."}
          </p>
        ) : (
          <ul className="space-y-2">
            {mySessionsForUnit.map(({ session, workshopTitle, past }) => (
              <li key={session._id}>
                <Card
                  className={cn(
                    past && "opacity-80 border-dashed",
                  )}
                >
                  <CardHeader className="py-3">
                    <CardTitle className="text-base font-medium">
                      {workshopTitle}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {new Date(session.startsAt).toLocaleString()} —{" "}
                      {new Date(session.endsAt).toLocaleString()}
                      {past ? " · Past" : ""}
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2 pb-4">
                    {session.externalJoinUrl && !past ? (
                      <Link
                        href={session.externalJoinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          buttonVariants({ variant: "secondary", size: "sm" }),
                          "inline-flex gap-1.5",
                        )}
                      >
                        Open join link
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    ) : !past ? (
                      <span className="text-xs text-muted-foreground">
                        Live room (LiveKit) will appear here in a future update.
                      </span>
                    ) : null}
                    {!past && session.status === "scheduled" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            await unregister({ sessionId: session._id });
                            toast.success("Removed from My workshops");
                          } catch (e) {
                            toast.error(
                              e instanceof Error ? e.message : "Failed",
                            );
                          }
                        }}
                      >
                        Unregister
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="workshop-upcoming-sessions" className="space-y-3 scroll-mt-24">
        <h2 className="text-lg font-semibold">
          {filterUnitId ? "Upcoming sessions for this unit" : "Upcoming sessions"}
        </h2>
        {upcomingSessions === undefined ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : upcomingSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {filterUnitId
              ? "No upcoming sessions are scheduled for this workshop yet. Try another tier filter or check back later."
              : "No upcoming sessions match this filter."}
          </p>
        ) : (
          <ul className="space-y-2">
            {upcomingSessions.map((s) => (
              <li key={s._id}>
                <Card>
                  <CardHeader className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <CardTitle className="text-base font-medium">
                        {s.workshopTitle}
                      </CardTitle>
                      <div className="flex flex-wrap gap-1">
                        {s.tiers.map((t) => (
                          <Badge
                            key={t}
                            className={cn(
                              "px-1.5 text-[10px] font-bold uppercase",
                              certificationTierBadgeClass(t),
                            )}
                            aria-label={certificationTierLabel(t)}
                            title={certificationTierSectionTitle(t)}
                          >
                            <CertificationTierMedallion tier={t} />
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.startsAt).toLocaleString()} —{" "}
                      {new Date(s.endsAt).toLocaleString()}
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2 pb-4">
                    {s.registered ? (
                      <>
                        <Badge variant="secondary">Registered</Badge>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              await unregister({ sessionId: s._id });
                              toast.success("Unregistered");
                            } catch (e) {
                              toast.error(
                                e instanceof Error ? e.message : "Failed",
                              );
                            }
                          }}
                        >
                          Unregister
                        </Button>
                      </>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        disabled={s.full}
                        onClick={async () => {
                          try {
                            await register({ sessionId: s._id });
                            toast.success("Added to My workshops");
                          } catch (e) {
                            toast.error(
                              e instanceof Error ? e.message : "Failed",
                            );
                          }
                        }}
                      >
                        {s.full ? "Full" : "Register"}
                      </Button>
                    )}
                    {s.externalJoinUrl ? (
                      <Link
                        href={s.externalJoinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                          "inline-flex gap-1",
                        )}
                      >
                        Join link
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
