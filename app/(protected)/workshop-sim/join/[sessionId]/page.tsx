"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import Link from "next/link";
import { use } from "react";

export default function WorkshopSimJoinPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId: raw } = use(params);
  const sessionId = raw as Id<"workshopSessions">;
  const data = useQuery(api.workshops.getSessionForUser, { sessionId });

  if (data === undefined) {
    return (
      <div className="mx-auto max-w-lg p-6 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="mx-auto max-w-lg p-6 text-sm">
        <p className="text-destructive">
          This session was not found or you do not have access.
        </p>
        <Link
          href="/workshops"
          className="mt-4 inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Back to webinars
        </Link>
      </div>
    );
  }

  const { session, workshopTitle } = data;
  const isSim =
    session.teamsGraphEventId?.startsWith("sim:") === true ||
    session.externalJoinUrl?.includes("/workshop-sim/join/") === true;

  return (
    <div className="mx-auto max-w-lg p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {isSim ? "Demo webinar (simulated Teams)" : "Webinar join"}
          </CardTitle>
          <CardDescription>
            {isSim
              ? "This is not a real Microsoft Teams call. It exists so you can rehearse scheduling, links, registration, and join/leave in the app."
              : "Webinar session"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="font-medium text-foreground">{workshopTitle}</p>
            <p className="mt-1 text-muted-foreground">
              {format(new Date(session.startsAt), "PPp")} –{" "}
              {format(new Date(session.endsAt), "p")}
            </p>
          </div>
          {isSim ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-950 dark:text-amber-100">
              In a real deployment, this screen would be replaced by Microsoft
              Teams. Your testers still use <strong>Join in Teams</strong> on
              the unit page so join time is recorded.
            </p>
          ) : null}
          <Link
            href={`/units/${session.workshopUnitId}`}
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            Back to unit
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
