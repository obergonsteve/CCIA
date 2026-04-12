"use client";

import { api } from "@/convex/_generated/api";
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
import { useMutation, useQuery } from "convex/react";
import { CalendarDays, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function WorkshopsClient() {
  const [tierFilter, setTierFilter] = useState<
    "all" | "bronze" | "silver" | "gold"
  >("all");
  const upcoming = useQuery(api.workshops.listUpcomingForUser, {
    certificationTier: tierFilter,
  });
  const mine = useQuery(api.workshops.myRegistrations);
  const register = useMutation(api.workshops.registerForSession);
  const unregister = useMutation(api.workshops.unregisterFromSession);

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-8">
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
        <h2 className="text-lg font-semibold">My workshops</h2>
        {mine === undefined ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You have not registered for any sessions yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {mine.map(({ session, workshopTitle, past }) => (
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

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Upcoming sessions</h2>
        {upcoming === undefined ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No upcoming sessions match this filter.
          </p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((s) => (
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
