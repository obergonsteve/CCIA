"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "convex/react";
import { CheckCircle2, ChevronRight, Circle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

export default function CertificationLevelClient({
  levelId: levelIdRaw,
}: {
  levelId: string;
}) {
  const levelId = levelIdRaw as Id<"certificationLevels">;

  const level = useQuery(api.certifications.get, { levelId });
  const units = useQuery(api.units.listByLevel, { levelId });
  const progressList = useQuery(api.progress.listForUser);

  const rows = useMemo(() => {
    if (!units || !progressList) {
      return [];
    }
    return units.map((unit) => {
      const p = progressList.find((x) => x.unitId === unit._id);
      const pct = p?.completed ? 100 : p ? 45 : 0;
      return { unit, p, pct };
    });
  }, [units, progressList]);

  if (level === undefined || units === undefined) {
    return <div className="animate-pulse h-48 bg-muted rounded" />;
  }

  if (level === null) {
    return <p className="text-muted-foreground">Level not found or access denied.</p>;
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
      <p className="text-muted-foreground leading-relaxed max-w-3xl">
        {level.description}
      </p>

      <ul className="space-y-3">
        {rows.map(({ unit, p, pct }) => (
          <li key={unit._id}>
            <Link href={`/units/${unit._id}`}>
              <Card className="transition-colors hover:bg-muted/40">
                <CardHeader className="space-y-3">
                  <div className="flex flex-row items-start gap-3">
                    {p?.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-brand-lime shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg">{unit.title}</CardTitle>
                      <CardDescription>{unit.description}</CardDescription>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </div>
                  <Progress value={pct} className="h-2" />
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
