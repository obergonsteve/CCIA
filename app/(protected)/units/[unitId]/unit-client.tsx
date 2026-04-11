"use client";

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
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  CheckCircle2,
  Circle,
  Lock,
  Route,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function LegacyAssignmentStartRecorder({
  unitId,
  assignmentId,
  levelId,
  enabled,
}: {
  unitId: Id<"units">;
  assignmentId: Id<"assignments">;
  levelId?: Id<"certificationLevels">;
  enabled: boolean;
}) {
  const record = useMutation(api.contentProgress.recordLegacyAssignmentStart);
  useEffect(() => {
    if (!enabled) {
      return;
    }
    void record({ unitId, assignmentId, levelId }).catch(() => {});
  }, [enabled, unitId, assignmentId, levelId, record]);
  return null;
}

function LegacyLastResult({
  assignmentId,
}: {
  assignmentId: Id<"assignments">;
}) {
  const lastLegacyResult = useQuery(api.progress.myResultsForAssignment, {
    assignmentId,
  });
  if (!lastLegacyResult) {
    return null;
  }
  return (
    <p className="text-sm text-muted-foreground">
      Last attempt: {lastLegacyResult.score}% —{" "}
      {lastLegacyResult.passed ? "Passed" : "Not passed"} on{" "}
      {new Date(lastLegacyResult.completedAt).toLocaleString()}
    </p>
  );
}

function stepLabel(
  kind: "content" | "legacy_assignment",
  contentType?: string,
): string {
  if (kind === "legacy_assignment") {
    return "Assessment (legacy)";
  }
  switch (contentType) {
    case "video":
      return "Video";
    case "pdf":
      return "Reading";
    case "slideshow":
      return "Slideshow";
    case "link":
      return "Resource";
    case "test":
      return "Test";
    case "assignment":
      return "Assignment";
    default:
      return "Step";
  }
}

export default function UnitClient({
  unitId: unitIdRaw,
  levelId: levelIdRaw,
}: {
  unitId: string;
  levelId?: string;
}) {
  const unitId = unitIdRaw as Id<"units">;
  const levelId =
    levelIdRaw && levelIdRaw.length > 0
      ? (levelIdRaw as Id<"certificationLevels">)
      : undefined;

  const unit = useQuery(api.units.get, { unitId });
  const items = useQuery(api.content.listByUnit, { unitId });
  const assignments = useQuery(api.assignments.listByUnit, { unitId });
  const roadmap = useQuery(api.contentProgress.roadmapForUnit, {
    unitId,
    levelId,
  });
  const prereqStatus = useQuery(api.prerequisites.statusForUnit, { unitId });

  const submitAssignment = useMutation(api.progress.submitAssignment);

  const [answersByAssignment, setAnswersByAssignment] = useState<
    Record<string, Record<string, string>>
  >({});
  /** When true, completed steps appear in the strip and in the page list (default). */
  const [showCompletedSteps, setShowCompletedSteps] = useState(true);

  const itemsById = useMemo(() => {
    if (!items) {
      return new Map();
    }
    return new Map(items.map((c) => [c._id, c] as const));
  }, [items]);

  const assignmentsById = useMemo((): Map<
    Id<"assignments">,
    Doc<"assignments">
  > => {
    if (!assignments) {
      return new Map();
    }
    return new Map(assignments.map((a) => [a._id, a] as const));
  }, [assignments]);

  const visibleSteps = useMemo(() => {
    if (roadmap === undefined || roadmap === null) {
      return [];
    }
    return showCompletedSteps
      ? roadmap.steps
      : roadmap.steps.filter((r) => !r.done);
  }, [roadmap, showCompletedSteps]);

  if (
    unit === undefined ||
    items === undefined ||
    assignments === undefined ||
    roadmap === undefined ||
    prereqStatus === undefined
  ) {
    return <div className="animate-pulse h-64 bg-muted rounded" />;
  }

  if (unit === null) {
    return (
      <p className="text-muted-foreground">Unit not found or access denied.</p>
    );
  }

  if (prereqStatus === null) {
    return (
      <p className="text-muted-foreground">
        Unable to load prerequisite rules for this unit.
      </p>
    );
  }

  if (roadmap === null) {
    return (
      <p className="text-muted-foreground">Unable to load training roadmap.</p>
    );
  }

  const lockedByPrereq = !prereqStatus.ready;
  const sequentialBlockedMessage = roadmap.sequentialUnitBlocked;
  const blocked = lockedByPrereq || sequentialBlockedMessage !== null;

  async function onSubmitLegacyAssignment(assignmentId: Id<"assignments">) {
    const assignment = assignmentsById.get(assignmentId);
    if (!assignment) {
      return;
    }
    const answers = answersByAssignment[assignmentId] ?? {};
    try {
      const arr = assignment.questions.map((question) => ({
        questionId: question.id,
        value: answers[question.id] ?? "",
      }));
      const res = await submitAssignment({
        assignmentId: assignment._id,
        answers: arr,
        levelId,
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
          <Progress value={roadmap.fraction} className="h-2 flex-1 max-w-md" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {roadmap.completedSteps}/{roadmap.totalSteps || 0} steps
          </span>
        </div>
      </div>

      {lockedByPrereq && prereqStatus.prerequisites.length > 0 ? (
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

      {sequentialBlockedMessage ? (
        <div
          className="flex gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm"
          role="status"
        >
          <Route className="h-5 w-5 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground">{sequentialBlockedMessage}</p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Route className="h-4 w-4 text-brand-gold" aria-hidden />
            Your path through this unit
          </div>
          <Button
            type="button"
            variant={showCompletedSteps ? "secondary" : "outline"}
            size="sm"
            className="h-7 shrink-0 rounded-full px-3 text-xs font-medium"
            aria-pressed={showCompletedSteps}
            onClick={() => setShowCompletedSteps((v) => !v)}
          >
            {showCompletedSteps ? "Hide completed" : "Show completed"}
          </Button>
        </div>
        <ScrollArea className="w-full">
          {visibleSteps.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing to show here. Turn{" "}
              <span className="font-medium text-foreground">Show completed</span>{" "}
              on to see finished steps again.
            </p>
          ) : (
            <ol className="flex min-w-0 gap-2 pb-1 md:flex-wrap md:gap-3">
              {visibleSteps.map((row) => {
                const st = row.step;
                const title = st.title;
                const label =
                  st.kind === "legacy_assignment"
                    ? stepLabel("legacy_assignment")
                    : stepLabel("content", st.contentType);
                const stepIndexInUnit = roadmap.steps.indexOf(row);
                return (
                  <li
                    key={
                      st.kind === "content"
                        ? `c-${st.contentId}`
                        : `a-${st.assignmentId}`
                    }
                    className="flex min-w-[140px] flex-1 flex-col gap-1 rounded-xl border bg-background/80 px-3 py-2 text-xs md:min-w-[160px]"
                  >
                    <div className="flex items-center gap-2">
                      {row.done ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-lime" />
                      ) : row.locked ? (
                        <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : row.active ? (
                        <Circle className="h-4 w-4 shrink-0 text-brand-sky fill-brand-sky/25" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="font-semibold text-foreground line-clamp-2">
                        {title}
                      </span>
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {label} · Step {stepIndexInUnit + 1}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </ScrollArea>
      </div>

      <div className="space-y-6">
        {visibleSteps.length === 0 && roadmap.steps.length > 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
            Completed steps are hidden. Use{" "}
            <span className="font-medium text-foreground">Show completed</span>{" "}
            in the path above to open finished lessons again.
          </p>
        ) : null}
        {visibleSteps.map((row) => {
          const st = row.step;
          if (st.kind === "content") {
            const doc = itemsById.get(st.contentId);
            if (!doc) {
              return null;
            }
            return (
              <div
                key={st.contentId}
                id={`step-${st.contentId}`}
                className={cn(
                  "scroll-mt-24 rounded-xl transition-shadow",
                  row.active && "ring-2 ring-brand-sky/40 ring-offset-2 ring-offset-background",
                )}
              >
                <ContentItemView
                  item={doc}
                  unitId={unitId}
                  levelId={levelId}
                  locked={blocked || row.locked}
                  isActive={row.active}
                />
              </div>
            );
          }
          const assignment = assignmentsById.get(st.assignmentId);
          if (!assignment) {
            return null;
          }
          const answers = answersByAssignment[assignment._id] ?? {};
          return (
            <div
              key={st.assignmentId}
              id={`step-a-${st.assignmentId}`}
              className={cn(
                "scroll-mt-24 transition-shadow",
                row.active && "ring-2 ring-brand-sky/40 ring-offset-2 ring-offset-background",
              )}
            >
              <Card
                className={cn(
                  (blocked || row.locked) && "opacity-60 pointer-events-none",
                )}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {row.done ? (
                      <CheckCircle2 className="h-5 w-5 text-brand-lime" />
                    ) : row.locked ? (
                      <Lock className="h-5 w-5 text-muted-foreground" />
                    ) : null}
                    {assignment.title}
                  </CardTitle>
                  <CardDescription>{assignment.description}</CardDescription>
                  <p className="text-sm text-muted-foreground">
                    Passing score: {assignment.passingScore}%
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <LegacyAssignmentStartRecorder
                    unitId={unitId}
                    assignmentId={assignment._id}
                    levelId={levelId}
                    enabled={!blocked && !row.locked && row.active}
                  />
                  {blocked || row.locked ? (
                    <p className="text-sm text-muted-foreground">
                      Complete earlier steps to unlock this assessment.
                    </p>
                  ) : (
                    <>
                      {assignment.questions.map((question) => (
                        <div key={question.id} className="space-y-2">
                          <Label className="text-base">{question.question}</Label>
                          {question.type === "multiple_choice" &&
                            question.options && (
                            <div className="flex flex-wrap gap-2">
                              {question.options.map((opt) => (
                                <Button
                                  key={opt}
                                  type="button"
                                  size="sm"
                                  variant={
                                    answers[question.id] === opt
                                      ? "default"
                                      : "outline"
                                  }
                                  onClick={() =>
                                    setAnswersByAssignment((prev) => ({
                                      ...prev,
                                      [assignment._id]: {
                                        ...(prev[assignment._id] ?? {}),
                                        [question.id]: opt,
                                      },
                                    }))
                                  }
                                >
                                  {opt}
                                </Button>
                              ))}
                            </div>
                          )}
                          {question.type === "text" && (
                            <Input
                              value={answers[question.id] ?? ""}
                              onChange={(e) =>
                                setAnswersByAssignment((prev) => ({
                                  ...prev,
                                  [assignment._id]: {
                                    ...(prev[assignment._id] ?? {}),
                                    [question.id]: e.target.value,
                                  },
                                }))
                              }
                            />
                          )}
                        </div>
                      ))}
                      <Button
                        onClick={() =>
                          void onSubmitLegacyAssignment(assignment._id)
                        }
                      >
                        Submit assessment
                      </Button>
                      <LegacyLastResult assignmentId={assignment._id} />
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {!blocked && roadmap.totalSteps === 0 ? (
        <p className="text-sm text-muted-foreground">
          No published steps for this unit yet. An administrator can add
          content and assessments.
        </p>
      ) : null}
    </div>
  );
}
