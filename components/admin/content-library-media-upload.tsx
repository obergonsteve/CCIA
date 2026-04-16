"use client";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import { FolderOpen, Loader2, Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

const FILE_INPUT_ACCEPT =
  ".pdf,.mp4,.m4v,.webm,.mov,.mkv,.ppt,.pptx,video/*,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation";

function allowsConvexFileUpload(
  type: Doc<"contentItems">["type"],
): type is "video" | "pdf" | "slideshow" {
  return type === "video" || type === "pdf" || type === "slideshow";
}

export function ContentLibraryMediaUpload({
  contentType,
  storageId,
  onStorageIdChange,
  inputId = "content-library-file",
}: {
  contentType: Doc<"contentItems">["type"];
  storageId: Id<"_storage"> | null;
  onStorageIdChange: (id: Id<"_storage"> | null) => void;
  /** Distinct id when multiple instances on one page. */
  inputId?: string;
}) {
  const generateUploadUrl = useMutation(api.content.generateUploadUrl);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastFileName, setLastFileName] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!allowsConvexFileUpload(contentType)) {
        return;
      }
      setUploading(true);
      try {
        const postUrl = await generateUploadUrl();
        const res = await fetch(postUrl, {
          method: "POST",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        });
        if (!res.ok) {
          throw new Error(`Upload failed (${res.status})`);
        }
        const json = (await res.json()) as { storageId?: string };
        if (!json.storageId) {
          throw new Error("No storageId returned");
        }
        onStorageIdChange(json.storageId as Id<"_storage">);
        setLastFileName(file.name);
        toast.success("File uploaded");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [contentType, generateUploadUrl, onStorageIdChange],
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file) {
        void uploadFile(file);
      }
    },
    [uploadFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) {
        void uploadFile(file);
      }
    },
    [uploadFile],
  );

  const allows = allowsConvexFileUpload(contentType);

  return (
    <div className="space-y-1.5">
      <Label className="text-foreground">Upload file (optional)</Label>
      {!allows ? (
        <p className="rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Convex file storage is available for{" "}
          <span className="font-medium text-foreground">Video</span>,{" "}
          <span className="font-medium text-foreground">PDF</span>, and{" "}
          <span className="font-medium text-foreground">Deck (slideshow)</span>{" "}
          types. Switch type above, or keep using URL / link fields for other
          kinds.
        </p>
      ) : (
        <>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            className="sr-only"
            accept={FILE_INPUT_ACCEPT}
            disabled={uploading}
            onChange={onInputChange}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.currentTarget === e.target) {
                setDragActive(false);
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={onDrop}
            className={cn(
              "flex w-full min-h-[88px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-3 py-4 text-center text-sm outline-none transition-colors",
              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              dragActive
                ? "border-primary bg-primary/8"
                : "border-border bg-muted/15 hover:bg-muted/25",
              uploading && "pointer-events-none opacity-70",
            )}
          >
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground" aria-hidden />
            )}
            <span className="text-muted-foreground">
              Drag and drop a file here, or{" "}
              <span className="font-medium text-foreground">click to browse</span>
            </span>
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <FolderOpen className="h-3.5 w-3.5" aria-hidden />
              Choose file…
            </Button>
            {storageId ? (
              <>
                <span className="min-w-0 max-w-[min(100%,14rem)] truncate text-xs text-muted-foreground">
                  {lastFileName ?? "File attached"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 px-2 text-destructive hover:text-destructive"
                  disabled={uploading}
                  onClick={() => {
                    onStorageIdChange(null);
                    setLastFileName(null);
                  }}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  Remove
                </Button>
              </>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
