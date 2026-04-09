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
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export default function UnitClient({ unitId: unitIdRaw }: { unitId: string }) {
  const unitId = unitIdRaw as Id<"units">;

  const unit = useQuery(api.units.get, { unitId });
  const items = useQuery(api.content.listByUnit, { unitId });
  const assignments = useQuery(api.assignments.listByUnit, { unitId });
  const progress = useQuery(api.progress.getForUserAndUnit, { unitId });

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
    if (unit === undefined || unit === null) {
      return;
    }
    void touchUnit({ unitId });
  }, [unitId, unit, touchUnit]);

  if (
    unit === undefined ||
    items === undefined ||
    assignments === undefined ||
    progress === undefined
  ) {
    return <div className="animate-pulse h-64 bg-muted rounded" />;
  }

  if (unit === null) {
    return <p className="text-muted-foreground">Unit not found or access denied.</p>;
  }

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
          <Progress value={progress?.completed ? 100 : 30} className="h-2 flex-1 max-w-xs" />
          <span className="text-xs text-muted-foreground">
            {progress?.completed ? "Completed" : "In progress"}
          </span>
        </div>
      </div>

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="assessment" disabled={!assignment}>
            Assessment
          </TabsTrigger>
        </TabsList>
        <TabsContent value="content" className="mt-4 space-y-4">
          <ScrollArea className="h-[calc(100vh-280px)] md:h-auto md:max-h-none">
            <div className="space-y-4 pr-4">
              {sortedItems.map((item) => (
                <ContentItemView key={item._id} item={item} />
              ))}
              {!sortedItems.length && (
                <p className="text-sm text-muted-foreground">
                  No content published for this unit yet.
                </p>
              )}
            </div>
          </ScrollArea>
          <Button onClick={() => void onMarkComplete()}>Mark content complete</Button>
        </TabsContent>
        <TabsContent value="assessment" className="mt-4">
          {assignment && (
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
