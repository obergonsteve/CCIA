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
import { useMutation, useQuery } from "convex/react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export function ContentItemView({
  item,
  unitId,
}: {
  item: Doc<"contentItems">;
  /** Required to submit tests/assignments on the unit page. */
  unitId?: Id<"units">;
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

  const typeLabel =
    item.type === "slideshow"
      ? "Deck"
      : item.type === "test"
        ? "Test"
        : item.type === "assignment"
          ? "Assignment"
          : item.type;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{item.title}</CardTitle>
        <CardDescription className="capitalize">{typeLabel}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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
              disabled={!unitId}
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
      </CardContent>
    </Card>
  );
}
