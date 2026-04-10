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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery } from "convex/react";
import {
  ClipboardList,
  GripVertical,
  Link2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type UnitAdminListRow = Doc<"units"> & {
  certificationSummary: string;
  certificationLevelIds: Id<"certificationLevels">[];
};

/** Same brand-lime surface as the Certifications panel — selected cert + units-in-cert in All Units. */
export const ADMIN_CERT_PANEL_ROW_HIGHLIGHT =
  "border-brand-lime/40 bg-brand-lime/[0.11] dark:border-brand-lime/35 dark:bg-brand-lime/[0.14]";

/**
 * Units column (brand gold) — library “all content” + unit selected: items already on that unit.
 * Mirrors {@link ADMIN_CERT_PANEL_ROW_HIGHLIGHT} for cert + all-units.
 */
export const ADMIN_UNIT_PANEL_CONTENT_IN_UNIT_HIGHLIGHT =
  "border-brand-gold/45 bg-brand-gold/[0.16] dark:border-brand-gold/38 dark:bg-brand-gold/[0.13]";

/** Strong outline for the active row in admin cert / unit / content lists (three columns). */
export const ADMIN_LIST_ROW_SELECTED =
  "border-2 border-primary z-[1] ring-2 ring-inset ring-primary/45";

/** One-line secondary line for cert-scoped and all-units lists (same field, same rules). */
function unitRowDescription(unit: { description?: string }): {
  text: string;
  show: boolean;
} {
  const text = unit.description?.trim() ?? "";
  const show = Boolean(text && text !== "—");
  return { text, show };
}

export function DraggableUnitPaletteItem({
  unit,
  selected,
  /** When showing all units with a cert selected: units already in that cert. */
  inSelectedCert,
  /** Drawer open directly under this row (affects rounding). */
  expandDrawerOpen,
  onSelect,
  onEdit,
  onDelete,
  onOpenPrerequisites,
  onOpenAssignments,
}: {
  unit: UnitAdminListRow;
  selected?: boolean;
  inSelectedCert?: boolean;
  expandDrawerOpen?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onOpenPrerequisites?: () => void;
  onOpenAssignments?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `palette-unit:${unit._id}` });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;
  const hasActions =
    onEdit != null ||
    onDelete != null ||
    onOpenPrerequisites != null ||
    onOpenAssignments != null;
  const { text: descText, show: showDesc } = unitRowDescription(unit);
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex min-w-0 items-stretch overflow-hidden border text-sm shadow-sm",
        expandDrawerOpen ? "rounded-t-lg rounded-b-none border-b-0" : "rounded-lg",
        inSelectedCert && ADMIN_CERT_PANEL_ROW_HIGHLIGHT,
        !inSelectedCert && "border-border bg-card",
        !inSelectedCert && selected && cn("bg-muted/40", ADMIN_LIST_ROW_SELECTED),
        inSelectedCert && selected && ADMIN_LIST_ROW_SELECTED,
        isDragging && "opacity-70",
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none shrink-0 self-stretch px-1.5 py-1.5 text-muted-foreground flex items-center"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      {onSelect ? (
        <button
          type="button"
          className="min-w-0 flex-1 px-0 py-1.5 text-left leading-tight"
          onClick={onSelect}
        >
          <span className="block truncate font-medium">{unit.title}</span>
          {showDesc ? (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {descText}
            </span>
          ) : null}
        </button>
      ) : (
        <div className="min-w-0 flex-1 px-0 py-1.5 leading-tight">
          <span className="block truncate font-medium">{unit.title}</span>
          {showDesc ? (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {descText}
            </span>
          ) : null}
        </div>
      )}
      {hasActions ? (
        <div
          className={cn(
            "flex shrink-0 flex-col border-l border-border transition-opacity duration-150 ease-out",
            isDragging
              ? "opacity-100"
              : "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
          )}
        >
          {onEdit || onDelete ? (
            <div className="flex shrink-0 flex-row">
              {onEdit ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-none"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit();
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    Edit unit — title and description
                  </TooltipContent>
                </Tooltip>
              ) : null}
              {onDelete ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-none text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    Delete unit from the system (all certifications and links)
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          ) : null}
          {onOpenPrerequisites || onOpenAssignments ? (
            <div
              className={cn(
                "flex shrink-0 flex-row border-border/70",
                (onEdit || onDelete) && "border-t",
              )}
            >
              {onOpenPrerequisites ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-none text-brand-gold hover:text-brand-gold"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPrerequisites();
                      }}
                    >
                      <Link2 className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    Prerequisites — other units learners must finish first
                  </TooltipContent>
                </Tooltip>
              ) : null}
              {onOpenAssignments ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-none text-brand-sky hover:text-brand-sky"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenAssignments();
                      }}
                    >
                      <ClipboardList className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    Assignments — tests and quizzes for this unit
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Strip curriculum-style prefixes (Deck:, Explainer —, …) so the list shows the
 * human-facing name only.
 */
function libraryContentDisplayTitle(raw: string): string {
  const trimmed = raw.trim();
  const rest = trimmed
    .replace(
      /^(Deck|Explainer|Briefing|Reading|Reference|Walkthrough|Guidance|Scenario\s+replay|Toolbox\s+style|Short\s+talk)\s*[:：—–-]\s*/i,
      "",
    )
    .trim();
  return rest.length > 0 ? rest : trimmed;
}

function contentLibrarySubtitle(item: Doc<"contentItems">): string {
  const typeLabel =
    item.type === "video"
      ? "Video"
      : item.type === "pdf"
        ? "PDF"
        : item.type === "slideshow"
          ? "Slideshow"
          : "Link";
  const parts: string[] = [typeLabel];
  if (item.duration != null && item.duration > 0) {
    parts.push(`${item.duration} min`);
  }
  if (item.type === "link") {
    try {
      parts.push(new URL(item.url).hostname.replace(/^www\./, ""));
    } catch {
      /* ignore invalid url */
    }
  }
  return parts.join(" · ");
}

export function ContentLibraryDragRow({
  item,
  selected,
  /** All-content mode + unit selected: item is already attached to that unit (mirrors units-in-cert tint). */
  inSelectedUnit,
  onEdit,
  onDelete,
}: {
  item: Doc<"contentItems">;
  /** Highlights the row (e.g. item open in the edit dialog). */
  selected?: boolean;
  inSelectedUnit?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `palette-content:${item._id}` });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;
  const subtitle = contentLibrarySubtitle(item);
  const displayTitle = libraryContentDisplayTitle(item.title);
  const hasActions = onEdit != null || onDelete != null;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex min-w-0 items-stretch overflow-hidden rounded-lg border text-sm shadow-sm",
        inSelectedUnit && ADMIN_UNIT_PANEL_CONTENT_IN_UNIT_HIGHLIGHT,
        !inSelectedUnit && "border-border bg-card",
        !inSelectedUnit && selected && ADMIN_LIST_ROW_SELECTED,
        inSelectedUnit && selected && ADMIN_LIST_ROW_SELECTED,
        isDragging && "opacity-70",
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none shrink-0 self-stretch px-1.5 py-1.5 text-muted-foreground flex items-center"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <div className="min-w-0 flex-1 px-0 py-1.5 leading-tight">
        <div className="truncate font-medium">{displayTitle}</div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {subtitle}
        </div>
      </div>
      {hasActions ? (
        <div
          className={cn(
            "flex shrink-0 flex-row border-l border-border transition-opacity duration-150 ease-out",
            isDragging
              ? "opacity-100"
              : "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
          )}
        >
          {onEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-none"
              title="Edit content"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-none text-destructive hover:text-destructive"
              title="Delete from library"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Library items drop onto the unit row (same id as before for attachContentToUnit). */
export function UnitRowContentDropTarget({
  unitId,
  disabled,
  children,
}: {
  unitId: Id<"units">;
  /** When set (e.g. a unit is selected for detail), ignore drops here. */
  disabled?: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `unit-content-drop-${unitId}`,
    disabled: Boolean(disabled),
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg transition-shadow",
        !disabled &&
          isOver &&
          "ring-2 ring-brand-sky/55 ring-offset-2 ring-offset-background",
      )}
    >
      {children}
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
        isOver ? "ring-1 ring-primary ring-offset-1 ring-offset-background" : "",
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

  const short =
    level.summary?.trim() ||
    level.tagline?.trim() ||
    (level.description?.trim() && level.description !== "—"
      ? level.description
      : "");
  const showShort = Boolean(short);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center overflow-hidden rounded-lg border shadow-sm",
        selected
          ? cn(ADMIN_CERT_PANEL_ROW_HIGHLIGHT, ADMIN_LIST_ROW_SELECTED)
          : "border-border bg-card",
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none shrink-0 self-stretch px-1.5 py-1.5 text-muted-foreground flex items-center"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className="min-w-0 flex-1 px-0 py-1.5 text-left leading-tight"
        onClick={onSelect}
      >
        <span className="block truncate text-sm font-medium">{level.name}</span>
        {showShort ? (
          <span className="mt-0.5 block line-clamp-2 text-[11px] text-muted-foreground">
            {short}
          </span>
        ) : null}
      </button>
      <div
        className={cn(
          "flex h-full shrink-0 flex-row items-center border-l border-border transition-opacity duration-150 ease-out",
          isDragging
            ? "opacity-100"
            : "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
        )}
      >
        {onEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-none"
            title="Edit certification"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-none text-destructive hover:text-destructive"
          title="Delete certification"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export function SortableUnitRow({
  unit,
  selected,
  expandDrawerOpen,
  onSelect,
  onEdit,
  onRemoveFromCert,
  onOpenPrerequisites,
  onOpenAssignments,
}: {
  unit: Doc<"units">;
  selected: boolean;
  expandDrawerOpen?: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onRemoveFromCert: () => void;
  onOpenPrerequisites?: () => void;
  onOpenAssignments?: () => void;
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
  const { text: descText, show: showDesc } = unitRowDescription(unit);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-stretch overflow-hidden border border-border bg-card text-sm shadow-sm",
        expandDrawerOpen ? "rounded-t-lg rounded-b-none border-b-0" : "rounded-lg",
        selected && cn("bg-muted/40", ADMIN_LIST_ROW_SELECTED),
      )}
    >
      <button
        type="button"
        className="shrink-0 cursor-grab self-stretch px-1.5 py-1.5 text-muted-foreground flex items-center"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className="min-w-0 flex-1 px-0 py-1.5 text-left leading-tight"
        onClick={onSelect}
      >
        <span className="block truncate font-medium">{unit.title}</span>
        {showDesc ? (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {descText}
          </span>
        ) : null}
      </button>
      <div
        className={cn(
          "flex shrink-0 flex-col border-l border-border transition-opacity duration-150 ease-out",
          isDragging
            ? "opacity-100"
            : "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
        )}
      >
        <div className="flex shrink-0 flex-row">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-none"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              Edit unit — title and description
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-none text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFromCert();
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              Remove this unit from the current certification only
            </TooltipContent>
          </Tooltip>
        </div>
        {onOpenPrerequisites || onOpenAssignments ? (
          <div className="flex shrink-0 flex-row border-t border-border/70">
            {onOpenPrerequisites ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-none text-brand-gold hover:text-brand-gold"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenPrerequisites();
                    }}
                  >
                    <Link2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  Prerequisites — other units learners must finish first
                </TooltipContent>
              </Tooltip>
            ) : null}
            {onOpenAssignments ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-none text-brand-sky hover:text-brand-sky"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenAssignments();
                    }}
                  >
                    <ClipboardList className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  Assignments — tests and quizzes for this unit
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        ) : null}
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
