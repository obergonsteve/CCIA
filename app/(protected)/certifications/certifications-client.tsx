"use client";

import { api } from "@/convex/_generated/api";
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
import { cn } from "@/lib/utils";

export default function CertificationsClient() {
  const catalog = useQuery(api.certifications.listCatalogForUser);

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
    <div className="space-y-10 pb-8">
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
        <ul className="grid gap-8 md:grid-cols-2">
          {catalog.map((level) => (
            <li key={level._id}>
              <Link href={`/certifications/${level._id}`} className="group block">
                <Card className="overflow-hidden border-border/80 bg-card/90 shadow-sm transition-all duration-300 hover:border-brand-sky/45 hover:shadow-lg hover:shadow-brand-gold/15">
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                    {level.thumbnailUrl ? (
                      <Image
                        src={level.thumbnailUrl}
                        alt={level.name}
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
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <h2 className="text-xl font-bold tracking-tight text-foreground drop-shadow-sm md:text-2xl">
                        {level.name}
                      </h2>
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
                    <p className="text-xs font-medium text-brand-gold/90">
                      Next: your ordered unit path and step-by-step training
                    </p>
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
      )}
    </div>
  );
}
