"use client";

import type { ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery } from "convex/react";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type UnitAdminListRow = Doc<"units"> & { certificationSummary: string };

export function CertUnitsAddDropZone({
  levelId,
}: {
  levelId: Id<"certificationLevels">;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `level-units-add-${levelId}`,
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border-2 border-dashed px-3 py-3 text-center text-xs text-muted-foreground transition-colors",
        isOver
          ? "border-brand-lime bg-brand-lime/10"
          : "border-muted-foreground/30",
      )}
    >
      Drop a unit here to add it to this certification
    </div>
  );
}

export function DraggableUnitPaletteItem({ unit }: { unit: UnitAdminListRow }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `palette-unit:${unit._id}` });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5 text-sm",
        isDragging ? "opacity-60 ring-2 ring-brand-lime/50" : "",
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none p-0.5 text-muted-foreground"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">{unit.title}</div>
        <div className="text-xs text-muted-foreground truncate">
          {unit.certificationSummary}
        </div>
      </div>
    </div>
  );
}

export function ContentLibraryDragRow({ item }: { item: Doc<"contentItems"> }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `palette-content:${item._id}` });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5 text-sm",
        isDragging ? "opacity-60 ring-2 ring-brand-lime/50" : "",
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none p-0.5 text-muted-foreground"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1 truncate">
        <span className="font-medium">{item.title}</span>
        <span className="text-muted-foreground text-xs ml-2 capitalize">
          {item.type}
        </span>
      </div>
    </div>
  );
}

export function UnitContentDropZone({ unitId }: { unitId: Id<"units"> }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `unit-content-drop-${unitId}`,
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border-2 border-dashed px-3 py-3 text-center text-xs text-muted-foreground transition-colors",
        isOver
          ? "border-brand-lime bg-brand-lime/10"
          : "border-muted-foreground/30",
      )}
    >
      Drop library content here to add to this unit
    </div>
  );
}

/** Drop target for adding a palette unit to a certification (all-units mode). */
export function LevelRowDroppable({
  levelId,
  children,
}: {
  levelId: Id<"certificationLevels">;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `level-units-add-${levelId}`,
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-md",
        isOver
          ? "ring-2 ring-brand-lime/60 ring-offset-1 ring-offset-background"
          : "",
      )}
    >
      {children}
    </div>
  );
}

export function ContentOnUnitAdminList({ unitId }: { unitId: Id<"units"> }) {
  const rows = useQuery(api.content.listByUnit, { unitId });
  const detachContentFromUnit = useMutation(api.content.detachFromUnit);
  const legacyDetachContentFromUnit = useMutation(
    api.content.legacyDetachFromUnit,
  );
  if (!rows) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center border rounded-md">
        Loading…
      </p>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center border rounded-md mt-2">
        Nothing attached yet.
      </p>
    );
  }
  return (
    <ul className="border rounded-md divide-y mt-2 max-h-48 overflow-y-auto text-sm">
      {rows.map((item) => (
        <li
          key={item.unitContentId ?? `legacy-${item._id}`}
          className="flex items-center gap-2 px-3 py-2"
        >
          <span className="flex-1 truncate">
            <span className="font-medium">{item.title}</span>
            <span className="text-muted-foreground text-xs ml-2 capitalize">
              {item.type}
            </span>
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={async () => {
              try {
                if (item.unitContentId) {
                  await detachContentFromUnit({
                    unitContentId: item.unitContentId,
                  });
                } else {
                  await legacyDetachContentFromUnit({
                    unitId,
                    contentId: item._id,
                  });
                }
                toast.success("Detached");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
              }
            }}
          >
            Remove
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function SortableLevelRow({
  level,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  level: Doc<"certificationLevels">;
  selected: boolean;
  onSelect: () => void;
  onEdit?: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: level._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-stretch rounded-md border bg-card overflow-hidden",
        selected && "ring-2 ring-brand-lime/60 border-brand-lime/40",
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none p-2 text-muted-foreground shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="flex-1 text-left min-w-0 px-3 py-2.5"
        onClick={onSelect}
      >
        <span className="text-sm font-medium block truncate">{level.name}</span>
      </button>
      <div className="flex flex-col border-l shrink-0">
        {onEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-none"
            title="Edit certification"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 rounded-none text-destructive hover:text-destructive",
            !onEdit && "h-10 w-10",
          )}
          title="Delete certification"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function SortableUnitRow({
  unit,
  selected,
  onSelect,
  onEdit,
  onRemoveFromCert,
}: {
  unit: Doc<"units">;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onRemoveFromCert: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: unit._id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-stretch rounded-md border text-sm overflow-hidden",
        selected && "ring-2 ring-brand-lime/60 border-brand-lime/40",
      )}
    >
      <button
        type="button"
        className="cursor-grab p-2 text-muted-foreground shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="flex-1 text-left font-medium truncate px-2 py-2 min-w-0"
        onClick={onSelect}
      >
        {unit.title}
      </button>
      <div className="flex flex-col border-l shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-none"
          title="Edit unit"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-none text-destructive hover:text-destructive"
          title="Remove from this certification"
          onClick={(e) => {
            e.stopPropagation();
            onRemoveFromCert();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export type Q = {
  id: string;
  question: string;
  type: "multiple_choice" | "text";
  options: string[];
  correctAnswer: string;
};

export function AssignmentBuilderFields({
  showUnitSelect,
  allUnits,
  assignUnitId,
  setAssignUnitId,
  setAssignId,
  resetToNewAssignment,
  assignmentsForUnit,
  assignId,
  loadAssignment,
  assignTitle,
  setAssignTitle,
  assignDesc,
  setAssignDesc,
  assignPass,
  setAssignPass,
  questions,
  addQuestion,
  updateQuestion,
  removeQuestion,
  saveAssignment,
}: {
  showUnitSelect: boolean;
  allUnits: UnitAdminListRow[] | undefined;
  assignUnitId: string;
  setAssignUnitId: (v: string) => void;
  setAssignId: (v: string) => void;
  resetToNewAssignment: () => void;
  assignmentsForUnit: Doc<"assignments">[] | undefined;
  assignId: string;
  loadAssignment: (id: Id<"assignments">) => void;
  assignTitle: string;
  setAssignTitle: (v: string) => void;
  assignDesc: string;
  setAssignDesc: (v: string) => void;
  assignPass: number;
  setAssignPass: (v: number) => void;
  questions: Q[];
  addQuestion: () => void;
  updateQuestion: (i: number, patch: Partial<Q>) => void;
  removeQuestion: (i: number) => void;
  saveAssignment: () => void | Promise<void>;
}) {
  return (
    <div className="space-y-4 max-w-2xl">
      {showUnitSelect && (
        <div className="grid gap-2">
          <Label>Unit</Label>
          <Select
            value={assignUnitId}
            onValueChange={(v) => {
              setAssignUnitId(v ?? "");
              setAssignId("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              {(allUnits ?? []).map((u) => (
                <SelectItem key={u._id} value={u._id}>
                  {u.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {assignUnitId && (assignmentsForUnit?.length ?? 0) > 0 && (
        <div className="grid gap-2">
          <Label>Edit existing</Label>
          <Select
            value={assignId || "__new__"}
            onValueChange={(v) => {
              if (v === "__new__") {
                resetToNewAssignment();
                return;
              }
              const id = v ?? "";
              setAssignId(id);
              loadAssignment(id as Id<"assignments">);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="New assignment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__new__">New assignment</SelectItem>
              {(assignmentsForUnit ?? []).map((a) => (
                <SelectItem key={a._id} value={a._id}>
                  {a.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Input
        placeholder="Assessment title"
        value={assignTitle}
        onChange={(e) => setAssignTitle(e.target.value)}
      />
      <Textarea
        placeholder="Description"
        value={assignDesc}
        onChange={(e) => setAssignDesc(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <Label className="shrink-0">Passing %</Label>
        <Input
          type="number"
          className="w-24"
          value={assignPass}
          onChange={(e) =>
            setAssignPass(Number.parseInt(e.target.value, 10) || 80)
          }
        />
      </div>
      <div className="space-y-4 border rounded-md p-3">
        {questions.map((q, i) => (
          <div key={q.id} className="space-y-2 border-b pb-3 last:border-0">
            <div className="flex justify-between gap-2">
              <Label>Question {i + 1}</Label>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => removeQuestion(i)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Input
              placeholder="Question text"
              value={q.question}
              onChange={(e) => updateQuestion(i, { question: e.target.value })}
            />
            <Select
              value={q.type}
              onValueChange={(v) =>
                updateQuestion(i, {
                  type: (v ?? "multiple_choice") as Q["type"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="multiple_choice">Multiple choice</SelectItem>
                <SelectItem value="text">Text</SelectItem>
              </SelectContent>
            </Select>
            {q.type === "multiple_choice" && (
              <div className="space-y-2">
                {q.options.map((opt, j) => (
                  <Input
                    key={j}
                    placeholder={`Option ${j + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const next = [...q.options];
                      next[j] = e.target.value;
                      updateQuestion(i, { options: next });
                    }}
                  />
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    updateQuestion(i, { options: [...q.options, ""] })
                  }
                >
                  Add option
                </Button>
              </div>
            )}
            <Input
              placeholder="Correct answer (exact match, case-insensitive)"
              value={q.correctAnswer}
              onChange={(e) =>
                updateQuestion(i, { correctAnswer: e.target.value })
              }
            />
          </div>
        ))}
        <Button type="button" variant="secondary" onClick={addQuestion}>
          <Plus className="h-4 w-4 mr-1" />
          Add question
        </Button>
      </div>
      <Button type="button" onClick={() => void saveAssignment()}>
        {assignId ? "Update assignment" : "Create assignment"}
      </Button>
    </div>
  );
}
