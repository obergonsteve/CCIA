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
  ChevronDown,
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
import { useMemo, useState, type ReactNode } from "react";

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

type DashboardCertBucketKey = keyof typeof DASHBOARD_CERT_SECTION_IDS;

/** Shared with nav chips: border, tint, top accent, and in-section typography. */
const DASHBOARD_CERT_BUCKET_STYLES: Record<
  DashboardCertBucketKey,
  {
    chipLink: string;
    sectionSurface: string;
    headerHover: string;
    title: string;
    muted: string;
    chevron: string;
    emptyInner: string;
    icon: string;
    cardBorder: string;
  }
> = {
  current: {
    chipLink: cn(
      "inline-flex items-baseline gap-1.5 rounded-full border px-3 py-1.5 text-sm shadow-sm transition-colors",
      "border-brand-gold/55 bg-brand-gold/[0.16] hover:border-brand-gold/75 hover:bg-brand-gold/24",
      "dark:border-brand-gold/45 dark:bg-brand-gold/[0.12] dark:hover:bg-brand-gold/20",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    ),
    sectionSurface: cn(
      "border border-brand-gold/55 bg-brand-gold/[0.16] dark:border-brand-gold/45 dark:bg-brand-gold/[0.12]",
      "border-t-2 border-t-brand-gold/70 dark:border-t-brand-gold/58",
    ),
    headerHover:
      "hover:bg-brand-gold/18 dark:hover:bg-brand-gold/14 focus-visible:ring-brand-gold/40",
    title: "text-amber-950 dark:text-amber-50",
    muted: "text-amber-900/78 dark:text-amber-100/72",
    chevron: "text-amber-900/50 dark:text-amber-200/50",
    emptyInner: cn(
      "border border-brand-gold/45 bg-brand-gold/[0.10] dark:border-brand-gold/35 dark:bg-brand-gold/[0.08]",
    ),
    icon: "text-brand-gold",
    cardBorder: "border-l-brand-gold/75",
  },
  roadmap: {
    chipLink: cn(
      "inline-flex items-baseline gap-1.5 rounded-full border px-3 py-1.5 text-sm shadow-sm transition-colors",
      "border-brand-sky/50 bg-brand-sky/[0.14] hover:border-brand-sky/70 hover:bg-brand-sky/22",
      "dark:border-brand-sky/45 dark:bg-brand-sky/[0.12] dark:hover:bg-brand-sky/20",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    ),
    sectionSurface: cn(
      "border border-brand-sky/50 bg-brand-sky/[0.14] dark:border-brand-sky/45 dark:bg-brand-sky/[0.12]",
      "border-t-2 border-t-brand-sky/68 dark:border-t-brand-sky/56",
    ),
    headerHover:
      "hover:bg-brand-sky/16 dark:hover:bg-brand-sky/14 focus-visible:ring-brand-sky/40",
    title: "text-sky-950 dark:text-sky-50",
    muted: "text-sky-900/78 dark:text-sky-100/72",
    chevron: "text-sky-900/50 dark:text-sky-200/50",
    emptyInner: cn(
      "border border-brand-sky/45 bg-brand-sky/[0.10] dark:border-brand-sky/35 dark:bg-brand-sky/[0.08]",
    ),
    icon: "text-brand-sky",
    cardBorder: "border-l-brand-sky/75",
  },
  available: {
    chipLink: cn(
      "inline-flex items-baseline gap-1.5 rounded-full border px-3 py-1.5 text-sm shadow-sm transition-colors",
      "border-pink-500/45 bg-pink-500/[0.12] hover:border-pink-500/65 hover:bg-pink-500/20",
      "dark:border-pink-400/40 dark:bg-pink-500/[0.14] dark:hover:bg-pink-500/22",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    ),
    sectionSurface: cn(
      "border border-pink-500/45 bg-pink-500/[0.12] dark:border-pink-400/40 dark:bg-pink-500/[0.14]",
      "border-t-2 border-t-pink-500/62 dark:border-t-pink-400/52",
    ),
    headerHover:
      "hover:bg-pink-500/14 dark:hover:bg-pink-500/12 focus-visible:ring-pink-400/40",
    title: "text-pink-950 dark:text-pink-50",
    muted: "text-pink-900/78 dark:text-pink-100/72",
    chevron: "text-pink-900/50 dark:text-pink-200/50",
    emptyInner: cn(
      "border border-pink-500/40 bg-pink-500/[0.08] dark:border-pink-400/35 dark:bg-pink-500/[0.08]",
    ),
    icon: "text-pink-600 dark:text-pink-300",
    cardBorder: "border-l-pink-500/75 dark:border-l-pink-400/70",
  },
  completed: {
    chipLink: cn(
      "inline-flex items-baseline gap-1.5 rounded-full border px-3 py-1.5 text-sm shadow-sm transition-colors",
      "border-brand-lime/50 bg-brand-lime/[0.14] hover:border-brand-lime/70 hover:bg-brand-lime/22",
      "dark:border-brand-lime/45 dark:bg-brand-lime/[0.12] dark:hover:bg-brand-lime/20",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-lime/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    ),
    sectionSurface: cn(
      "border border-brand-lime/50 bg-brand-lime/[0.14] dark:border-brand-lime/45 dark:bg-brand-lime/[0.12]",
      "border-t-2 border-t-brand-lime/68 dark:border-t-brand-lime/56",
    ),
    headerHover:
      "hover:bg-brand-lime/16 dark:hover:bg-brand-lime/14 focus-visible:ring-brand-lime/40",
    title: "text-lime-950 dark:text-lime-50",
    muted: "text-lime-900/78 dark:text-lime-100/72",
    chevron: "text-lime-900/50 dark:text-lime-200/50",
    emptyInner: cn(
      "border border-brand-lime/45 bg-brand-lime/[0.10] dark:border-brand-lime/35 dark:bg-brand-lime/[0.08]",
    ),
    icon: "text-brand-lime",
    cardBorder: "border-l-brand-lime/75",
  },
};

function CertificationBucketSection({
  title,
  description,
  icon: Icon,
  rows,
  bucketKey,
  emptyMessage,
  extraCardFooter,
  sectionId,
  defaultExpanded = false,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  rows: BucketRow[];
  bucketKey: DashboardCertBucketKey;
  emptyMessage: string;
  extraCardFooter?: (row: BucketRow) => ReactNode;
  /** When set, enables same-page links from the summary chips. */
  sectionId?: string;
  /** When true, section body starts expanded (default is collapsed). */
  defaultExpanded?: boolean;
}) {
  const s = DASHBOARD_CERT_BUCKET_STYLES[bucketKey];
  const [open, setOpen] = useState(defaultExpanded);
  const bodyId = sectionId ? `${sectionId}-panel` : "cert-bucket-panel";

  return (
    <section
      id={sectionId}
      className={cn(
        "scroll-mt-6 space-y-3 rounded-xl p-3 shadow-sm sm:p-4 sm:scroll-mt-8",
        s.sectionSurface,
      )}
    >
      <button
        type="button"
        className={cn(
          "flex w-full items-start justify-between gap-2 rounded-lg p-1 -m-1 text-left outline-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          s.headerHover,
        )}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="min-w-0 flex-1 space-y-0.5 pr-1">
          <h2
            className={cn(
              "flex items-center gap-2 text-lg font-semibold",
              s.title,
            )}
          >
            <Icon className={cn("h-5 w-5 shrink-0", s.icon)} aria-hidden />
            <span className="min-w-0">{title}</span>
          </h2>
          {open && rows.length > 0 ? (
            <p className={cn("text-sm", s.muted)}>{description}</p>
          ) : null}
          {!open && rows.length > 0 ? (
            <p className={cn("text-sm", s.muted)}>
              {rows.length}{" "}
              {rows.length === 1 ? "certification" : "certifications"} — expand
              to view.
            </p>
          ) : null}
          {!open && rows.length === 0 ? (
            <p className={cn("text-sm line-clamp-3", s.muted)}>{emptyMessage}</p>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0 transition-transform duration-200",
            s.chevron,
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <div id={bodyId} hidden={!open} className="space-y-3">
        {rows.length === 0 ? (
          <p
            className={cn(
              "text-sm border rounded-lg px-4 py-4 text-center",
              s.muted,
              s.emptyInner,
            )}
          >
            {emptyMessage}
          </p>
        ) : (
          <div className="grid gap-3 pt-4 sm:pt-5 md:grid-cols-2">
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
                className={cn("border-l-4", s.cardBorder)}
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
      </div>
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
    <div className="-mt-2 space-y-5">
      <div className="space-y-4">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-[oklch(0.43_0.095_232)] dark:text-brand-sky/95">
          Welcome, {firstName}!
        </h2>

        <div
          className={cn(
            "rounded-lg p-px",
            "bg-[linear-gradient(90deg,var(--brand-gold),var(--brand-sky),var(--brand-lime))]",
          )}
        >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-[calc(var(--radius)-1px)] bg-muted px-3 py-1.5 text-sm">
        <nav
          className="flex flex-wrap items-center gap-2 min-w-0"
          aria-label="Certification sections"
        >
          <a
            href={`#${DASHBOARD_CERT_SECTION_IDS.current}`}
            className={DASHBOARD_CERT_BUCKET_STYLES.current.chipLink}
            aria-label={`Current certifications, ${certSummary.current}`}
          >
            <span className="font-medium text-amber-900/90 dark:text-amber-100/95">
              Current
            </span>
            <span className="text-base font-semibold tabular-nums text-amber-950 dark:text-amber-50">
              {certSummary.current}
            </span>
          </a>
          <a
            href={`#${DASHBOARD_CERT_SECTION_IDS.roadmap}`}
            className={DASHBOARD_CERT_BUCKET_STYLES.roadmap.chipLink}
            aria-label={`Certification roadmap, ${certSummary.roadmap}`}
          >
            <span className="font-medium text-sky-900/90 dark:text-sky-100/95">
              Roadmap
            </span>
            <span className="text-base font-semibold tabular-nums text-sky-950 dark:text-sky-50">
              {certSummary.roadmap}
            </span>
          </a>
          <a
            href={`#${DASHBOARD_CERT_SECTION_IDS.available}`}
            className={DASHBOARD_CERT_BUCKET_STYLES.available.chipLink}
            aria-label={`Available certifications, ${certSummary.available}`}
          >
            <span className="font-medium text-pink-900/90 dark:text-pink-100/95">
              Available
            </span>
            <span className="text-base font-semibold tabular-nums text-pink-950 dark:text-pink-50">
              {certSummary.available}
            </span>
          </a>
          <a
            href={`#${DASHBOARD_CERT_SECTION_IDS.completed}`}
            className={DASHBOARD_CERT_BUCKET_STYLES.completed.chipLink}
            aria-label={`Completed certifications, ${certSummary.completed}`}
          >
            <span className="font-medium text-lime-900/90 dark:text-lime-100/95">
              Completed
            </span>
            <span className="text-base font-semibold tabular-nums text-lime-950 dark:text-lime-50">
              {certSummary.completed}
            </span>
          </a>
        </nav>
        <span
          className="hidden h-5 w-0.5 shrink-0 rounded-full bg-brand-gold/85 sm:block dark:bg-brand-gold/75"
          aria-hidden
        />
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-muted-foreground">Role</span>
          <span className="font-medium capitalize">{me.role}</span>
          <Badge variant="secondary" className="text-xs font-normal">
            {me.email}
          </Badge>
        </div>
      </div>
      </div>
      </div>

      <div className="space-y-5">
      <CertificationBucketSection
        bucketKey="current"
        sectionId={DASHBOARD_CERT_SECTION_IDS.current}
        title="Current certifications"
        description="You’ve started these — pick up where you left off."
        icon={CircleDot}
        rows={buckets.current}
        emptyMessage="No certifications in progress. Open one from the available certifications below to get started."
      />

      <CertificationBucketSection
        bucketKey="roadmap"
        sectionId={DASHBOARD_CERT_SECTION_IDS.roadmap}
        title="Certification roadmap"
        description="Certifications you marked from Available certifications — still not started."
        icon={Bookmark}
        rows={buckets.planned ?? []}
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
        bucketKey="available"
        sectionId={DASHBOARD_CERT_SECTION_IDS.available}
        title="Available certifications"
        description="Available to you — not started yet."
        icon={Sparkles}
        rows={buckets.future}
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
        bucketKey="completed"
        sectionId={DASHBOARD_CERT_SECTION_IDS.completed}
        title="Completed certifications"
        description="Every unit in these certifications is marked complete."
        icon={CheckCircle2}
        rows={buckets.completed}
        emptyMessage="None completed yet. Finish all units in a certification to see it here."
      />
      </div>
    </div>
  );
}
