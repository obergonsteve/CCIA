"use client";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { parseSlideshowUrls } from "@/lib/slideshow";
import { useQuery } from "convex/react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";

export function ContentItemView({ item }: { item: Doc<"contentItems"> }) {
  const storageUrl = useQuery(
    api.content.getUrl,
    item.storageId ? { storageId: item.storageId } : "skip",
  );

  const mediaUrl = storageUrl ?? item.url;

  const slides = useMemo(() => parseSlideshowUrls(item.url), [item.url]);
  const [slideIdx, setSlideIdx] = useState(0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{item.title}</CardTitle>
        <CardDescription className="capitalize">{item.type}</CardDescription>
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
      </CardContent>
    </Card>
  );
}
