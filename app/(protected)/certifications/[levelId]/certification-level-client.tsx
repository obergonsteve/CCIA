"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CertificationTierMedallion } from "@/components/certification-tier-medallion";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Circle,
  CircleDashed,
  Lock,
  Route,
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

type PathStep = {
  kind: "content" | "legacy_assignment";
  contentId?: Id<"contentItems">;
  assignmentId?: Id<"assignments">;
  title: string;
  contentType?: string;
  isAssessment: boolean;
  status: "completed" | "in_progress" | "not_started" | "locked";
};

function stepAnchorHref(
  unitId: Id<"units">,
  levelId: Id<"certificationLevels">,
  step: PathStep,
): string {
  const base = `/units/${unitId}?level=${levelId}`;
  if (step.kind === "content" && step.contentId) {
    return `${base}#step-${step.contentId}`;
  }
  if (step.kind === "legacy_assignment" && step.assignmentId) {
    return `${base}#step-a-${step.assignmentId}`;
  }
  return base;
}

function PathStepNode({
  step,
  unitId,
  levelId,
  unitLocked,
}: {
  step: PathStep;
  unitId: Id<"units">;
  levelId: Id<"certificationLevels">;
  unitLocked: boolean;
}) {
  const href = stepAnchorHref(unitId, levelId, step);
  const blocked = unitLocked || step.status === "locked";

  const icon =
    step.status === "completed" ? (
      <CheckCircle2
        className="h-4 w-4 text-brand-lime"
        aria-hidden
      />
    ) : step.status === "locked" || unitLocked ? (
      <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
    ) : step.status === "in_progress" ? (
      <CircleDashed className="h-4 w-4 text-brand-gold" aria-hidden />
    ) : (
      <Circle className="h-4 w-4 text-muted-foreground/70" aria-hidden />
    );

  const shell = (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-background shadow-sm transition-colors",
        step.status === "completed" &&
          "border-brand-lime/70 bg-brand-lime/[0.12]",
        step.status === "in_progress" &&
          "border-brand-gold/80 bg-brand-gold/[0.12] ring-2 ring-brand-gold/25",
        (step.status === "not_started" || step.status === "locked") &&
          !unitLocked &&
          "border-border",
        unitLocked && "border-muted bg-muted/40",
      )}
    >
      {icon}
    </span>
  );

  const caption = (
    <span className="max-w-[5.25rem] text-center text-[10px] leading-tight text-muted-foreground line-clamp-2">
      {step.title}
    </span>
  );

  if (blocked) {
    return (
      <span
        className="inline-flex max-w-[5.25rem] cursor-not-allowed flex-col items-center gap-1 opacity-80"
        title={step.title}
      >
        {shell}
        {caption}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex max-w-[5.25rem] flex-col items-center gap-1 rounded-md outline-none ring-offset-background transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-brand-sky/50"
      title={step.title}
      scroll={true}
    >
      {shell}
      {caption}
    </Link>
  );
}

export default function CertificationLevelClient({
  levelId: levelIdRaw,
}: {
  levelId: string;
}) {
  const levelId = levelIdRaw as Id<"certificationLevels">;

  const level = useQuery(api.certifications.get, { levelId });
  const roadmap = useQuery(api.contentProgress.roadmapForCertification, {
    levelId,
  });

  if (level === undefined || roadmap === undefined) {
    return <div className="animate-pulse h-48 bg-muted rounded" />;
  }

  if (level === null || roadmap === null) {
    return (
      <p className="text-muted-foreground">Level not found or access denied.</p>
    );
  }

  const tier = effectiveCertificationTier(level);

  return (
    <div className="space-y-8">
      {level.thumbnailUrl ? (
        <div className="relative overflow-hidden rounded-2xl border border-border/80 shadow-sm">
          <div className="relative aspect-[21/9] min-h-[140px] w-full md:aspect-[3/1]">
            <Image
              src={level.thumbnailUrl}
              alt={level.name}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 896px"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-transparent md:from-background/90" />
            <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8 md:max-w-xl">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                  {level.name}
                </h1>
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
              {level.tagline ? (
                <p className="mt-1 text-sm font-medium text-brand-gold md:text-base">
                  {level.tagline}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{level.name}</h1>
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
          {level.tagline ? (
            <p className="mt-1 text-sm font-medium text-brand-gold">
              {level.tagline}
            </p>
          ) : null}
        </div>
      )}

      <section
        id="certification-path"
        aria-labelledby="certification-path-heading"
        className="relative overflow-hidden rounded-2xl border-2 border-brand-gold/45 bg-muted/25 shadow-sm dark:border-brand-gold/40"
      >
        <div
          className="h-1.5 w-full bg-gradient-to-r from-brand-lime/70 via-brand-gold/75 to-brand-sky/70"
          aria-hidden
        />
        <div className="p-4 md:p-6">
          <h2
            id="certification-path-heading"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground md:text-xl"
          >
            <Route className="h-5 w-5 shrink-0 text-brand-gold" aria-hidden />
            Your certification path
          </h2>
          {roadmap.units.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No units are linked to this certification yet. An admin can attach
              units in Admin → Courses.
            </p>
          ) : (
            <ol className="mt-6 flex w-full flex-col gap-6 border-t border-border/60 pt-6">
            {roadmap.units.map((u) => {
              const pathSteps = u.pathSteps satisfies PathStep[];
              const isWorkshop =
                (u.deliveryMode ?? "self_paced") === "live_workshop";
              const pct =
                u.stepTotal > 0
                  ? Math.round((u.stepsCompleted / u.stepTotal) * 100)
                  : u.completed
                    ? 100
                    : 0;
              const certificationNavLocked = u.locked && !isWorkshop;
              return (
                <li
                  key={u.unitId}
                  className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-1 md:gap-1.5"
                >
                  <div className="w-full shrink-0 sm:max-w-[min(100%,260px)] sm:w-[216px]">
                    <Link
                      href={`/units/${u.unitId}?level=${levelId}`}
                      className={cn(
                        "block w-full rounded-xl border bg-card px-3 py-3 shadow-sm transition-colors hover:bg-muted/40",
                        u.completed &&
                          "border-2 border-brand-lime/50 bg-brand-lime/[0.06]",
                        certificationNavLocked &&
                          "cursor-not-allowed opacity-80",
                        u.locked &&
                          !isWorkshop &&
                          "border border-border/80 border-l-4 border-r-4 border-l-brand-gold border-r-brand-gold bg-muted/25 dark:border-l-brand-gold dark:border-r-brand-gold",
                        !u.completed &&
                          isWorkshop &&
                          "border border-purple-500/40 border-l-4 border-r-4 border-l-purple-600 border-r-purple-600 bg-background hover:border-purple-500/55 hover:border-l-purple-500 hover:border-r-purple-500 dark:border-purple-400/45 dark:border-l-purple-400 dark:border-r-purple-400 dark:hover:border-purple-300/55",
                        !u.completed &&
                          !isWorkshop &&
                          !u.locked &&
                          "border border-brand-gold/40 border-l-4 border-r-4 border-l-brand-gold border-r-brand-gold bg-background hover:border-brand-gold/55 hover:border-l-brand-gold hover:border-r-brand-gold dark:border-brand-gold/35 dark:border-l-brand-gold dark:border-r-brand-gold dark:hover:border-brand-gold/50",
                      )}
                      aria-disabled={certificationNavLocked}
                      aria-label={`${u.title}, ${isWorkshop ? "live workshop" : "self-paced"}${u.completed ? ", completed" : ""}${u.locked ? ", later in certification path" : ""}`}
                      onClick={(e) => {
                        if (certificationNavLocked) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <div className="flex flex-col gap-2 text-left">
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-5 w-fit shrink-0 px-2 py-0 text-[10px] font-bold uppercase tracking-wide",
                            isWorkshop
                              ? "border-purple-500/45 bg-purple-500/10 text-purple-900 dark:border-purple-400/50 dark:bg-purple-500/15 dark:text-purple-100"
                              : "border-brand-gold/50 bg-brand-gold/[0.12] text-foreground dark:border-brand-gold/45 dark:bg-brand-gold/[0.10]",
                            u.completed &&
                              "border-border/70 bg-background/60 text-muted-foreground dark:bg-background/40",
                          )}
                        >
                          {isWorkshop ? "Live workshop" : "Self-paced"}
                        </Badge>
                        <span className="flex items-start gap-2">
                          {u.completed ? (
                            <CheckCircle2
                              className="h-5 w-5 shrink-0 text-brand-lime mt-0.5"
                              aria-hidden
                            />
                          ) : u.locked ? (
                            <Lock
                              className={cn(
                                "h-5 w-5 shrink-0 mt-0.5",
                                isWorkshop
                                  ? "text-purple-600 dark:text-purple-400"
                                  : "text-brand-gold",
                              )}
                              aria-hidden
                            />
                          ) : (
                            <Circle
                              className={cn(
                                "h-5 w-5 shrink-0 mt-0.5",
                                isWorkshop
                                  ? "text-purple-600 fill-purple-500/20 dark:text-purple-400 dark:fill-purple-400/20"
                                  : "text-brand-gold fill-brand-gold/25 dark:text-brand-gold dark:fill-brand-gold/20",
                              )}
                              aria-hidden
                            />
                          )}
                          <span className="min-w-0 flex-1 leading-snug">
                            <span className="line-clamp-3 text-sm font-semibold text-foreground">
                              {u.title}
                            </span>
                            <span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                              {u.completed
                                ? "Open unit"
                                : isWorkshop
                                  ? "Sessions & join"
                                  : "Open unit"}
                              <ChevronRight
                                className="h-3.5 w-3.5 shrink-0 opacity-70"
                                aria-hidden
                              />
                            </span>
                          </span>
                        </span>
                        {u.locked && u.lockReason === "prerequisite" ? (
                          <p className="text-[11px] text-brand-gold">
                            Prerequisites required
                          </p>
                        ) : u.locked && u.lockReason === "previous_unit" ? (
                          <p className="text-[11px] text-muted-foreground">
                            Complete the previous unit first
                          </p>
                        ) : (
                          <p className="text-[11px] tabular-nums text-muted-foreground">
                            {u.stepsCompleted}/{u.stepTotal || 0} lessons
                            {u.stepTotal > 0 ? ` · ${pct}%` : ""}
                          </p>
                        )}
                      </div>
                    </Link>
                  </div>

                  {pathSteps.length > 0 ? (
                    <>
                      <ArrowRight
                        className="hidden h-4 w-5 shrink-0 text-muted-foreground/40 sm:-mx-0.5 sm:block md:h-4 md:w-6"
                        aria-hidden
                        strokeWidth={2}
                      />
                      <div className="min-w-0 flex-1 overflow-x-auto overflow-y-visible pb-1 [-webkit-overflow-scrolling:touch]">
                        <ol
                          className="flex w-max list-none flex-row flex-nowrap items-center gap-x-0 pr-1"
                          aria-label={`Steps in unit: ${u.title}`}
                        >
                          {pathSteps.map((step, si) => (
                            <li
                              key={
                                step.kind === "content" && step.contentId
                                  ? `c-${step.contentId}`
                                  : step.assignmentId
                                    ? `a-${step.assignmentId}`
                                    : `s-${si}`
                              }
                              className="flex items-center"
                            >
                              {si > 0 ? (
                                <ArrowRight
                                  className="mx-0 h-3.5 w-4 shrink-0 text-muted-foreground/40 sm:h-4 sm:w-5"
                                  aria-hidden
                                  strokeWidth={2}
                                />
                              ) : null}
                              <PathStepNode
                                step={step}
                                unitId={u.unitId}
                                levelId={levelId}
                                unitLocked={u.locked}
                              />
                            </li>
                          ))}
                        </ol>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground sm:pl-2">
                      No lessons in this unit yet.
                    </p>
                  )}
                </li>
              );
            })}
            </ol>
          )}
        </div>
      </section>

      <div className="max-w-3xl space-y-4">
        {level.summary?.trim() ? (
          <p className="text-base font-medium text-foreground/90 leading-relaxed">
            {level.summary}
          </p>
        ) : null}
        <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {level.description}
        </p>
      </div>
    </div>
  );
}
