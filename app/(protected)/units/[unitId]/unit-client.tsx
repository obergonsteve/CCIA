"use client";

import { ContentItemView } from "@/components/content-item-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDashed,
  Lock,
  MonitorPlay,
  Route,
} from "lucide-react";
import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { WorkshopLivePanel } from "@/components/grithub-live-port/workshop-live-panel";

function unitStepPathHref(
  unitId: Id<"units">,
  levelId: Id<"certificationLevels"> | undefined,
  st: {
    kind: "content" | "legacy_assignment";
    contentId?: Id<"contentItems">;
    assignmentId?: Id<"assignments">;
  },
): string {
  const q = levelId ? `?level=${levelId}` : "";
  const base = `/units/${unitId}${q}`;
  if (st.kind === "content" && st.contentId) {
    return `${base}#step-${st.contentId}`;
  }
  if (st.kind === "legacy_assignment" && st.assignmentId) {
    return `${base}#step-a-${st.assignmentId}`;
  }
  return base;
}

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

function LegacyAssignmentStepBlock({
  row,
  assignment,
  unitId,
  levelId,
  blocked,
  answers,
  setAnswersByAssignment,
  onSubmitLegacyAssignment,
}: {
  row: { done: boolean; locked: boolean; active: boolean };
  assignment: Doc<"assignments">;
  unitId: Id<"units">;
  levelId?: Id<"certificationLevels">;
  blocked: boolean;
  answers: Record<string, string>;
  setAnswersByAssignment: Dispatch<
    SetStateAction<Record<string, Record<string, string>>>
  >;
  onSubmitLegacyAssignment: (assignmentId: Id<"assignments">) => void;
}) {
  const [expanded, setExpanded] = useState<boolean | undefined>(undefined);
  const isOpen = expanded === undefined ? false : expanded;
  const bodyId = `legacy-step-body-${assignment._id}`;

  return (
    <Card
      className={cn(
        (blocked || row.locked) && "pointer-events-none opacity-60",
      )}
    >
      <CardHeader className="pb-2">
        <button
          type="button"
          className="-m-1 flex w-full items-start gap-2 rounded-md p-1 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-expanded={isOpen}
          aria-controls={bodyId}
          onClick={() => setExpanded(!isOpen)}
        >
          {row.done ? (
            <CheckCircle2
              className="mt-0.5 h-5 w-5 shrink-0 text-brand-lime"
              aria-hidden
            />
          ) : row.locked ? (
            <Lock
              className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          ) : null}
          <span className="min-w-0 flex-1 space-y-1">
            <span className="font-heading block text-lg font-medium leading-snug text-foreground">
              {assignment.title}
            </span>
            <span className="block text-sm text-muted-foreground">
              {assignment.description}
            </span>
            <span className="block text-sm text-muted-foreground">
              Passing score: {assignment.passingScore}%
            </span>
          </span>
          <ChevronDown
            className={cn(
              "mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </CardHeader>
      {isOpen ? (
        <CardContent id={bodyId} className="space-y-6">
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
                  {question.type === "multiple_choice" && question.options && (
                    <div className="flex flex-wrap gap-2">
                      {question.options.map((opt) => (
                        <Button
                          key={opt}
                          type="button"
                          size="sm"
                          variant={
                            answers[question.id] === opt ? "default" : "outline"
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
                onClick={() => void onSubmitLegacyAssignment(assignment._id)}
              >
                Submit assessment
              </Button>
              <LegacyLastResult assignmentId={assignment._id} />
            </>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}

/** LiveKit room, screen share, and session chat (ported from GritHub Brainstorm). */
function LiveWorkshopRoomPanel({ unitId }: { unitId: Id<"units"> }) {
  const [open, setOpen] = useState(false);
  const bodyId = "unit-live-workshop-room-panel";

  return (
    <section
      className={cn(
        "rounded-xl border border-purple-500/25 bg-purple-500/[0.04] text-sm shadow-sm ring-1 ring-foreground/10 dark:border-purple-400/20 dark:bg-purple-500/[0.07]",
      )}
      aria-label="Live workshop room"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-left outline-none transition-colors hover:bg-purple-500/[0.07] focus-visible:ring-2 focus-visible:ring-purple-400/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-purple-500/[0.10]"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <MonitorPlay
            className="h-5 w-5 shrink-0 text-purple-600 dark:text-purple-400"
            aria-hidden
          />
          <span className="font-heading font-semibold text-foreground">
            Live workshop
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <div
        id={bodyId}
        hidden={!open}
        className="space-y-2 border-t border-purple-500/20 px-4 py-4 dark:border-purple-400/15"
      >
        <WorkshopLivePanel workshopUnitId={unitId} />
      </div>
    </section>
  );
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
  const workshopSequentialBypass = roadmap.workshopSequentialBypass === true;
  const blocked =
    lockedByPrereq ||
    (sequentialBlockedMessage !== null && !workshopSequentialBypass);

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

  const isLiveWorkshopUnit = unit.deliveryMode === "live_workshop";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <h1 className="min-w-0 flex-1 text-2xl font-bold leading-snug tracking-tight">
            {unit.title}
          </h1>
          <Badge
            variant="outline"
            className={cn(
              "h-auto min-h-7 shrink-0 px-2.5 py-1 text-xs font-bold uppercase leading-tight tracking-wide",
              isLiveWorkshopUnit
                ? "border-2 border-purple-600/85 bg-purple-500/[0.14] text-purple-900 shadow-sm shadow-purple-500/10 dark:border-purple-400/80 dark:bg-purple-400/[0.12] dark:text-purple-100"
                : "border border-brand-gold/55 bg-brand-gold/[0.18] text-foreground shadow-sm shadow-brand-gold/10 dark:border-brand-gold/45 dark:bg-brand-gold/[0.14] dark:text-foreground",
            )}
          >
            {isLiveWorkshopUnit ? "Live workshop" : "Self-paced"}
          </Badge>
        </div>
        <p className="text-muted-foreground">{unit.description}</p>
        <div className="mt-3 flex items-center gap-3">
          <Progress value={roadmap.fraction} className="h-2 flex-1 max-w-md" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {roadmap.completedSteps}/{roadmap.totalSteps || 0} steps
          </span>
        </div>
      </div>

      {isLiveWorkshopUnit ? <LiveWorkshopRoomPanel unitId={unitId} /> : null}

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

      {sequentialBlockedMessage && workshopSequentialBypass ? (
        <div
          className="flex gap-3 rounded-xl border border-purple-500/35 bg-purple-500/[0.08] px-4 py-3 text-sm dark:border-purple-400/30 dark:bg-purple-500/[0.10]"
          role="status"
        >
          <Route className="h-5 w-5 shrink-0 text-purple-600 dark:text-purple-400" />
          <div className="space-y-1.5 text-muted-foreground">
            <p>{sequentialBlockedMessage}</p>
            <p className="text-xs text-foreground/90">
              You can still browse workshop sessions and register below; other
              certification units stay in order.
            </p>
          </div>
        </div>
      ) : sequentialBlockedMessage ? (
        <div
          className="flex gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm"
          role="status"
        >
          <Route className="h-5 w-5 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground">{sequentialBlockedMessage}</p>
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-2xl border-2 border-brand-gold/45 bg-muted/25 shadow-sm dark:border-brand-gold/40">
        <div
          className="h-1.5 w-full bg-gradient-to-r from-brand-lime/70 via-brand-gold/75 to-brand-sky/70"
          aria-hidden
        />
        <div className="p-3 md:p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-gold/40 bg-brand-gold/15 shadow-sm">
                <Route className="h-4 w-4 text-brand-gold" aria-hidden />
              </span>
              Your path through this unit
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-7 shrink-0 rounded-full px-3 text-xs font-medium",
                showCompletedSteps
                  ? "border-brand-lime/55 bg-brand-lime/20 text-foreground hover:bg-brand-lime/28 dark:border-brand-lime/50 dark:bg-brand-lime/15 dark:hover:bg-brand-lime/25"
                  : "border-brand-lime/40 bg-transparent text-foreground hover:bg-brand-lime/12 dark:border-brand-lime/35 dark:hover:bg-brand-lime/10",
              )}
              aria-pressed={showCompletedSteps}
              onClick={() => setShowCompletedSteps((v) => !v)}
            >
              {showCompletedSteps ? "Hide completed" : "Show completed"}
            </Button>
          </div>
          {visibleSteps.length === 0 ? (
            <p className="py-5 text-center text-sm text-muted-foreground">
              Nothing to show here. Turn{" "}
              <span className="font-medium text-foreground">Show completed</span>{" "}
              on to see finished steps again.
            </p>
          ) : (
            <div className="relative min-w-0 overflow-x-auto overflow-y-visible pb-1 [-webkit-overflow-scrolling:touch]">
              <ol className="flex w-max list-none flex-row flex-nowrap items-start gap-x-0 pr-1">
                {visibleSteps.map((row, si) => {
                  const st = row.step;
                  const title = st.title;
                  const stepLocked = blocked || row.locked;
                  const href = unitStepPathHref(unitId, levelId, st);
                  const nodeIcon =
                    row.done ? (
                      <CheckCircle2
                        className="h-4 w-4 text-brand-lime"
                        aria-hidden
                      />
                    ) : stepLocked ? (
                      <Lock
                        className="h-4 w-4 text-muted-foreground"
                        aria-hidden
                      />
                    ) : row.active ? (
                      <CircleDashed
                        className="h-4 w-4 text-brand-gold"
                        aria-hidden
                      />
                    ) : (
                      <Circle
                        className="h-4 w-4 text-muted-foreground/75"
                        aria-hidden
                      />
                    );
                  const shell = (
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 bg-background/95 shadow-sm transition-transform",
                        row.done &&
                          "border-brand-lime/75 bg-brand-lime/[0.12] shadow-sm",
                        !row.done &&
                          row.active &&
                          !stepLocked &&
                          "border-brand-gold/80 bg-brand-gold/[0.12] ring-2 ring-brand-gold/20",
                        !row.done &&
                          !row.active &&
                          !stepLocked &&
                          "border-border/80",
                        stepLocked && "border-muted bg-muted/45",
                      )}
                    >
                      {nodeIcon}
                    </span>
                  );
                  const caption = (
                    <span className="max-w-[5.25rem] text-center text-[10px] font-medium leading-tight text-muted-foreground line-clamp-3">
                      {title}
                    </span>
                  );
                  return (
                    <li
                      key={
                        st.kind === "content"
                          ? `c-${st.contentId}`
                          : `a-${st.assignmentId}`
                      }
                      className="flex items-start"
                    >
                      {si > 0 ? (
                        <ArrowRight
                          className="mx-0.5 mt-2 h-3.5 w-4 shrink-0 text-muted-foreground/50 sm:mt-2 sm:h-4 sm:w-5"
                          aria-hidden
                          strokeWidth={2}
                        />
                      ) : null}
                      {stepLocked ? (
                        <span
                          className="inline-flex cursor-not-allowed flex-col items-center gap-1.5 opacity-75"
                          title={title}
                        >
                          {shell}
                          {caption}
                        </span>
                      ) : (
                        <Link
                          href={href}
                          className="inline-flex flex-col items-center gap-1.5 rounded-md outline-none ring-offset-background transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-brand-sky/45"
                          title={title}
                          scroll
                        >
                          {shell}
                          {caption}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
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
              <LegacyAssignmentStepBlock
                row={row}
                assignment={assignment}
                unitId={unitId}
                levelId={levelId}
                blocked={blocked}
                answers={answers}
                setAnswersByAssignment={setAnswersByAssignment}
                onSubmitLegacyAssignment={onSubmitLegacyAssignment}
              />
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
