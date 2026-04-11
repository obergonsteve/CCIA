"use client";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
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
import { parseSlideshowUrls } from "@/lib/slideshow";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { ChevronLeft, ChevronRight, ExternalLink, Lock } from "lucide-react";
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

  useEffect(() => {
    if (!unitId || locked || !isActive) {
      return;
    }
    void recordContentStart({ unitId, contentId: item._id, levelId }).catch(
      () => {
        /* surfaced on explicit actions */
      },
    );
  }, [unitId, item._id, locked, isActive, levelId, recordContentStart]);

  const typeLabel =
    item.type === "slideshow"
      ? "Deck"
      : item.type === "test"
        ? "Test"
        : item.type === "assignment"
          ? "Assignment"
          : item.type;

  return (
    <Card
      className={cn(locked && "opacity-70")}
    >
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {locked ? (
            <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : null}
          {item.title}
        </CardTitle>
        <CardDescription className="capitalize">{typeLabel}</CardDescription>
      </CardHeader>
      <CardContent
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
        {!isAssessment && unitId && !locked && (
          <Button
            type="button"
            variant="secondary"
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
      </CardContent>
    </Card>
  );
}
