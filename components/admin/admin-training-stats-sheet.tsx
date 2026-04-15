"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export type AdminTrainingStatsTarget =
  | { kind: "unit"; unitId: Id<"units"> }
  | { kind: "certification"; levelId: Id<"certificationLevels"> };

function WeeklyBars({
  labels,
  values,
  colorClass,
}: {
  labels: string[];
  values: number[];
  colorClass: string;
}) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-28 items-end gap-0.5 sm:gap-1">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex min-w-0 flex-1 flex-col items-center gap-1"
        >
          <div
            className="flex w-full flex-1 flex-col justify-end"
            title={`${labels[i] ?? ""}: ${v}`}
          >
            <div
              className={cn(
                "w-full min-h-[2px] rounded-sm transition-colors",
                colorClass,
              )}
              style={{ height: `${Math.max(6, (v / max) * 100)}%` }}
            />
          </div>
          <span className="max-w-full truncate text-[9px] text-muted-foreground">
            {labels[i]}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AdminTrainingStatsSheet({
  open,
  onOpenChange,
  target,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: AdminTrainingStatsTarget | null;
}) {
  const unitStats = useQuery(
    api.adminStats.unitStatsAdmin,
    open && target?.kind === "unit"
      ? { unitId: target.unitId }
      : "skip",
  );
  const certStats = useQuery(
    api.adminStats.certificationStatsAdmin,
    open && target?.kind === "certification"
      ? { levelId: target.levelId }
      : "skip",
  );

  const loading =
    open &&
    target &&
    ((target.kind === "unit" && unitStats === undefined) ||
      (target.kind === "certification" && certStats === undefined));

  const empty =
    open &&
    target &&
    ((target.kind === "unit" && unitStats === null) ||
      (target.kind === "certification" && certStats === null));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b border-border px-4 py-3 text-left">
          <SheetTitle className="pr-10">
            {target?.kind === "unit"
              ? "Unit analytics"
              : target?.kind === "certification"
                ? "Certification analytics"
                : "Training analytics"}
          </SheetTitle>
          <SheetDescription>
            Starts, completions, and learner rows from Convex progress tables.
            Buckets are rolling weeks (newest on the right).
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 py-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : empty ? (
            <p className="text-sm text-muted-foreground">
              No data for this selection.
            </p>
          ) : target?.kind === "unit" && unitStats ? (
            <Tabs defaultValue="overview" className="gap-3">
              <TabsList variant="line" className="w-full min-w-0">
                <TabsTrigger value="overview" className="flex-1 text-xs">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="learners" className="flex-1 text-xs">
                  Learners
                </TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="mt-0 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {unitStats.title}
                  </h3>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                      <dt className="text-muted-foreground">Learners</dt>
                      <dd className="text-base font-semibold tabular-nums">
                        {unitStats.uniqueLearners}
                      </dd>
                    </div>
                    <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                      <dt className="text-muted-foreground">Completed</dt>
                      <dd className="text-base font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {unitStats.completedCount}
                      </dd>
                    </div>
                    <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                      <dt className="text-muted-foreground">In progress</dt>
                      <dd className="text-base font-semibold tabular-nums">
                        {unitStats.inProgressCount}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-medium text-muted-foreground">
                    Content step starts (events)
                  </h4>
                  <WeeklyBars
                    labels={unitStats.weekLabels}
                    values={unitStats.contentStartsWeekly}
                    colorClass="bg-purple-500/80 dark:bg-purple-400/80"
                  />
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-medium text-muted-foreground">
                    Content step completions (events)
                  </h4>
                  <WeeklyBars
                    labels={unitStats.weekLabels}
                    values={unitStats.contentCompletesWeekly}
                    colorClass="bg-brand-sky/90 dark:bg-brand-sky/80"
                  />
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-medium text-muted-foreground">
                    Latest step state — started
                  </h4>
                  <WeeklyBars
                    labels={unitStats.weekLabels}
                    values={unitStats.userContentStartedWeekly}
                    colorClass="bg-muted-foreground/50"
                  />
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-medium text-muted-foreground">
                    Latest step state — completed / passed
                  </h4>
                  <WeeklyBars
                    labels={unitStats.weekLabels}
                    values={unitStats.userContentCompletedWeekly}
                    colorClass="bg-brand-gold/90 dark:bg-brand-gold/75"
                  />
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-medium text-muted-foreground">
                    Whole-unit completions
                  </h4>
                  <WeeklyBars
                    labels={unitStats.weekLabels}
                    values={unitStats.unitCompletesWeekly}
                    colorClass="bg-emerald-600/85 dark:bg-emerald-500/80"
                  />
                </div>
              </TabsContent>
              <TabsContent value="learners" className="mt-0">
                <p className="mb-2 text-xs text-muted-foreground">
                  Drill-down: most recently active first. Company from user
                  record.
                </p>
                <div className="max-h-[min(55vh,420px)] overflow-auto rounded-md border">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                      <tr className="border-b">
                        <th className="px-2 py-1.5 font-medium">Learner</th>
                        <th className="px-2 py-1.5 font-medium">Company</th>
                        <th className="px-2 py-1.5 font-medium">Status</th>
                        <th className="px-2 py-1.5 font-medium">Last active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unitStats.learners.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-2 py-4 text-center text-muted-foreground"
                          >
                            No learner progress yet.
                          </td>
                        </tr>
                      ) : (
                        unitStats.learners.map((row) => (
                          <tr
                            key={row.userId}
                            className="border-b border-border/60 last:border-0"
                          >
                            <td className="max-w-[9rem] px-2 py-1.5 align-top">
                              <div className="truncate font-medium">
                                {row.name}
                              </div>
                              <div className="truncate text-[10px] text-muted-foreground">
                                {row.email}
                              </div>
                            </td>
                            <td className="max-w-[6rem] truncate px-2 py-1.5 align-top text-muted-foreground">
                              {row.companyName ?? "—"}
                            </td>
                            <td className="whitespace-nowrap px-2 py-1.5 align-top">
                              {row.completed ? (
                                <span className="text-emerald-700 dark:text-emerald-400">
                                  Done
                                </span>
                              ) : (
                                <span>In progress</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-2 py-1.5 align-top tabular-nums text-muted-foreground">
                              {format(row.lastAccessed, "d MMM yy")}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          ) : target?.kind === "certification" && certStats ? (
            <Tabs defaultValue="overview" className="gap-3">
              <TabsList variant="line" className="w-full min-w-0">
                <TabsTrigger value="overview" className="flex-1 text-xs">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="units" className="flex-1 text-xs">
                  Units
                </TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="mt-0 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {certStats.title}
                  </h3>
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
                    <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                      <dt className="text-muted-foreground">Units</dt>
                      <dd className="text-base font-semibold tabular-nums">
                        {certStats.unitCount}
                      </dd>
                    </div>
                    <div className="rounded-md border bg-muted/30 px-2 py-1.5">
                      <dt className="text-muted-foreground">Learners</dt>
                      <dd className="text-base font-semibold tabular-nums">
                        {certStats.uniqueLearners}
                      </dd>
                    </div>
                    <div className="rounded-md border bg-muted/30 px-2 py-1.5 sm:col-span-2">
                      <dt className="text-muted-foreground">
                        Unit completions (rows)
                      </dt>
                      <dd className="text-base font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                        {certStats.completedUnitRows}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-medium text-muted-foreground">
                    Content starts (all units)
                  </h4>
                  <WeeklyBars
                    labels={certStats.weekLabels}
                    values={certStats.contentStartsWeekly}
                    colorClass="bg-purple-500/80 dark:bg-purple-400/80"
                  />
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-medium text-muted-foreground">
                    Content completions (events)
                  </h4>
                  <WeeklyBars
                    labels={certStats.weekLabels}
                    values={certStats.contentCompletesWeekly}
                    colorClass="bg-brand-sky/90 dark:bg-brand-sky/80"
                  />
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-medium text-muted-foreground">
                    Whole-unit completions
                  </h4>
                  <WeeklyBars
                    labels={certStats.weekLabels}
                    values={certStats.unitCompletesWeekly}
                    colorClass="bg-emerald-600/85 dark:bg-emerald-500/80"
                  />
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-medium text-muted-foreground">
                    Latest step state — started (all units)
                  </h4>
                  <WeeklyBars
                    labels={certStats.weekLabels}
                    values={certStats.userContentStartedWeekly}
                    colorClass="bg-muted-foreground/50"
                  />
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-medium text-muted-foreground">
                    Latest step state — completed (all units)
                  </h4>
                  <WeeklyBars
                    labels={certStats.weekLabels}
                    values={certStats.userContentCompletedWeekly}
                    colorClass="bg-brand-gold/90 dark:bg-brand-gold/75"
                  />
                </div>
              </TabsContent>
              <TabsContent value="units" className="mt-0">
                <p className="mb-2 text-xs text-muted-foreground">
                  Per-unit learner counts and completions in this certification.
                </p>
                <div className="max-h-[min(55vh,420px)] overflow-auto rounded-md border">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                      <tr className="border-b">
                        <th className="px-2 py-1.5 font-medium">Unit</th>
                        <th className="px-2 py-1.5 font-medium text-right">
                          Learners
                        </th>
                        <th className="px-2 py-1.5 font-medium text-right">
                          Done
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {certStats.units.map((u) => (
                        <tr
                          key={u.unitId}
                          className="border-b border-border/60 last:border-0"
                        >
                          <td className="max-w-[14rem] truncate px-2 py-1.5 font-medium">
                            {u.title}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums">
                            {u.learners}
                          </td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                            {u.completed}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
