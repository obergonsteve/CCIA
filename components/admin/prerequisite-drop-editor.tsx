"use client";

import type { ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useMutation, useQuery } from "convex/react";
import { GripVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";

function DraggablePrereqSource({
  unit,
  levelName,
}: {
  unit: Doc<"units">;
  levelName: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `prereq-src-${unit._id}`,
    });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5 text-sm ${
        isDragging ? "opacity-60 ring-2 ring-brand-lime/50" : ""
      }`}
    >
      <button
        type="button"
        className="cursor-grab touch-none p-0.5 text-muted-foreground"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="truncate">
        <span className="text-muted-foreground text-xs">{levelName} · </span>
        {unit.title}
      </span>
    </div>
  );
}

function PrereqDropZone({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[88px] rounded-lg border-2 border-dashed p-3 transition-colors ${
        isOver
          ? "border-brand-lime bg-brand-lime/10"
          : "border-muted-foreground/30 bg-muted/20"
      }`}
    >
      {children}
    </div>
  );
}

export function PrerequisiteDropEditor({
  targetUnitId,
  targetTitle,
  levels,
  allUnits,
}: {
  targetUnitId: Id<"units">;
  targetTitle: string;
  levels: Doc<"certificationLevels">[] | undefined;
  allUnits: Doc<"units">[] | undefined;
}) {
  const prereqs = useQuery(api.prerequisites.adminListForUnit, {
    unitId: targetUnitId,
  });
  const addPrereq = useMutation(api.prerequisites.adminAddPrerequisite);
  const removePrereq = useMutation(api.prerequisites.adminRemovePrerequisite);

  const levelNameById = new Map(
    (levels ?? []).map((l) => [l._id, l.name] as const),
  );

  const existingIds = new Set(
    (prereqs ?? []).map((p) => p.prerequisiteUnitId),
  );

  const sources =
    allUnits?.filter(
      (u) => u._id !== targetUnitId && !existingIds.has(u._id),
    ) ?? [];

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const dropId = `prereq-target-${targetUnitId}`;

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || over.id !== dropId) {
      return;
    }
    const raw = String(active.id);
    if (!raw.startsWith("prereq-src-")) {
      return;
    }
    const prerequisiteUnitId = raw.slice("prereq-src-".length) as Id<"units">;
    try {
      const res = await addPrereq({ unitId: targetUnitId, prerequisiteUnitId });
      if (res.duplicate) {
        toast.message("Already a prerequisite");
      } else {
        toast.success("Prerequisite added");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Prerequisites</CardTitle>
        <CardDescription>
          Drag a unit onto the dashed area to require it before &ldquo;{targetTitle}&rdquo;.
          Learners must complete prerequisites first.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <DndContext sensors={sensors} onDragEnd={(ev) => void onDragEnd(ev)}>
          <p className="text-xs font-medium text-muted-foreground">
            Drop here
          </p>
          <PrereqDropZone id={dropId}>
            {(prereqs ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No prerequisites yet — drag units here
              </p>
            ) : (
              <ul className="space-y-1">
                {(prereqs ?? []).map((p) => (
                  <li
                    key={p.edgeId}
                    className="flex items-center justify-between gap-2 rounded border bg-card px-2 py-1 text-sm"
                  >
                    <span className="truncate">{p.title}</span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="shrink-0 h-7 w-7"
                      onClick={async () => {
                        try {
                          await removePrereq({ edgeId: p.edgeId });
                          toast.success("Removed");
                        } catch (err) {
                          toast.error(
                            err instanceof Error ? err.message : "Failed",
                          );
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </PrereqDropZone>

          <p className="text-xs font-medium text-muted-foreground pt-2">
            Drag from catalog
          </p>
          <ScrollArea className="h-[180px] rounded-md border p-2">
            <div className="space-y-1 pr-2">
              {sources.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  All other units are already prerequisites or this is the only unit.
                </p>
              ) : (
                sources.map((u) => (
                  <DraggablePrereqSource
                    key={u._id}
                    unit={u}
                    levelName={levelNameById.get(u.levelId) ?? "Level"}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </DndContext>
      </CardContent>
    </Card>
  );
}
