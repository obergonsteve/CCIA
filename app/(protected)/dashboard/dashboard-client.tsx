"use client";

import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useQuery } from "convex/react";
import { ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

export default function DashboardClient() {
  const me = useQuery(api.users.me);
  const levels = useQuery(api.certifications.listForUser);
  const allProgress = useQuery(api.progress.listForUser);

  const levelSummaries = useMemo(() => {
    if (!levels) {
      return [];
    }
    return levels.map((level) => ({
      level,
      href: `/certifications/${level._id}`,
    }));
  }, [levels]);

  if (!me || !levels || !allProgress) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-40 bg-muted rounded" />
      </div>
    );
  }

  const totalUnitsDone = allProgress.filter((p) => p.completed).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome, {me.name}</h1>
        <p className="text-muted-foreground">
          Continue your certification journey.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-t-4 border-t-brand-lime">
          <CardHeader className="pb-2">
            <CardDescription>Units completed</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{totalUnitsDone}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Across all certification levels available to your organisation.
            </p>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-brand-gold">
          <CardHeader className="pb-2">
            <CardDescription>Your role</CardDescription>
            <CardTitle className="text-xl capitalize">{me.role}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="secondary">{me.email}</Badge>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Your certifications
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {levelSummaries.map(({ level, href }) => (
            <Card
              key={level._id}
              className="border-l-4 border-l-brand-sky/70"
            >
              <CardHeader>
                <CardTitle className="text-lg">{level.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {level.description}
                </CardDescription>
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
          ))}
        </div>
      </div>
    </div>
  );
}
