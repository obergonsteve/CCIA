"use client";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseSlideshowUrls } from "@/lib/slideshow";
import { cn } from "@/lib/utils";
import { WorkshopSyncTracePanel } from "@/components/workshop-sync-trace-panel";
import { isMicrosoftTeamsSession } from "@/lib/workshopConference";
import { useMutation, useQuery } from "convex/react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Lock,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export function ContentItemView({
  item,
  unitId,
  levelId,
  locked = false,
  isActive = true,
}: {
  item: Doc<"contentItems">;
  /** Required to submit tests/assignments on the unit page. */
  unitId?: Id<"units">;
  /** When set, enforces certification unit order on the server. */
  levelId?: Id<"certificationLevels">;
  locked?: boolean;
  isActive?: boolean;
}) {
  const storageUrl = useQuery(
    api.content.getUrl,
    item.storageId ? { storageId: item.storageId } : "skip",
  );

  const mediaUrl = storageUrl ?? item.url;

  const slides = useMemo(() => parseSlideshowUrls(item.url), [item.url]);
  const [slideIdx, setSlideIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const isAssessment = item.type === "test" || item.type === "assignment";
  const isWorkshopSession = item.type === "workshop_session";
  const workshopSessionId = item.workshopSessionId;
  const workshopRegistration = useQuery(
    api.workshops.registrationStatus,
    unitId && isWorkshopSession && workshopSessionId
      ? { sessionId: workshopSessionId }
      : "skip",
  );
  const workshopSessionDetail = useQuery(
    api.workshops.getSessionForUser,
    unitId && isWorkshopSession && workshopSessionId
      ? { sessionId: workshopSessionId }
      : "skip",
  );
  const registerWorkshop = useMutation(api.workshops.registerForSession);
  const recordTeamsJoin = useMutation(api.workshops.recordTeamsJoin);
  const recordTeamsLeave = useMutation(api.workshops.recordTeamsLeave);
  const lastAssessmentResult = useQuery(
    api.progress.myResultsForAssessmentContent,
    unitId && isAssessment && item.assessment
      ? { unitId, assessmentContentId: item._id }
      : "skip",
  );
  const submitAssessmentContent = useMutation(
    api.progress.submitAssessmentContent,
  );
  const recordContentStart = useMutation(api.contentProgress.recordContentStart);
  const recordContentComplete = useMutation(
    api.contentProgress.recordContentComplete,
  );
  const reopenContentStep = useMutation(api.contentProgress.reopenContentStep);
  const myStepProgress = useQuery(
    api.contentProgress.myContentProgressForStep,
    unitId && !isAssessment && !isWorkshopSession
      ? { unitId, contentId: item._id }
      : "skip",
  );
  const stepProgressLoading =
    Boolean(unitId) &&
    !isAssessment &&
    !isWorkshopSession &&
    myStepProgress === undefined;
  const workshopProgressLoading =
    Boolean(unitId) &&
    isWorkshopSession &&
    workshopSessionId &&
    workshopRegistration === undefined;
  const nonAssessmentComplete =
    myStepProgress != null &&
    myStepProgress.completedAt != null &&
    (myStepProgress.outcome === "completed" ||
      myStepProgress.outcome === "passed");
  const workshopRegistered = workshopRegistration?.registered === true;

  const isStepComplete =
    isAssessment && item.assessment
      ? lastAssessmentResult?.passed === true
      : isWorkshopSession
        ? workshopRegistered
        : Boolean(unitId && !isAssessment && nonAssessmentComplete);

  const [expanded, setExpanded] = useState<boolean | undefined>(undefined);
  /** All steps start collapsed; learner expands to view or act. */
  const isOpen = expanded === undefined ? false : expanded;
  const stepBodyId = `step-body-${item._id}`;

  useEffect(() => {
    if (!unitId || locked || !isActive || isWorkshopSession) {
      return;
    }
    void recordContentStart({ unitId, contentId: item._id, levelId }).catch(
      () => {
        /* surfaced on explicit actions */
      },
    );
  }, [
    unitId,
    item._id,
    locked,
    isActive,
    levelId,
    recordContentStart,
    isWorkshopSession,
  ]);

  const typeLabel =
    item.type === "slideshow"
      ? "Deck"
      : item.type === "test"
        ? "Test"
        : item.type === "assignment"
          ? "Assignment"
          : item.type === "workshop_session"
            ? "Live workshop"
            : item.type;

  return (
    <Card
      className={cn(
        locked && "opacity-70",
        isStepComplete &&
          "border-2 border-brand-lime/50 bg-brand-lime/[0.05] dark:border-brand-lime/45 dark:bg-brand-lime/[0.06]",
      )}
    >
      <CardHeader className="pb-2">
        <button
          type="button"
          className="flex w-full items-start gap-2 rounded-md p-1 text-left -m-1 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-expanded={isOpen}
          aria-controls={stepBodyId}
          onClick={() => setExpanded(!isOpen)}
        >
          {locked ? (
            <Lock className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          ) : isStepComplete ? (
            <CheckCircle2
              className="mt-0.5 h-6 w-6 shrink-0 text-brand-lime"
              aria-hidden
            />
          ) : null}
          <span className="min-w-0 flex-1 space-y-1">
            <span className="font-heading text-base leading-snug font-medium text-foreground block">
              {item.title}
            </span>
            <span className="text-sm text-muted-foreground capitalize block">
              {typeLabel}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </CardHeader>
      {isOpen ? (
      <CardContent
        id={stepBodyId}
        className={cn("space-y-3", locked && "pointer-events-none select-none")}
      >
        {locked ? (
          <p className="text-sm text-muted-foreground pointer-events-none">
            Finish the previous step to unlock this content.
          </p>
        ) : null}
        {item.type === "video" && (
          <video
            src={mediaUrl}
            controls
            className="w-full rounded-md max-h-[400px] bg-black"
            preload="metadata"
          />
        )}
        {item.type === "pdf" && (
          <iframe
            title={item.title}
            src={mediaUrl}
            className="w-full h-[480px] rounded-md border"
          />
        )}
        {item.type === "slideshow" && slides.length > 0 && (
          <div className="space-y-2">
            <div className="relative rounded-md border bg-muted overflow-hidden flex items-center justify-center min-h-[200px]">
              {/* eslint-disable-next-line @next/next/no-img-element -- dynamic remote slideshow URLs */}
              <img
                src={slides[slideIdx] ?? slides[0]}
                alt={`${item.title} slide ${slideIdx + 1}`}
                className="max-h-[480px] w-full object-contain"
              />
            </div>
            {slides.length > 1 && (
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={slideIdx === 0}
                  onClick={() => setSlideIdx((i) => Math.max(0, i - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {slideIdx + 1} / {slides.length}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={slideIdx >= slides.length - 1}
                  onClick={() =>
                    setSlideIdx((i) => Math.min(slides.length - 1, i + 1))
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
        {item.type === "slideshow" && slides.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Add image URLs in the `url` field (JSON array, or separate with | or
            newlines).
          </p>
        )}
        {item.type === "link" && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-medium hover:bg-muted"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open resource
          </a>
        )}
        {isWorkshopSession && (
          <div className="space-y-3">
            {!workshopSessionId ? (
              <p className="text-sm text-destructive">
                This step is not linked to a session (admin configuration).
              </p>
            ) : workshopSessionDetail === null ? (
              <p className="text-sm text-muted-foreground">
                You do not have access to this session.
              </p>
            ) : workshopProgressLoading ? (
              <p className="text-sm text-muted-foreground">Loading session…</p>
            ) : (
              <>
                {item.url.trim() ? (
                  <p className="text-sm text-muted-foreground">{item.url}</p>
                ) : null}
                {workshopSessionDetail ? (
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-foreground">
                      {workshopSessionDetail.workshopTitle}
                    </p>
                    <p className="text-muted-foreground">
                      {new Date(
                        workshopSessionDetail.session.startsAt,
                      ).toLocaleString()}{" "}
                      —{" "}
                      {new Date(
                        workshopSessionDetail.session.endsAt,
                      ).toLocaleString()}
                    </p>
                    {workshopSessionDetail.session.status === "cancelled" ? (
                      <p className="text-destructive text-sm">
                        This session was cancelled.
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {workshopRegistered ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={!unitId || locked}
                      onClick={async () => {
                        if (!unitId) {
                          return;
                        }
                        try {
                          await reopenContentStep({
                            unitId,
                            contentId: item._id,
                            levelId,
                          });
                          toast.success(
                            "Registration cleared. Register again when you are ready.",
                          );
                        } catch (e) {
                          toast.error(
                            e instanceof Error
                              ? e.message
                              : "Could not re-open step",
                          );
                        }
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                      Re-open step
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        !unitId ||
                        locked ||
                        workshopSessionDetail?.session.status !==
                          "scheduled"
                      }
                      onClick={async () => {
                        if (!workshopSessionId) {
                          return;
                        }
                        try {
                          await registerWorkshop({
                            sessionId: workshopSessionId,
                          });
                          toast.success("Registered — step complete");
                        } catch (e) {
                          toast.error(
                            e instanceof Error ? e.message : "Failed",
                          );
                        }
                      }}
                    >
                      Register for session
                    </Button>
                  )}
                  {workshopSessionDetail?.session.externalJoinUrl &&
                  workshopRegistered ? (
                    isMicrosoftTeamsSession(workshopSessionDetail.session) ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="inline-flex gap-1"
                        disabled={!unitId || locked}
                        onClick={() => {
                          const u =
                            workshopSessionDetail.session.externalJoinUrl?.trim();
                          if (!u || !workshopSessionId) {
                            return;
                          }
                          void (async () => {
                            try {
                              await recordTeamsJoin({
                                sessionId: workshopSessionId,
                              });
                            } catch {
                              /* still open Teams */
                            }
                            window.open(u, "_blank", "noopener,noreferrer");
                          })();
                        }}
                      >
                        Join in Teams
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Link
                        href={workshopSessionDetail.session.externalJoinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                          "inline-flex gap-1",
                        )}
                      >
                        Join link
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    )
                  ) : null}
                  {workshopRegistered &&
                  workshopSessionId &&
                  isMicrosoftTeamsSession(workshopSessionDetail?.session) ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!unitId || locked}
                      onClick={() => {
                        void recordTeamsLeave({
                          sessionId: workshopSessionId,
                        }).catch(() => {});
                      }}
                    >
                      Record leave
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isMicrosoftTeamsSession(workshopSessionDetail?.session)
                    ? "Video and screen sharing run in Microsoft Teams. Use Join in Teams when you are ready."
                    : "Embedded LiveKit opens on the unit page when the host starts the room."}
                  {workshopRegistration?.teamsFirstJoinedAt != null ? (
                    <span className="mt-1 block text-[11px]">
                      First join recorded from this app:{" "}
                      {new Date(
                        workshopRegistration.teamsFirstJoinedAt,
                      ).toLocaleString()}
                    </span>
                  ) : null}
                </p>
                {workshopSessionId &&
                workshopRegistered &&
                isMicrosoftTeamsSession(workshopSessionDetail?.session) ? (
                  <WorkshopSyncTracePanel
                    sessionId={workshopSessionId}
                    className="mt-2"
                    defaultOpen
                  />
                ) : null}
              </>
            )}
          </div>
        )}
        {isAssessment && item.assessment && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {item.assessment.description}
            </p>
            <p className="text-xs text-muted-foreground">
              Passing score: {item.assessment.passingScore}%
            </p>
            {item.assessment.questions.map((q) => (
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
            <Button
              type="button"
              disabled={!unitId || locked}
              onClick={async () => {
                if (!unitId) {
                  return;
                }
                try {
                  const arr = item.assessment!.questions.map((q) => ({
                    questionId: q.id,
                    value: answers[q.id] ?? "",
                  }));
                  const res = await submitAssessmentContent({
                    unitId,
                    assessmentContentId: item._id,
                    answers: arr,
                    levelId,
                  });
                  if (res.passed) {
                    toast.success(`Passed — ${res.score}%`);
                  } else {
                    toast.error(
                      `Not passed — ${res.score}% (need ${res.passingScore}%)`,
                    );
                  }
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Submit failed",
                  );
                }
              }}
            >
              Submit
            </Button>
            {lastAssessmentResult ? (
              <p className="text-sm text-muted-foreground">
                Last attempt: {lastAssessmentResult.score}% —{" "}
                {lastAssessmentResult.passed ? "Passed" : "Not passed"} on{" "}
                {new Date(lastAssessmentResult.completedAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        )}
        {!isAssessment &&
          !isWorkshopSession &&
          unitId &&
          !locked && (
          <div className="flex flex-wrap items-center gap-2">
            {stepProgressLoading ? (
              <Button type="button" variant="secondary" size="sm" disabled>
                …
              </Button>
            ) : nonAssessmentComplete ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={async () => {
                  try {
                    await reopenContentStep({
                      unitId,
                      contentId: item._id,
                      levelId,
                    });
                    toast.success(
                      "Step re-opened. Mark it complete again when you are ready.",
                    );
                  } catch (e) {
                    toast.error(
                      e instanceof Error ? e.message : "Could not re-open step",
                    );
                  }
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                Re-open step
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={async () => {
                  try {
                    await recordContentComplete({
                      unitId,
                      contentId: item._id,
                      levelId,
                    });
                    toast.success("Step marked complete");
                  } catch (e) {
                    toast.error(
                      e instanceof Error ? e.message : "Could not save progress",
                    );
                  }
                }}
              >
                Mark step complete
              </Button>
            )}
          </div>
        )}
      </CardContent>
      ) : null}
    </Card>
  );
}
