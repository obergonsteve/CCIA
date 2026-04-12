"use client";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  GraduationCap,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

type BucketRow = {
  level: Doc<"certificationLevels">;
  unitTotal: number;
  completedCount: number;
  touchedCount: number;
  contentStepsTotal: number;
  contentStepsCompleted: number;
};

function CertificationBucketSection({
  title,
  description,
  icon: Icon,
  rows,
  iconClassName,
  cardBorderClassName,
  sectionFrameClassName,
  emptyMessage,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  rows: BucketRow[];
  iconClassName: string;
  cardBorderClassName: string;
  /** Top accent + any extra frame styles for this bucket. */
  sectionFrameClassName: string;
  emptyMessage: string;
}) {
  return (
    <section
      className={cn(
        "space-y-3 rounded-xl border border-border/90 bg-card/40 p-4 shadow-sm sm:p-5",
        sectionFrameClassName,
      )}
    >
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Icon className={cn("h-5 w-5", iconClassName)} aria-hidden />
          {title}
        </h2>
        {rows.length > 0 ? (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground border rounded-lg px-4 py-6 text-center bg-muted/20">
          {emptyMessage}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map(
            ({
              level,
              unitTotal,
              completedCount,
              contentStepsTotal,
              contentStepsCompleted,
            }) => {
            const href = `/certifications/${level._id}`;
            const unitsPct =
              unitTotal > 0
                ? Math.round((completedCount / unitTotal) * 100)
                : 0;
            const contentPct =
              contentStepsTotal > 0
                ? Math.round(
                    (contentStepsCompleted / contentStepsTotal) * 100,
                  )
                : 0;
            const thumb = level.thumbnailUrl?.trim() ?? "";
            return (
              <Card
                key={level._id}
                className={cn("border-l-4", cardBorderClassName)}
              >
                <div className="relative -mt-4 aspect-[2/1] w-full shrink-0 overflow-hidden bg-muted sm:aspect-[16/9]">
                  {thumb ? (
                    <Image
                      src={thumb}
                      alt={level.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-lime/20 via-brand-gold/12 to-brand-sky/18">
                      <GraduationCap
                        className="h-10 w-10 text-brand-charcoal/30"
                        aria-hidden
                      />
                    </div>
                  )}
                </div>
                <CardHeader className="rounded-t-none">
                  <CardTitle className="text-lg">{level.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {level.summary?.trim() || level.description}
                  </CardDescription>
                  <div className="space-y-3 border-t border-border/60 pt-3 mt-1">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">Units</span>
                        <span className="tabular-nums font-medium text-foreground">
                          {unitTotal > 0
                            ? `${completedCount} / ${unitTotal}`
                            : "—"}
                        </span>
                      </div>
                      {unitTotal > 0 ? (
                        <Progress value={unitsPct} className="h-2 w-full" />
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No units in this certification yet
                        </p>
                      )}
                    </div>
                    {contentStepsTotal > 0 ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-muted-foreground">
                            Content steps
                          </span>
                          <span className="tabular-nums font-medium text-foreground">
                            {contentStepsCompleted} / {contentStepsTotal}
                          </span>
                        </div>
                        <Progress
                          value={contentPct}
                          className="h-2 w-full"
                        />
                      </div>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent>
                  <Link
                    href={href}
                    className={cn(
                      buttonVariants({ variant: "secondary", size: "sm" }),
                      "inline-flex gap-2",
                    )}
                  >
                    Open <ArrowRight className="h-4 w-4" />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function DashboardClient() {
  const me = useQuery(api.users.me);
  const buckets = useQuery(api.certifications.listDashboardBucketsForUser);
  const allProgress = useQuery(api.progress.listForUser);

  const totalUnitsDone = useMemo(
    () => (allProgress ?? []).filter((p) => p.completed).length,
    [allProgress],
  );

  if (!me || !buckets || !allProgress) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-10 bg-muted rounded max-w-xl" />
      </div>
    );
  }

  const firstName =
    me.name.trim().split(/\s+/)[0] || me.name.trim() || me.name;

  return (
    <div className="-mt-2 space-y-8">
      <div className="space-y-5">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-[oklch(0.43_0.095_232)] dark:text-brand-sky/95">
          Welcome, {firstName}!
        </h2>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border/80 bg-muted/25 px-3 py-2 text-sm">
        <div className="flex flex-wrap items-baseline gap-x-2 border-l-2 border-l-brand-lime/80 pl-2.5">
          <span className="text-muted-foreground">Units completed</span>
          <span className="text-base font-semibold tabular-nums text-foreground">
            {totalUnitsDone}
          </span>
        </div>
        <span
          className="hidden h-4 w-px bg-border sm:block"
          aria-hidden
        />
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-l-2 border-l-brand-gold/80 pl-2.5">
          <span className="text-muted-foreground">Role</span>
          <span className="font-medium capitalize">{me.role}</span>
          <Badge variant="secondary" className="text-xs font-normal">
            {me.email}
          </Badge>
        </div>
      </div>
      </div>

      <CertificationBucketSection
        title="Current certifications"
        description="You’ve started these — pick up where you left off."
        icon={CircleDot}
        rows={buckets.current}
        iconClassName="text-brand-gold"
        cardBorderClassName="border-l-brand-gold/75"
        sectionFrameClassName="border-t-2 border-t-brand-gold/65 dark:border-t-brand-gold/55"
        emptyMessage="No certifications in progress. Open one from the Roadmap below to get started."
      />

      <CertificationBucketSection
        title="Certification roadmap"
        description="Available to you — not started yet."
        icon={Sparkles}
        rows={buckets.future}
        iconClassName="text-brand-sky"
        cardBorderClassName="border-l-brand-sky/75"
        sectionFrameClassName="border-t-2 border-t-brand-sky/65 dark:border-t-brand-sky/55"
        emptyMessage="No upcoming certifications, or you’ve already engaged with everything available."
      />

      <CertificationBucketSection
        title="Completed certifications"
        description="Every unit in these certifications is marked complete."
        icon={CheckCircle2}
        rows={buckets.completed}
        iconClassName="text-brand-lime"
        cardBorderClassName="border-l-brand-lime/75"
        sectionFrameClassName="border-t-2 border-t-brand-lime/65 dark:border-t-brand-lime/55"
        emptyMessage="None completed yet. Finish all units in a certification to see it here."
      />
    </div>
  );
}
