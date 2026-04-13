"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CertificationTierMedallion } from "@/components/certification-tier-medallion";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  certificationTierBadgeClass,
  certificationTierLabel,
  certificationTierSectionTitle,
} from "@/lib/certificationTier";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ExternalLink } from "lucide-react";
import { useMemo } from "react";
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

  const upcoming = useQuery(api.workshops.listUpcomingForUser, {
    certificationTier: "all",
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
    <div className="mx-auto max-w-4xl space-y-4 px-3 pb-4 pt-0 sm:px-4 sm:pb-6 sm:pt-1">
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
            <Button
              variant="outline"
              size="sm"
              className="border-purple-500/40 text-purple-900 hover:bg-purple-500/10 dark:border-purple-400/45 dark:text-purple-100 dark:hover:bg-purple-500/15"
              asChild
            >
              <Link href="/workshops">All workshops</Link>
            </Button>
            {filterLevelId ? (
              <Button
                variant="secondary"
                size="sm"
                className="border border-purple-500/30 bg-purple-500/15 text-purple-950 hover:bg-purple-500/22 dark:border-purple-400/25 dark:bg-purple-500/20 dark:text-purple-50 dark:hover:bg-purple-500/28"
                asChild
              >
                <Link href={certPathHref}>Certification path</Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <p className="text-sm text-purple-900/80 dark:text-purple-200/85">
        Browse upcoming live sessions and add them to{" "}
        <span className="font-semibold text-purple-950 dark:text-purple-50">
          My workshops
        </span>
        . In-app list only — calendar export may come later.
      </p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-purple-950 dark:text-purple-100">
          {filterUnitId ? "My workshops (this unit)" : "My workshops"}
        </h2>
        {mySessionsForUnit === undefined ? (
          <p className="text-sm text-purple-900/70 dark:text-purple-200/75">
            Loading…
          </p>
        ) : mySessionsForUnit.length === 0 ? (
          <p className="text-sm text-purple-900/70 dark:text-purple-200/75">
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
                    "border border-purple-500/25 bg-purple-500/[0.04] shadow-sm dark:border-purple-400/20 dark:bg-purple-500/[0.07]",
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
                          "inline-flex gap-1.5 border-purple-500/30 bg-purple-500/10 text-purple-950 hover:bg-purple-500/18 dark:border-purple-400/25 dark:bg-purple-500/15 dark:text-purple-50 dark:hover:bg-purple-500/22",
                        )}
                      >
                        Open join link
                        <ExternalLink className="h-3.5 w-3.5 text-purple-700 dark:text-purple-300" />
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
                        className="border-purple-500/40 text-purple-900 hover:bg-purple-500/10 dark:border-purple-400/45 dark:text-purple-100 dark:hover:bg-purple-500/15"
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
        <h2 className="text-lg font-semibold text-purple-950 dark:text-purple-100">
          {filterUnitId ? "Upcoming sessions for this unit" : "Upcoming sessions"}
        </h2>
        {upcomingSessions === undefined ? (
          <p className="text-sm text-purple-900/70 dark:text-purple-200/75">
            Loading…
          </p>
        ) : upcomingSessions.length === 0 ? (
          <p className="text-sm text-purple-900/70 dark:text-purple-200/75">
            {filterUnitId
              ? "No upcoming sessions are scheduled for this workshop yet. Check back later."
              : "No upcoming sessions right now."}
          </p>
        ) : (
          <ul className="space-y-2">
            {upcomingSessions.map((s) => (
              <li key={s._id}>
                <Card className="border border-purple-500/25 bg-purple-500/[0.04] shadow-sm dark:border-purple-400/20 dark:bg-purple-500/[0.07]">
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
                        <Badge
                          variant="secondary"
                          className="border border-purple-500/35 bg-purple-500/15 text-purple-950 dark:border-purple-400/40 dark:bg-purple-500/20 dark:text-purple-50"
                        >
                          Registered
                        </Badge>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-purple-500/40 text-purple-900 hover:bg-purple-500/10 dark:border-purple-400/45 dark:text-purple-100 dark:hover:bg-purple-500/15"
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
                        className="bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 dark:bg-purple-600 dark:hover:bg-purple-500"
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
                          "inline-flex gap-1 text-purple-700 hover:bg-purple-500/15 hover:text-purple-900 dark:text-purple-300 dark:hover:bg-purple-500/20 dark:hover:text-purple-50",
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
