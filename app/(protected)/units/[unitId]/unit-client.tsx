"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ContentItemView } from "@/components/content-item-view";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Lock } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export default function UnitClient({ unitId: unitIdRaw }: { unitId: string }) {
  const unitId = unitIdRaw as Id<"units">;

  const unit = useQuery(api.units.get, { unitId });
  const items = useQuery(api.content.listByUnit, { unitId });
  const assignments = useQuery(api.assignments.listByUnit, { unitId });
  const progress = useQuery(api.progress.getForUserAndUnit, { unitId });
  const prereqStatus = useQuery(api.prerequisites.statusForUnit, { unitId });

  const assignment = assignments?.[0];
  const lastResult = useQuery(
    api.progress.myResultsForAssignment,
    assignment ? { assignmentId: assignment._id } : "skip",
  );

  const markComplete = useMutation(api.progress.markUnitComplete);
  const touchUnit = useMutation(api.progress.touchUnit);
  const submitAssignment = useMutation(api.progress.submitAssignment);

  const [answers, setAnswers] = useState<Record<string, string>>({});

  const sortedItems = useMemo(
    () => (items ? [...items].sort((a, b) => a.order - b.order) : []),
    [items],
  );

  useEffect(() => {
    if (
      unit === undefined ||
      unit === null ||
      prereqStatus === undefined ||
      prereqStatus === null
    ) {
      return;
    }
    if (!prereqStatus.ready) {
      return;
    }
    void touchUnit({ unitId }).catch(() => {
      /* touch errors surfaced via toast on explicit actions */
    });
  }, [unitId, unit, touchUnit, prereqStatus]);

  if (
    unit === undefined ||
    items === undefined ||
    assignments === undefined ||
    progress === undefined ||
    prereqStatus === undefined
  ) {
    return <div className="animate-pulse h-64 bg-muted rounded" />;
  }

  if (unit === null) {
    return <p className="text-muted-foreground">Unit not found or access denied.</p>;
  }

  if (prereqStatus === null) {
    return (
      <p className="text-muted-foreground">
        Unable to load prerequisite rules for this unit.
      </p>
    );
  }

  const locked = !prereqStatus.ready;

  async function onMarkComplete() {
    try {
      await markComplete({ unitId });
      toast.success("Unit marked complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save progress");
    }
  }

  async function onSubmitAssessment() {
    if (!assignment) {
      return;
    }
    try {
      const arr = assignment.questions.map((q) => ({
        questionId: q.id,
        value: answers[q.id] ?? "",
      }));
      const res = await submitAssignment({
        assignmentId: assignment._id,
        answers: arr,
      });
      if (res.passed) {
        toast.success(`Passed — ${res.score}%`);
      } else {
        toast.error(`Not passed — ${res.score}% (need ${res.passingScore}%)`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{unit.title}</h1>
        <p className="text-muted-foreground">{unit.description}</p>
        <div className="mt-3 flex items-center gap-3">
          <Progress
            value={locked ? 0 : progress?.completed ? 100 : 30}
            className="h-2 flex-1 max-w-xs"
          />
          <span className="text-xs text-muted-foreground">
            {locked
              ? "Locked"
              : progress?.completed
                ? "Completed"
                : "In progress"}
          </span>
        </div>
      </div>

      {locked && prereqStatus.prerequisites.length > 0 ? (
        <div
          className="flex gap-3 rounded-xl border border-brand-gold/35 bg-brand-gold/10 px-4 py-3 text-sm"
          role="status"
        >
          <Lock className="h-5 w-5 shrink-0 text-brand-gold" />
          <div className="space-y-2">
            <p className="font-medium text-foreground">
              Complete these units first (they may be in another certification):
            </p>
            <ul className="list-inside list-disc space-y-1 text-muted-foreground">
              {prereqStatus.prerequisites
                .filter((p) => !p.completed)
                .map((p) => (
                  <li key={p.unitId}>
                    <Link
                      href={`/units/${p.unitId}`}
                      className="font-medium text-brand-sky underline-offset-4 hover:underline"
                    >
                      {p.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      — {p.levelName}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      ) : null}

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content" disabled={locked}>
            Content
          </TabsTrigger>
          <TabsTrigger value="assessment" disabled={locked || !assignment}>
            Assessment
          </TabsTrigger>
        </TabsList>
        <TabsContent value="content" className="mt-4 space-y-4">
          <ScrollArea className="h-[calc(100vh-280px)] md:h-auto md:max-h-none">
            <div className="space-y-4 pr-4">
              {locked ? (
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-brand-gold mt-0.5" />
                  Content is available after prerequisites are completed.
                </p>
              ) : null}
              {!locked &&
                sortedItems.map((item) => (
                  <ContentItemView
                    key={item._id}
                    item={item}
                    unitId={unitId}
                  />
                ))}
              {!locked && !sortedItems.length && (
                <p className="text-sm text-muted-foreground">
                  No content published for this unit yet.
                </p>
              )}
            </div>
          </ScrollArea>
          <Button
            disabled={locked}
            onClick={() => void onMarkComplete()}
          >
            Mark content complete
          </Button>
        </TabsContent>
        <TabsContent value="assessment" className="mt-4">
          {assignment && !locked && (
            <Card>
              <CardHeader>
                <CardTitle>{assignment.title}</CardTitle>
                <CardDescription>{assignment.description}</CardDescription>
                <p className="text-sm text-muted-foreground">
                  Passing score: {assignment.passingScore}%
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {assignment.questions.map((q) => (
                  <div key={q.id} className="space-y-2">
                    <Label className="text-base">{q.question}</Label>
                    {q.type === "multiple_choice" && q.options && (
                      <div className="flex flex-wrap gap-2">
                        {q.options.map((opt) => (
                          <Button
                            key={opt}
                            type="button"
                            size="sm"
                            variant={answers[q.id] === opt ? "default" : "outline"}
                            onClick={() =>
                              setAnswers((a) => ({ ...a, [q.id]: opt }))
                            }
                          >
                            {opt}
                          </Button>
                        ))}
                      </div>
                    )}
                    {q.type === "text" && (
                      <Input
                        value={answers[q.id] ?? ""}
                        onChange={(e) =>
                          setAnswers((a) => ({
                            ...a,
                            [q.id]: e.target.value,
                          }))
                        }
                      />
                    )}
                  </div>
                ))}
                <Button onClick={() => void onSubmitAssessment()}>Submit assessment</Button>
                {lastResult && (
                  <p className="text-sm text-muted-foreground">
                    Last attempt: {lastResult.score}% —{" "}
                    {lastResult.passed ? "Passed" : "Not passed"} on{" "}
                    {new Date(lastResult.completedAt).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
