"use client";

import { api } from "@/convex/_generated/api";
import { CertificationTierMedallion } from "@/components/certification-tier-medallion";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  Layers,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  CERTIFICATION_TIER_ORDER,
  certificationTierBadgeClass,
  certificationTierLabel,
  certificationTierSectionTitle,
  effectiveCertificationTier,
  type CertificationTierKey,
} from "@/lib/certificationTier";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

const CERT_LIST_TIER_SECTION: Record<CertificationTierKey, string> = {
  bronze:
    "border-brand-lime/45 bg-brand-lime/[0.09] shadow-sm shadow-brand-lime/15 dark:border-brand-lime/35 dark:bg-brand-lime/[0.12] dark:shadow-brand-lime/10",
  silver:
    "border-brand-sky/45 bg-brand-sky/[0.08] shadow-sm shadow-brand-sky/15 dark:border-brand-sky/35 dark:bg-brand-sky/[0.11] dark:shadow-brand-sky/10",
  gold:
    "border-brand-gold/50 bg-brand-gold/[0.10] shadow-sm shadow-brand-gold/20 dark:border-brand-gold/40 dark:bg-brand-gold/[0.13] dark:shadow-brand-gold/15",
};

export default function CertificationsClient() {
  const catalog = useQuery(api.certifications.listCatalogForUser);

  const grouped = useMemo(() => {
    if (!catalog?.length) {
      return [];
    }
    return CERTIFICATION_TIER_ORDER.map((tier) => ({
      tier,
      levels: catalog.filter((l) => effectiveCertificationTier(l) === tier),
    })).filter((g) => g.levels.length > 0);
  }, [catalog]);

  if (!catalog) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-80 animate-pulse rounded-2xl bg-muted/80"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8 md:space-y-7">
      <div className="relative overflow-hidden rounded-2xl border-2 border-brand-gold/30 bg-gradient-to-br from-brand-lime/14 via-card to-brand-sky/16 px-6 py-10 shadow-lg shadow-brand-sky/10 md:px-10 md:py-12">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand-lime/30 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-brand-sky/25 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute top-1/2 right-1/4 h-32 w-32 rounded-full bg-brand-gold/25 blur-2xl"
          aria-hidden
        />
        <div className="relative max-w-2xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold">
            Certification pathways
          </p>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl bg-gradient-to-br from-brand-lime via-brand-gold to-brand-sky bg-clip-text text-transparent">
            Land lease community training
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed md:text-lg">
            Structured courses with videos, slide decks, curated links, and
            short assessments — built for community operators and site managers
            across Australia.
          </p>
        </div>
      </div>

      {catalog.length === 0 ? (
        <p className="text-muted-foreground">
          No certifications are available yet. An admin can seed demo content
          with{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            npx convex run seed:seedLandLeaseCurriculum
          </code>
          . If levels exist but unit prerequisites are missing, run{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            npx convex run prerequisites:syncLandLeasePrerequisitesFromCurriculum
          </code>
          .
        </p>
      ) : (
        <div>
          <nav
            className="mb-2 flex flex-wrap items-center justify-center gap-3 sm:mb-2.5 sm:gap-3.5"
            aria-label="Jump to certification tier"
          >
            {grouped.map(({ tier }) => (
              <a
                key={tier}
                href={`#cert-tier-${tier}`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "h-auto min-h-0 gap-2 rounded-full border-brand-sky/35 bg-card/90 px-4 py-1.5 text-sm font-semibold shadow-sm hover:bg-muted/60",
                  tier === "bronze" &&
                    "border-brand-lime/45 bg-brand-lime/12 hover:bg-brand-lime/18",
                  tier === "silver" &&
                    "border-brand-sky/45 bg-brand-sky/10 hover:bg-brand-sky/16",
                  tier === "gold" &&
                    "border-brand-gold/50 bg-brand-gold/12 hover:bg-brand-gold/18",
                )}
                title={certificationTierSectionTitle(tier)}
              >
                <CertificationTierMedallion tier={tier} className="size-6" />
                <span className="leading-none">
                  {certificationTierLabel(tier)}
                </span>
              </a>
            ))}
          </nav>
          <div className="space-y-10 md:space-y-12">
          {grouped.map(({ tier, levels }) => (
            <section
              key={tier}
              id={`cert-tier-${tier}`}
              className={cn(
                "scroll-mt-20 space-y-5 rounded-2xl border-2 p-5 md:p-6",
                CERT_LIST_TIER_SECTION[tier],
              )}
            >
              <div className="border-b border-foreground/10 pb-3 dark:border-foreground/15">
                <h3 className="text-lg font-semibold tracking-tight">
                  {certificationTierSectionTitle(tier)}
                </h3>
              </div>
              <ul className="grid gap-8 md:grid-cols-2">
                {levels.map((level) => (
                  <li key={level._id}>
                    <Link
                      href={`/certifications/${level._id}`}
                      className="group block"
                    >
                      <Card className="overflow-hidden border-border/80 bg-card/90 shadow-sm transition-all duration-300 hover:border-brand-sky/45 hover:shadow-lg hover:shadow-brand-gold/15">
                        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                          {level.thumbnailUrl ? (
                            <Image
                              src={level.thumbnailUrl}
                              alt={
                                level.code?.trim()
                                  ? `${level.name} (${level.code.trim()})`
                                  : level.name
                              }
                              fill
                              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                              sizes="(max-width: 768px) 100vw, 50vw"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-lime/25 via-brand-gold/15 to-brand-sky/20">
                              <GraduationCap className="h-16 w-16 text-brand-charcoal/35" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                          <div className="absolute left-4 top-4">
                            <Badge
                              className={cn(
                                "h-auto min-h-10 items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm",
                                certificationTierBadgeClass(tier),
                              )}
                              aria-label={certificationTierLabel(tier)}
                              title={certificationTierSectionTitle(tier)}
                            >
                              <CertificationTierMedallion
                                tier={tier}
                                className="size-[2.33rem]"
                              />
                            </Badge>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 p-5">
                            <h2 className="text-xl font-bold tracking-tight text-foreground drop-shadow-sm md:text-2xl">
                              {level.name}
                            </h2>
                            {level.code?.trim() ? (
                              <p className="mt-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground drop-shadow-sm md:text-xs">
                                {level.code.trim()}
                              </p>
                            ) : null}
                            {level.tagline ? (
                              <p className="mt-1 text-sm font-medium text-brand-sky">
                                {level.tagline}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="space-y-4 p-5 pt-4">
                          <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                            {level.summary?.trim() || level.description}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Badge
                              variant="secondary"
                              className="gap-1 font-normal border-0 bg-brand-lime/15 text-brand-charcoal dark:text-foreground"
                            >
                              <Layers className="h-3.5 w-3.5 text-brand-lime" />
                              {level.unitCount}{" "}
                              {level.unitCount === 1 ? "unit" : "units"}
                            </Badge>
                            <Badge
                              variant="secondary"
                              className="gap-1 font-normal border-0 bg-brand-gold/18 text-brand-charcoal dark:text-foreground"
                            >
                              <BookOpen className="h-3.5 w-3.5 text-brand-gold" />
                              {level.lessonCount} lessons
                            </Badge>
                            <Badge
                              variant="secondary"
                              className="gap-1 font-normal border-0 bg-brand-sky/15 text-brand-charcoal dark:text-foreground"
                            >
                              <ClipboardCheck className="h-3.5 w-3.5 text-brand-sky" />
                              {level.assessmentCount} assessments
                            </Badge>
                          </div>
                          <span
                            className={cn(
                              buttonVariants({ variant: "lime", size: "sm" }),
                              "w-full justify-center gap-2 sm:w-auto",
                            )}
                          >
                            Open course
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </div>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
