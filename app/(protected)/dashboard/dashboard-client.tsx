"use client";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { CertificationTierMedallion } from "@/components/certification-tier-medallion";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  Bookmark,
  CheckCircle2,
  CircleDot,
  GraduationCap,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  certificationTierBadgeClass,
  certificationTierLabel,
  certificationTierSectionTitle,
  effectiveCertificationTier,
} from "@/lib/certificationTier";
import { cn } from "@/lib/utils";
import { useMemo, type ReactNode } from "react";

type BucketRow = {
  level: Doc<"certificationLevels">;
  unitTotal: number;
  completedCount: number;
  touchedCount: number;
  contentStepsTotal: number;
  contentStepsCompleted: number;
};

/** In-page anchors for dashboard certification summary chips. */
const DASHBOARD_CERT_SECTION_IDS = {
  current: "dashboard-cert-current",
  roadmap: "dashboard-cert-roadmap",
  available: "dashboard-cert-available",
  completed: "dashboard-cert-completed",
} as const;

function CertificationBucketSection({
  title,
  description,
  icon: Icon,
  rows,
  iconClassName,
  cardBorderClassName,
  sectionFrameClassName,
  emptyMessage,
  extraCardFooter,
  sectionId,
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
  extraCardFooter?: (row: BucketRow) => ReactNode;
  /** When set, enables same-page links from the summary chips. */
  sectionId?: string;
}) {
  return (
    <section
      id={sectionId}
      className={cn(
        "scroll-mt-6 space-y-3 rounded-xl border border-border/90 bg-card/40 p-4 shadow-sm sm:p-5 sm:scroll-mt-8",
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
              touchedCount,
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
            const tier = effectiveCertificationTier(level);
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
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-lg">{level.name}</CardTitle>
                    <Badge
                      className={cn(
                        "px-1.5 text-[10px] font-bold uppercase tracking-wide",
                        certificationTierBadgeClass(tier),
                      )}
                      aria-label={certificationTierLabel(tier)}
                      title={certificationTierSectionTitle(tier)}
                    >
                      <CertificationTierMedallion tier={tier} />
                    </Badge>
                  </div>
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
                <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <Link
                    href={href}
                    className={cn(
                      buttonVariants({ variant: "secondary", size: "sm" }),
                      "inline-flex gap-2 w-fit",
                    )}
                  >
                    Open <ArrowRight className="h-4 w-4" />
                  </Link>
                  {extraCardFooter ? extraCardFooter({
                    level,
                    unitTotal,
                    completedCount,
                    touchedCount,
                    contentStepsTotal,
                    contentStepsCompleted,
                  }) : null}
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
  const addToPlan = useMutation(api.certifications.addCertificationLevelToMyPlan);
  const removeFromPlan = useMutation(
    api.certifications.removeCertificationLevelFromMyPlan,
  );

  const certSummary = useMemo(
    () => ({
      current: buckets?.current.length ?? 0,
      roadmap: buckets?.planned?.length ?? 0,
      available: buckets?.future.length ?? 0,
      completed: buckets?.completed.length ?? 0,
    }),
    [buckets],
  );

  if (!me || !buckets) {
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
        <nav
          className="flex flex-wrap items-center gap-2 border-l-2 border-l-brand-gold/75 pl-2.5 min-w-0"
          aria-label="Certification sections"
        >
          <a
            href={`#${DASHBOARD_CERT_SECTION_IDS.current}`}
            className={cn(
              "inline-flex items-baseline gap-1.5 rounded-full border border-border/90 bg-background/80 px-3 py-1.5 text-sm shadow-sm transition-colors",
              "hover:border-brand-gold/55 hover:bg-brand-gold/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            aria-label={`Current certifications, ${certSummary.current}`}
          >
            <span className="text-muted-foreground">Current</span>
            <span className="text-base font-semibold tabular-nums text-foreground">
              {certSummary.current}
            </span>
          </a>
          <a
            href={`#${DASHBOARD_CERT_SECTION_IDS.roadmap}`}
            className={cn(
              "inline-flex items-baseline gap-1.5 rounded-full border border-border/90 bg-background/80 px-3 py-1.5 text-sm shadow-sm transition-colors",
              "hover:border-brand-sky/50 hover:bg-brand-sky/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            aria-label={`Certification roadmap, ${certSummary.roadmap}`}
          >
            <span className="text-muted-foreground">Roadmap</span>
            <span className="text-base font-semibold tabular-nums text-foreground">
              {certSummary.roadmap}
            </span>
          </a>
          <a
            href={`#${DASHBOARD_CERT_SECTION_IDS.available}`}
            className={cn(
              "inline-flex items-baseline gap-1.5 rounded-full border border-border/90 bg-background/80 px-3 py-1.5 text-sm shadow-sm transition-colors",
              "hover:border-brand-sky/55 hover:bg-brand-sky/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            aria-label={`Available certifications, ${certSummary.available}`}
          >
            <span className="text-muted-foreground">Available</span>
            <span className="text-base font-semibold tabular-nums text-foreground">
              {certSummary.available}
            </span>
          </a>
          <a
            href={`#${DASHBOARD_CERT_SECTION_IDS.completed}`}
            className={cn(
              "inline-flex items-baseline gap-1.5 rounded-full border border-border/90 bg-background/80 px-3 py-1.5 text-sm shadow-sm transition-colors",
              "hover:border-brand-lime/55 hover:bg-brand-lime/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            aria-label={`Completed certifications, ${certSummary.completed}`}
          >
            <span className="text-muted-foreground">Completed</span>
            <span className="text-base font-semibold tabular-nums text-foreground">
              {certSummary.completed}
            </span>
          </a>
        </nav>
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
        sectionId={DASHBOARD_CERT_SECTION_IDS.current}
        title="Current certifications"
        description="You’ve started these — pick up where you left off."
        icon={CircleDot}
        rows={buckets.current}
        iconClassName="text-brand-gold"
        cardBorderClassName="border-l-brand-gold/75"
        sectionFrameClassName="border-t-2 border-t-brand-gold/65 dark:border-t-brand-gold/55"
        emptyMessage="No certifications in progress. Open one from the available certifications below to get started."
      />

      <CertificationBucketSection
        sectionId={DASHBOARD_CERT_SECTION_IDS.roadmap}
        title="Certification roadmap"
        description="Certifications you marked from Available certifications — still not started."
        icon={Bookmark}
        rows={buckets.planned ?? []}
        iconClassName="text-brand-sky"
        cardBorderClassName="border-l-brand-sky/75"
        sectionFrameClassName="border-t-2 border-t-brand-gold/60 dark:border-t-brand-gold/50"
        emptyMessage="Nothing on your roadmap yet. Use “Add to roadmap” on a certification in the available certifications below."
        extraCardFooter={(row) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit border-destructive/35 text-destructive hover:bg-destructive/10"
            onClick={() =>
              removeFromPlan({ levelId: row.level._id }).catch(() => {})
            }
          >
            Remove from roadmap
          </Button>
        )}
      />

      <CertificationBucketSection
        sectionId={DASHBOARD_CERT_SECTION_IDS.available}
        title="Available certifications"
        description="Available to you — not started yet."
        icon={Sparkles}
        rows={buckets.future}
        iconClassName="text-brand-sky"
        cardBorderClassName="border-l-brand-sky/75"
        sectionFrameClassName="border-t-2 border-t-brand-sky/65 dark:border-t-brand-sky/55"
        emptyMessage="No upcoming certifications, or you’ve already engaged with everything available."
        extraCardFooter={(row) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() =>
              addToPlan({ levelId: row.level._id }).catch(() => {})
            }
          >
            Add to roadmap
          </Button>
        )}
      />

      <CertificationBucketSection
        sectionId={DASHBOARD_CERT_SECTION_IDS.completed}
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
