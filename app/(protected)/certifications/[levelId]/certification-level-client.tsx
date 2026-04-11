"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "convex/react";
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  Lock,
  Route,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                {level.name}
              </h1>
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
          <h1 className="text-2xl font-bold tracking-tight">{level.name}</h1>
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
        className="rounded-2xl border-2 border-brand-gold/25 bg-muted/30 p-4 shadow-sm md:p-6"
      >
        <h2
          id="certification-path-heading"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground md:text-xl"
        >
          <Route className="h-5 w-5 shrink-0 text-brand-gold" aria-hidden />
          Your certification path
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Units unlock in order. Open a unit to follow lessons and assessments
          step by step; the next step opens when the current one is completed
          successfully.
        </p>
        {roadmap.units.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No units are linked to this certification yet. An admin can attach
            units in Admin → Courses.
          </p>
        ) : (
          <div className="mt-4 w-full overflow-x-auto overflow-y-visible pb-1 [-webkit-overflow-scrolling:touch]">
            <ol className="flex w-max min-w-full flex-nowrap gap-3 md:flex-wrap md:w-full">
              {roadmap.units.map((u, i) => {
                const pct =
                  u.stepTotal > 0
                    ? Math.round((u.stepsCompleted / u.stepTotal) * 100)
                    : u.completed
                      ? 100
                      : 0;
                return (
                  <li
                    key={u.unitId}
                    className="w-[min(100%,240px)] shrink-0 md:w-[min(100%,260px)] md:shrink"
                  >
                    <Link
                      href={`/units/${u.unitId}?level=${levelId}`}
                      className={cn(
                        "block h-full rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-brand-sky/40 hover:bg-muted/50",
                        u.locked && "cursor-not-allowed opacity-75",
                      )}
                      aria-disabled={u.locked}
                      onClick={(e) => {
                        if (u.locked) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <div className="flex items-start gap-2">
                        {u.completed ? (
                          <CheckCircle2 className="h-5 w-5 text-brand-lime shrink-0 mt-0.5" />
                        ) : u.locked ? (
                          <Lock className="h-5 w-5 text-brand-gold shrink-0 mt-0.5" />
                        ) : (
                          <Circle className="h-5 w-5 text-brand-sky shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-muted-foreground">
                            Unit {i + 1}
                          </p>
                          <p className="font-semibold leading-snug text-foreground">
                            {u.title}
                          </p>
                          {u.locked && u.lockReason === "prerequisite" ? (
                            <p className="mt-1 text-[11px] text-brand-gold">
                              Prerequisites required
                            </p>
                          ) : u.locked && u.lockReason === "previous_unit" ? (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Complete the previous unit first
                            </p>
                          ) : null}
                          <Progress
                            value={u.locked ? 0 : pct}
                            className="mt-2 h-1.5"
                          />
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {u.stepsCompleted}/{u.stepTotal || 0} steps in unit
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
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
