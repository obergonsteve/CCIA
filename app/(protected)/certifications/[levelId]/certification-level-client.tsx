"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CertificationTierMedallion } from "@/components/certification-tier-medallion";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  CircleDashed,
  Lock,
  Route,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { SendInAppNoticeTextButton } from "@/components/admin/send-in-app-notice-control";
import { useSessionUser } from "@/lib/use-session-user";
import { useState } from "react";
import { toast } from "sonner";
import {
  certificationTierBadgeClass,
  certificationTierBadgeMedallionClass,
  certificationTierBadgeShellClass,
  certificationTierLabel,
  certificationTierSectionTitle,
  effectiveCertificationTier,
} from "@/lib/certificationTier";
import { cn } from "@/lib/utils";

function formatWorkshopSlot(startsAt: number, endsAt: number): string {
  const df = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `${df.format(startsAt)} – ${df.format(endsAt)}`;
}

type PathStep = {
  kind: "content" | "legacy_assignment";
  contentId?: Id<"contentItems">;
  assignmentId?: Id<"assignments">;
  title: string;
  contentType?: string;
  isAssessment: boolean;
  status: "completed" | "in_progress" | "not_started" | "locked";
};

function withViewAsQuery(
  path: string,
  viewAsUserId: Id<"users"> | undefined,
): string {
  if (!viewAsUserId) {
    return path;
  }
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}viewAs=${viewAsUserId}`;
}

function stepAnchorHref(
  unitId: Id<"units">,
  levelId: Id<"certificationLevels">,
  step: PathStep,
  viewAsUserId: Id<"users"> | undefined,
): string {
  const base = withViewAsQuery(
    `/units/${unitId}?level=${levelId}`,
    viewAsUserId,
  );
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
  viewAsUserId,
}: {
  step: PathStep;
  unitId: Id<"units">;
  levelId: Id<"certificationLevels">;
  unitLocked: boolean;
  viewAsUserId: Id<"users"> | undefined;
}) {
  const href = stepAnchorHref(unitId, levelId, step, viewAsUserId);
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
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-gradient-to-br from-background via-background to-background shadow-sm transition-colors",
        step.status === "completed" &&
          "border-brand-lime/70 from-brand-lime/[0.10] via-background to-brand-lime/[0.10]",
        step.status === "in_progress" &&
          "border-brand-gold/80 from-brand-gold/[0.10] via-background to-brand-gold/[0.10] ring-2 ring-brand-gold/25",
        (step.status === "not_started" || step.status === "locked") &&
          !unitLocked &&
          "border-border from-muted/20 via-background to-muted/20",
        unitLocked &&
          "border-muted from-muted/30 via-background to-muted/30",
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
        className="inline-flex max-w-[5.25rem] cursor-not-allowed flex-col items-center gap-1"
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

function CertificationLevelPageHeading({
  code,
  name,
  className,
}: {
  code?: string | null;
  name: string;
  className?: string;
}) {
  const trimmed = code?.trim();
  return (
    <h1 className="min-w-0">
      <span className={className}>{name}</span>
      {trimmed ? (
        <span className="mt-1 block font-mono text-sm font-semibold uppercase tracking-wide text-muted-foreground md:text-base">
          {trimmed}
        </span>
      ) : null}
    </h1>
  );
}

export default function CertificationLevelClient({
  levelId: levelIdRaw,
  viewAsUserId: viewAsUserIdRaw,
}: {
  levelId: string;
  /** When set, show this user’s path/progress (admin / content creator only). */
  viewAsUserId?: string;
}) {
  const levelId = levelIdRaw as Id<"certificationLevels">;
  const viewAsUserId =
    viewAsUserIdRaw && viewAsUserIdRaw.length > 0
      ? (viewAsUserIdRaw as Id<"users">)
      : undefined;
  const viewAs = viewAsUserId != null;

  const [workshopPickerOpen, setWorkshopPickerOpen] = useState(false);
  const [workshopPickerUnitId, setWorkshopPickerUnitId] =
    useState<Id<"units"> | null>(null);
  const [workshopPickerTitle, setWorkshopPickerTitle] = useState("");
  const { user: sessionUser } = useSessionUser();
  const isAdmin = sessionUser?.role === "admin";

  const level = useQuery(api.certifications.get, { levelId });
  const viewAsLabel = useQuery(
    api.users.getForViewAsLabel,
    viewAsUserId != null ? { userId: viewAsUserId } : "skip",
  );
  const roadmap = useQuery(api.contentProgress.roadmapForCertification, {
    levelId,
    ...(viewAsUserId != null ? { viewAsUserId } : {}),
  });
  const workshopPickerData = useQuery(
    api.workshops.listUpcomingSessionsForWorkshopUnit,
    workshopPickerOpen && workshopPickerUnitId
      ? { workshopUnitId: workshopPickerUnitId }
      : "skip",
  );
  const registerWorkshop = useMutation(api.workshops.registerForSession);
  const unregisterWorkshop = useMutation(api.workshops.unregisterFromSession);

  if (level === undefined || roadmap === undefined) {
    return <div className="animate-pulse h-48 bg-muted rounded" />;
  }

  if (level === null) {
    return (
      <p className="text-muted-foreground">
        This certification was not found, or your account does not have access to
        it.
      </p>
    );
  }

  if (roadmap === null) {
    return (
      <div className="space-y-2 text-muted-foreground">
        <p>
          Could not load the certification path (progress and units). If the
          address bar has <code className="text-foreground">viewAs=</code>, try
          removing that parameter, or open this program from the Certifications
          list again.
        </p>
        <p className="text-sm">
          If this keeps happening, sign out and back in so your session matches
          the server.
        </p>
      </div>
    );
  }

  const tier = effectiveCertificationTier(level);

  return (
    <div className="space-y-5">
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
              <div className="flex flex-wrap items-start gap-2">
                <CertificationLevelPageHeading
                  code={level.code}
                  name={level.name}
                  className="text-2xl font-bold tracking-tight md:text-3xl"
                />
                <Badge
                  className={cn(
                    certificationTierBadgeShellClass,
                    certificationTierBadgeClass(tier),
                  )}
                  aria-label={certificationTierLabel(tier)}
                  title={certificationTierSectionTitle(tier)}
                >
                  <CertificationTierMedallion
                    tier={tier}
                    className={certificationTierBadgeMedallionClass}
                  />
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
          <div className="flex flex-wrap items-start gap-2">
            <CertificationLevelPageHeading
              code={level.code}
              name={level.name}
              className="text-2xl font-bold tracking-tight"
            />
            <Badge
              className={cn(
                certificationTierBadgeShellClass,
                certificationTierBadgeClass(tier),
              )}
              aria-label={certificationTierLabel(tier)}
              title={certificationTierSectionTitle(tier)}
            >
              <CertificationTierMedallion
                tier={tier}
                className={certificationTierBadgeMedallionClass}
              />
            </Badge>
          </div>
          {level.tagline ? (
            <p className="mt-1 text-sm font-medium text-brand-gold">
              {level.tagline}
            </p>
          ) : null}
        </div>
      )}

      {isAdmin && !viewAs ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <SendInAppNoticeTextButton
            preset={{ kind: "certificationLevel", levelId }}
            presetSummary={level.name}
          />
        </div>
      ) : null}

      <section
        id="certification-path"
        aria-labelledby="certification-path-heading"
        className={cn(
          "relative overflow-hidden rounded-2xl border-2 border-brand-sky/28",
          "border-t-4 border-t-brand-sky/75 dark:border-t-brand-sky/80",
          "shadow-[inset_0_1px_0_0_color-mix(in_oklab,var(--brand-sky)45%,transparent)]",
          "dark:shadow-[inset_0_1px_0_0_color-mix(in_oklab,var(--brand-sky)50%,transparent)]",
          "bg-[color-mix(in_oklab,var(--brand-sky)_11%,var(--card))] dark:bg-[color-mix(in_oklab,var(--brand-sky)_15%,var(--card))]",
        )}
      >
        <div className="p-3 md:p-5">
          <h2
            id="certification-path-heading"
            className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-semibold tracking-tight text-foreground md:text-xl"
          >
            <Route className="h-5 w-5 shrink-0 text-brand-gold" aria-hidden />
            {viewAs ? (
              <>
                <span>Certification path</span>
                {viewAsLabel != null ? (
                  <span className="min-w-0 font-semibold text-brand-sky">
                    <span className="text-muted-foreground" aria-hidden>
                      ·
                    </span>{" "}
                    {viewAsLabel.name}
                  </span>
                ) : viewAsLabel === undefined ? (
                  <span
                    className="text-sm font-normal text-muted-foreground"
                    aria-hidden
                  >
                    …
                  </span>
                ) : (
                  <span className="text-muted-foreground">(student view)</span>
                )}
              </>
            ) : (
              "Your certification path"
            )}
          </h2>
          {roadmap.units.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No units are linked to this certification yet. An admin can attach
              units in Admin → Courses.
            </p>
          ) : (
            <ol className="mt-4 flex w-full flex-col gap-3 border-t border-border/60 pt-4">
            {roadmap.units.map((u) => {
              const pathSteps = u.pathSteps satisfies PathStep[];
              const unitCode = u.code?.trim() ?? "";
              const isWorkshop =
                (u.deliveryMode ?? "self_paced") === "live_workshop";
              const pct =
                u.stepTotal > 0
                  ? Math.round((u.stepsCompleted / u.stepTotal) * 100)
                  : u.completed
                    ? 100
                    : 0;
              /** Only not-assigned units are non-navigable; prereq / previous-unit are open for preview (view-only on unit page). */
              const certificationNavLocked =
                u.locked && u.lockReason === "entitlement";
              const unitCardHref = withViewAsQuery(
                `/units/${u.unitId}?level=${levelId}`,
                viewAsUserId,
              );
              /** One surface only (mutually exclusive) so `cn` + tailwind-merge never mix two gradients. */
              const unitPathCardSurface = u.completed
                ? "border-2 border-brand-lime/50 bg-gradient-to-br from-brand-lime/[0.11] via-muted/24 to-brand-lime/[0.11] hover:from-brand-lime/[0.15] hover:via-muted/24 hover:to-brand-lime/[0.15] dark:from-brand-lime/[0.13] dark:via-muted/16 dark:to-brand-lime/[0.13] dark:hover:from-brand-lime/[0.17] dark:hover:via-muted/18 dark:hover:to-brand-lime/[0.17]"
                : u.locked && !isWorkshop
                  ? "border border-border/80 border-l-4 border-r-4 border-l-brand-gold border-r-brand-gold bg-gradient-to-br from-muted/28 via-muted/24 to-muted/28 hover:from-muted/34 hover:via-muted/24 hover:to-muted/34 dark:from-muted/32 dark:via-muted/16 dark:to-muted/32 dark:hover:from-muted/38 dark:hover:via-muted/18 dark:hover:to-muted/38"
                  : isWorkshop
                    ? "border border-purple-500/40 border-l-4 border-r-4 border-l-purple-600 border-r-purple-600 bg-gradient-to-br from-purple-500/[0.10] via-muted/24 to-purple-500/[0.10] hover:from-purple-500/[0.14] hover:via-muted/24 hover:to-purple-500/[0.14] hover:border-purple-500/55 hover:border-l-purple-500 hover:border-r-purple-500 dark:from-purple-400/[0.12] dark:via-muted/16 dark:to-purple-400/[0.12] dark:border-purple-400/45 dark:border-l-purple-400 dark:border-r-purple-400 dark:hover:from-purple-300/[0.16] dark:hover:via-muted/18 dark:hover:to-purple-300/[0.16] dark:hover:border-purple-300/55"
                    : "border border-brand-gold/40 border-l-4 border-r-4 border-l-brand-gold border-r-brand-gold bg-gradient-to-br from-brand-gold/[0.10] via-muted/24 to-brand-gold/[0.10] hover:from-brand-gold/[0.14] hover:via-muted/24 hover:to-brand-gold/[0.14] hover:border-brand-gold/55 hover:border-l-brand-gold hover:border-r-brand-gold dark:from-brand-gold/[0.12] dark:via-muted/16 dark:to-brand-gold/[0.12] dark:border-brand-gold/35 dark:border-l-brand-gold dark:border-r-brand-gold dark:hover:from-brand-gold/[0.16] dark:hover:via-muted/18 dark:hover:to-brand-gold/[0.16] dark:hover:border-brand-gold/50";
              const cardClassName = cn(
                "block w-full rounded-xl border px-3 py-2 text-left shadow-sm",
                /* No base hover fill — it sits under the gradient and reads as a flat “disabled” card. */
                unitPathCardSurface,
                certificationNavLocked &&
                  "cursor-not-allowed ring-1 ring-inset ring-foreground/10 dark:ring-foreground/15",
              );
              const reg = u.workshopRegistration;
              const showRegisteredSlot =
                isWorkshop && reg != null && !u.completed;
              const cardBody = (
                <div className="flex flex-col gap-1.5 text-left">
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
                    {isWorkshop ? "Live webinar" : "Self-paced"}
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
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-snug">
                      <span className="line-clamp-3 text-sm font-semibold text-foreground">
                        {u.title}
                      </span>
                      {unitCode ? (
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {unitCode}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  {showRegisteredSlot ? (
                    <p className="text-[10px] font-semibold leading-snug text-purple-800 tabular-nums dark:text-purple-200">
                      Registered · {formatWorkshopSlot(reg.startsAt, reg.endsAt)}
                    </p>
                  ) : null}
                  {u.locked && u.lockReason === "prerequisite" ? (
                    <p className="text-[11px] font-medium text-neutral-700 dark:text-neutral-400">
                      Prerequisites required
                    </p>
                  ) : u.locked && u.lockReason === "entitlement" ? (
                    <p className="text-[11px] text-muted-foreground">
                      Not assigned to your account — view only
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
              );
              const linkAria = `${unitCode ? `${unitCode}, ` : ""}${u.title}, ${isWorkshop ? "live webinar" : "self-paced"}${u.completed ? ", completed" : ""}${
                u.locked
                  ? u.lockReason === "prerequisite"
                    ? ", prerequisites required, open to review"
                    : u.lockReason === "previous_unit"
                      ? ", open to review, complete the previous unit to progress"
                      : ", later in certification path"
                  : ""
              }`;
              const workshopOpenAria = `${unitCode ? `${unitCode}, ` : ""}${u.title}, live webinar${u.completed ? ", completed" : ""}${u.locked ? ", later in certification path" : ""}. Opens scheduled sessions for this unit.`;
              return (
                <li
                  key={u.unitId}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-1 md:gap-1.5"
                >
                  <div className="w-full shrink-0 sm:max-w-[min(100%,260px)] sm:w-[216px]">
                    {!u.completed && isWorkshop ? (
                      viewAs ? (
                        <div
                          className={cn(
                            cardClassName,
                            "cursor-not-allowed opacity-100 ring-1 ring-inset ring-foreground/10 dark:ring-foreground/15",
                          )}
                          aria-label={`${u.title}, workshop preview (register as the student in the app)`}
                        >
                          {cardBody}
                        </div>
                      ) : u.locked && u.lockReason === "entitlement" ? (
                        <div
                          className={cn(
                            cardClassName,
                            "cursor-not-allowed opacity-100 ring-1 ring-inset ring-foreground/10 dark:ring-foreground/15",
                          )}
                          aria-label={`${u.title}, not assigned to your account`}
                        >
                          {cardBody}
                        </div>
                      ) : (
                      <button
                        type="button"
                        className={cn(
                          cardClassName,
                          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        )}
                        aria-label={workshopOpenAria}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setWorkshopPickerUnitId(u.unitId);
                          setWorkshopPickerTitle(u.title);
                          // Defer open until after this click completes so the new backdrop
                          // does not treat the same pointer sequence as an outside dismiss
                          // (avoids a second open / empty-then-filled flash).
                          window.setTimeout(() => {
                            setWorkshopPickerOpen(true);
                          }, 0);
                        }}
                      >
                        {cardBody}
                      </button>
                      )
                    ) : certificationNavLocked ? (
                      <div
                        role="group"
                        className={cardClassName}
                        aria-label={linkAria}
                      >
                        {cardBody}
                      </div>
                    ) : (
                      <Link
                        href={unitCardHref}
                        className={cardClassName}
                        aria-label={linkAria}
                      >
                        {cardBody}
                      </Link>
                    )}
                  </div>

                  {pathSteps.length > 0 ? (
                    <>
                      <ArrowRight
                        className="hidden h-4 w-5 shrink-0 text-muted-foreground/75 sm:-mx-0.5 sm:block md:h-4 md:w-6"
                        aria-hidden
                        strokeWidth={2}
                      />
                      <div className="min-w-0 flex-1 overflow-x-auto overflow-y-visible pb-1 [-webkit-overflow-scrolling:touch]">
                        <ol
                          className="flex w-max list-none flex-row flex-nowrap items-center gap-x-0 pr-1"
                          aria-label={`Steps in unit: ${unitCode ? `${unitCode} — ` : ""}${u.title}`}
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
                                  className="mx-0 h-3.5 w-4 shrink-0 text-muted-foreground/75 sm:h-4 sm:w-5"
                                  aria-hidden
                                  strokeWidth={2}
                                />
                              ) : null}
                              <PathStepNode
                                step={step}
                                unitId={u.unitId}
                                levelId={levelId}
                                unitLocked={
                                  u.locked && u.lockReason === "entitlement"
                                }
                                viewAsUserId={viewAsUserId}
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

      {level.description.trim() ? (
        <div className="max-w-3xl">
          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {level.description}
          </p>
        </div>
      ) : null}

      <Dialog
        open={workshopPickerOpen}
        onOpenChange={(open) => {
          setWorkshopPickerOpen(open);
          if (!open) {
            setWorkshopPickerUnitId(null);
          }
        }}
      >
        <DialogContent
          className={cn(
            "max-w-lg gap-2 border-2 border-purple-500/45 bg-background shadow-lg shadow-purple-500/15 ring-purple-500/20 sm:max-w-lg",
            "dark:border-purple-400/40 dark:bg-card dark:shadow-purple-950/40 dark:ring-purple-400/25",
          )}
        >
          <DialogHeader>
            <Badge
              variant="outline"
              className="h-5 w-fit border-purple-500/50 bg-purple-500/10 px-2 py-0 text-[10px] font-bold uppercase tracking-wide text-purple-950 dark:border-purple-400/50 dark:bg-purple-500/15 dark:text-purple-100"
            >
              Webinar unit
            </Badge>
            <DialogTitle className="text-balance text-purple-950 dark:text-purple-50">
              {workshopPickerTitle ||
                workshopPickerData?.unitTitle ||
                "Webinar sessions"}
            </DialogTitle>
            <DialogDescription className="text-purple-900/85 dark:text-purple-200/90">
              Register for one session below. To switch dates, unregister from
              your current session first, then pick another.
            </DialogDescription>
            {workshopPickerUnitId ? (
              <div className="pt-1">
                <Link
                  href={withViewAsQuery(
                    `/units/${workshopPickerUnitId}?level=${levelId}`,
                    viewAsUserId,
                  )}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "h-8 border-purple-500/45 text-purple-900 hover:bg-purple-500/10 dark:border-purple-400/50 dark:text-purple-100 dark:hover:bg-purple-500/15",
                  )}
                >
                  Open webinar unit
                </Link>
              </div>
            ) : null}
          </DialogHeader>
          <div className="max-h-[min(70vh,480px)] space-y-2 overflow-y-auto pr-1">
            {workshopPickerData === undefined ? (
              <p className="text-sm text-purple-900/70 dark:text-purple-200/80">
                Loading sessions…
              </p>
            ) : workshopPickerData === null ? (
              <p className="text-sm text-purple-900/70 dark:text-purple-200/80">
                You cannot access sessions for this webinar.
              </p>
            ) : workshopPickerData.sessions.length === 0 ? (
              <p className="text-sm text-purple-900/70 dark:text-purple-200/80">
                No upcoming sessions are scheduled for this unit yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {workshopPickerData.sessions.map(({ session, registered, full }) => (
                  <li
                    key={session._id}
                    className="flex flex-col gap-2 rounded-lg border border-purple-500/30 bg-purple-500/[0.06] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between dark:border-purple-400/25 dark:bg-purple-500/[0.10]"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-purple-950 tabular-nums dark:text-purple-50">
                        {formatWorkshopSlot(session.startsAt, session.endsAt)}
                      </p>
                      {session.titleOverride ? (
                        <p className="mt-0.5 text-[11px] text-purple-900/75 dark:text-purple-200/80">
                          {session.titleOverride}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {registered ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 border-purple-500/45 text-purple-900 hover:bg-purple-500/10 dark:border-purple-400/50 dark:text-purple-100 dark:hover:bg-purple-500/15"
                          onClick={async () => {
                            try {
                              await unregisterWorkshop({
                                sessionId: session._id,
                              });
                              toast.success("Unregistered — you can pick another session.");
                            } catch (e) {
                              toast.error(
                                e instanceof Error ? e.message : "Failed",
                              );
                            }
                          }}
                        >
                          Unregister
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 bg-purple-600 text-white hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-500"
                          disabled={full}
                          onClick={async () => {
                            try {
                              await registerWorkshop({
                                sessionId: session._id,
                              });
                              toast.success("You are registered for this session.");
                            } catch (e) {
                              toast.error(
                                e instanceof Error ? e.message : "Failed",
                              );
                            }
                          }}
                        >
                          {full ? "Full" : "Register"}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
