"use client";

import type { ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { CertificationTierMedallion } from "@/components/certification-tier-medallion";
import { Badge } from "@/components/ui/badge";
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
  GripHorizontal,
  GripVertical,
  Layers,
  Link2,
  Pencil,
  Trash2,
  Unlink2,
} from "lucide-react";
import { toast } from "sonner";
import {
  certificationTierBadgeClass,
  certificationTierLabel,
  certificationTierSectionTitle,
  effectiveCertificationTier,
} from "@/lib/certificationTier";
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

export type AdminUnitDeliveryModeFilter = "self_paced" | "live_workshop";

/** L/R border colors by delivery — palette unit rows and delivery filter chips. */
export function adminUnitDeliveryLREdgeColors(
  mode: AdminUnitDeliveryModeFilter,
): string {
  return mode === "live_workshop"
    ? "border-l-purple-600 border-r-purple-600 dark:border-l-purple-400 dark:border-r-purple-400"
    : "border-l-brand-sky border-r-brand-sky dark:border-l-brand-sky dark:border-r-brand-sky";
}

/** Same hues, lower contrast when the other delivery filter is active. */
export function adminUnitDeliveryLREdgeColorsMuted(
  mode: AdminUnitDeliveryModeFilter,
): string {
  return mode === "live_workshop"
    ? "border-l-purple-600/45 border-r-purple-600/45 dark:border-l-purple-400/40 dark:border-r-purple-400/40"
    : "border-l-brand-sky/50 border-r-brand-sky/50 dark:border-l-brand-sky/45 dark:border-r-brand-sky/45";
}

function adminPaletteUnitDeliveryLREdgeClass(
  unit: Pick<Doc<"units">, "deliveryMode">,
): string {
  const mode: AdminUnitDeliveryModeFilter =
    (unit.deliveryMode ?? "self_paced") === "live_workshop"
      ? "live_workshop"
      : "self_paced";
  return adminUnitDeliveryLREdgeColors(mode);
}

function UnitRowPereqAssignChips({
  prerequisiteCount,
  assignmentCount,
  prereqsDrawerOpen,
  onOpenPrerequisites,
}: {
  prerequisiteCount: number;
  assignmentCount: number;
  prereqsDrawerOpen?: boolean;
  onOpenPrerequisites?: () => void;
}) {
  if (!onOpenPrerequisites) {
    return null;
  }
  const chipBtn =
    "inline-flex shrink-0 items-center justify-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold leading-none transition-colors";
  return (
    <div
      className="mt-1 flex min-w-0 flex-row flex-wrap items-center gap-1"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              chipBtn,
              prereqsDrawerOpen
                ? "border-brand-gold/80 bg-brand-gold/25 text-amber-800 shadow-sm dark:text-amber-200"
                : "border-brand-gold/65 bg-background/90 text-amber-600 hover:bg-brand-gold/15 dark:bg-card/80 dark:text-amber-400",
            )}
            onClick={(e) => {
              e.stopPropagation();
              onOpenPrerequisites();
            }}
          >
            <Link2 className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
            <span>Prereqs</span>
            <span className="tabular-nums">{prerequisiteCount}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          Prerequisites ({prerequisiteCount}) — other units learners must finish
          first. Click to expand or collapse.
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="mt-0.5 inline-flex max-w-full cursor-default items-center gap-1 text-left text-[11px] leading-tight text-muted-foreground"
            role="status"
          >
            <span className="tabular-nums font-semibold text-foreground/85">
              {assignmentCount}
            </span>
            <span>assessment{assignmentCount === 1 ? "" : "s"}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          Tests/assignments attached to this unit. Add or edit in All Content
          (+ or Edit); drag onto this unit to attach.
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function DraggableUnitPaletteItem({
  unit,
  selected,
  /** When showing all units with a cert selected: units already in that cert. */
  inSelectedCert,
  /** Drawer open directly under this row (affects rounding). */
  expandDrawerOpen,
  prerequisiteCount = 0,
  assignmentCount = 0,
  prereqsDrawerOpen,
  /** Resolved from `unitCategories` (short code for the row subtitle). */
  unitCategoryShortCode,
  onSelect,
  onEdit,
  onDelete,
  /** Shown on trash hover; reflects whether click opens remove-from-cert vs full delete. */
  deleteTooltip,
  /** Native `title` on the delete/unlink control; overrides defaults when set. */
  deleteButtonTitle,
  /** `unlink` = remove from selected cert only; `trash` = delete unit from the system. */
  deleteVariant = "trash",
  /**
   * When `deleteVariant` is `unlink`: `sky` matches {@link SortableUnitRow} unlink; `muted` is
   * neutral (e.g. remove-from-cert in the all-units palette).
   */
  unlinkActionTone = "muted",
  onOpenPrerequisites,
}: {
  unit: UnitAdminListRow;
  selected?: boolean;
  inSelectedCert?: boolean;
  expandDrawerOpen?: boolean;
  prerequisiteCount?: number;
  assignmentCount?: number;
  prereqsDrawerOpen?: boolean;
  unitCategoryShortCode?: string;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  deleteTooltip?: string;
  deleteButtonTitle?: string;
  deleteVariant?: "unlink" | "trash";
  unlinkActionTone?: "sky" | "muted";
  onOpenPrerequisites?: () => void;
}) {
  const paletteDragDisabled = Boolean(inSelectedCert);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-unit:${unit._id}`,
    disabled: paletteDragDisabled,
  });
  const hasActions = onEdit != null || onDelete != null;
  const { text: descText, show: showDesc } = unitRowDescription(unit);
  const chips = onOpenPrerequisites ? (
    <UnitRowPereqAssignChips
      prerequisiteCount={prerequisiteCount}
      assignmentCount={assignmentCount}
      prereqsDrawerOpen={prereqsDrawerOpen}
      onOpenPrerequisites={onOpenPrerequisites}
    />
  ) : null;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group flex min-w-0 items-stretch overflow-hidden border border-l-4 border-r-4 text-sm shadow-sm",
        expandDrawerOpen ? "rounded-t-lg rounded-b-none border-b-0" : "rounded-lg",
        !inSelectedCert && "bg-card border-border",
        inSelectedCert && ADMIN_CERT_PANEL_ROW_HIGHLIGHT,
        adminPaletteUnitDeliveryLREdgeClass(unit),
        !inSelectedCert && selected && cn("bg-muted/40", ADMIN_LIST_ROW_SELECTED),
        inSelectedCert && selected && ADMIN_LIST_ROW_SELECTED,
        isDragging && "opacity-40",
      )}
    >
      {paletteDragDisabled ? (
        <div
          className="flex shrink-0 items-center self-stretch px-1.5 text-muted-foreground/45"
          title="Already on this certification — switch to that cert’s unit list to reorder"
        >
          <GripHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </div>
      ) : (
        <button
          type="button"
          className="cursor-grab touch-none shrink-0 self-stretch px-1.5 py-1.5 text-muted-foreground flex items-center"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      {onSelect ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col px-0 py-1.5">
          <button
            type="button"
            className="min-w-0 text-left leading-tight"
            onClick={onSelect}
          >
            <span className="block truncate font-medium">{unit.title}</span>
            {unitCategoryShortCode?.trim() ? (
              <span className="mt-0.5 block truncate text-[10px] font-medium uppercase tracking-wide text-brand-gold/90">
                {unitCategoryShortCode.trim()}
              </span>
            ) : null}
            {showDesc ? (
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {descText}
              </span>
            ) : null}
          </button>
          {chips}
        </div>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col px-0 py-1.5">
          <div className="leading-tight">
            <span className="block truncate font-medium">{unit.title}</span>
            {unitCategoryShortCode?.trim() ? (
              <span className="mt-0.5 block truncate text-[10px] font-medium uppercase tracking-wide text-brand-gold/90">
                {unitCategoryShortCode.trim()}
              </span>
            ) : null}
            {showDesc ? (
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {descText}
              </span>
            ) : null}
          </div>
          {chips}
        </div>
      )}
      {hasActions ? (
        <div
          className={cn(
            "flex shrink-0 flex-col items-center justify-center self-stretch border-l border-border transition-opacity duration-150 ease-out",
            isDragging
              ? "opacity-100"
              : "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
          )}
        >
          {onEdit || onDelete ? (
            <>
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
                      className={cn(
                        "h-7 w-7 rounded-none",
                        deleteVariant === "unlink"
                          ? unlinkActionTone === "sky"
                            ? "text-brand-sky hover:bg-brand-sky/15 hover:text-brand-sky dark:hover:bg-brand-sky/20"
                            : "text-muted-foreground hover:text-foreground"
                          : "text-destructive hover:text-destructive",
                      )}
                      title={
                        deleteButtonTitle ??
                        (deleteVariant === "unlink"
                          ? "Remove from certification"
                          : "Delete unit from system")
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                      }}
                    >
                      {deleteVariant === "unlink" ? (
                        <Unlink2 className="h-3 w-3" aria-hidden />
                      ) : (
                        <Trash2 className="h-3 w-3" aria-hidden />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    {deleteTooltip ??
                      (deleteVariant === "unlink"
                        ? "Remove from the selected certification only — unit stays in the library"
                        : "Delete unit from the system (all certifications and links)")}
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </>
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
export function libraryContentDisplayTitle(raw: string): string {
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
          ? "Deck"
          : item.type === "test"
            ? "Test"
            : item.type === "assignment"
              ? "Assignment"
              : item.type === "workshop_session"
                ? "Live workshop"
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
  if (
    (item.type === "test" || item.type === "assignment") &&
    item.assessment
  ) {
    const n = item.assessment.questions.length;
    parts.push(`${n} question${n === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}

export function ContentLibraryDragRow({
  item,
  selected,
  /** All-content mode + unit selected: item is already attached to that unit (mirrors units-in-cert tint). */
  inSelectedUnit,
  contentCategoryShortCode,
  onEdit,
  onDelete,
}: {
  item: Doc<"contentItems">;
  /** Highlights the row (e.g. item open in the edit dialog). */
  selected?: boolean;
  inSelectedUnit?: boolean;
  contentCategoryShortCode?: string;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const paletteDragDisabled = Boolean(inSelectedUnit);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-content:${item._id}`,
    disabled: paletteDragDisabled,
  });
  const subtitle = contentLibrarySubtitle(item);
  const displayTitle = libraryContentDisplayTitle(item.title);
  const hasActions = onEdit != null || onDelete != null;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group flex min-w-0 items-stretch overflow-hidden rounded-lg border text-sm shadow-sm",
        inSelectedUnit && ADMIN_UNIT_PANEL_CONTENT_IN_UNIT_HIGHLIGHT,
        !inSelectedUnit && "border-border bg-card",
        !inSelectedUnit && selected && ADMIN_LIST_ROW_SELECTED,
        inSelectedUnit && selected && ADMIN_LIST_ROW_SELECTED,
        isDragging && "opacity-40",
      )}
    >
      {paletteDragDisabled ? (
        <div
          className="flex shrink-0 items-center self-stretch px-1.5 text-muted-foreground/45"
          title={
            inSelectedUnit
              ? "On the selected unit — use Show all content to drag onto other units"
              : undefined
          }
        >
          <GripHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </div>
      ) : (
        <button
          type="button"
          className="cursor-grab touch-none shrink-0 self-stretch px-1.5 py-1.5 text-muted-foreground flex items-center"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="min-w-0 flex-1 px-0 py-1.5 leading-tight">
        <div className="truncate font-medium">{displayTitle}</div>
        {item.code?.trim() ? (
          <div className="mt-0.5 truncate font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/90">
            {item.code.trim()}
          </div>
        ) : null}
        {contentCategoryShortCode?.trim() ? (
          <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-wide text-brand-sky/90">
            {contentCategoryShortCode.trim()}
          </div>
        ) : null}
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {subtitle}
        </div>
      </div>
      {hasActions ? (
        <div
          className={cn(
            "flex shrink-0 flex-col items-center justify-center self-stretch border-l border-border transition-opacity duration-150 ease-out",
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

/** Content attached to a unit — reorder within the unit only (pancake handle). */
export type UnitAttachedContentRow = Doc<"contentItems"> & {
  order: number;
  unitContentId: Id<"unitContents"> | null;
};

export function SortableUnitContentRow({
  item,
  selected,
  dimmed,
  /** When true (e.g. category/search filter on), row is not a drag reorder source. */
  disableDrag,
  contentCategoryShortCode,
  onEdit,
  onDelete,
}: {
  item: UnitAttachedContentRow;
  selected?: boolean;
  dimmed?: boolean;
  disableDrag?: boolean;
  contentCategoryShortCode?: string;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item._id, disabled: Boolean(disableDrag) });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : dimmed ? 0.35 : 1,
  };
  const subtitle = contentLibrarySubtitle(item);
  const displayTitle = libraryContentDisplayTitle(item.title);
  const hasActions = onEdit != null || onDelete != null;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex min-w-0 items-stretch overflow-hidden rounded-lg border border-border bg-card text-sm shadow-sm",
        selected && ADMIN_LIST_ROW_SELECTED,
      )}
    >
      <button
        type="button"
        title={
          disableDrag
            ? "Clear search and set content category chip to All to reorder"
            : "Drag to reorder lessons on this unit"
        }
        className={cn(
          "touch-none shrink-0 self-stretch px-1.5 py-1.5 text-muted-foreground flex items-center",
          disableDrag
            ? "cursor-not-allowed opacity-50"
            : "cursor-grab",
        )}
        disabled={disableDrag}
        aria-disabled={disableDrag}
        {...(disableDrag ? {} : { ...attributes, ...listeners })}
      >
        <GripHorizontal className="h-3.5 w-3.5" />
      </button>
      <div className="min-w-0 flex-1 px-0 py-1.5 leading-tight">
        <div className="truncate font-medium">{displayTitle}</div>
        {item.code?.trim() ? (
          <div className="mt-0.5 truncate font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/90">
            {item.code.trim()}
          </div>
        ) : null}
        {contentCategoryShortCode?.trim() ? (
          <div className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-wide text-brand-sky/90">
            {contentCategoryShortCode.trim()}
          </div>
        ) : null}
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {subtitle}
        </div>
      </div>
      {hasActions ? (
        <div
          className={cn(
            "flex shrink-0 flex-col items-center justify-center self-stretch border-l border-border transition-opacity duration-150 ease-out",
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
              className="h-7 w-7 rounded-none text-brand-sky hover:bg-brand-sky/15 hover:text-brand-sky dark:hover:bg-brand-sky/20"
              title="Unlink from this unit"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Unlink2 className="h-3 w-3" aria-hidden />
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
  /** When collision resolves to the inner sortable id, parent sets this so the row still highlights. */
  dropHighlight,
  children,
}: {
  unitId: Id<"units">;
  /** When set (e.g. a unit is selected for detail), ignore drops here. */
  disabled?: boolean;
  dropHighlight?: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `unit-content-drop-${unitId}`,
    disabled: Boolean(disabled),
  });
  const showTarget =
    !disabled && (isOver || dropHighlight);
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg transition-[box-shadow,background-color] duration-150",
        showTarget &&
          "relative z-[1] bg-brand-gold/50 shadow-xl shadow-brand-gold/25 ring-[3px] ring-brand-gold ring-offset-[4px] ring-offset-background dark:bg-brand-gold/40 dark:shadow-brand-gold/20",
      )}
    >
      {children}
    </div>
  );
}

/** Drop target for adding a palette unit to a certification (all-units mode). */
export function LevelRowDroppable({
  levelId,
  /** When `over` is the sortable cert id, parent sets this so highlight still shows. */
  dropHighlight,
  children,
}: {
  levelId: Id<"certificationLevels">;
  dropHighlight?: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `level-units-add-${levelId}`,
  });
  const showTarget = isOver || dropHighlight;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg p-0.5 transition-[box-shadow,background-color] duration-150",
        showTarget &&
          "relative z-[1] bg-brand-lime/55 shadow-xl shadow-brand-lime/30 ring-[3px] ring-brand-lime ring-offset-[4px] ring-offset-background dark:bg-brand-lime/45 dark:shadow-brand-lime/25",
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
  unitCount,
  /** When true (e.g. search filter on), row is not a drag reorder source. */
  disableDrag,
  onSelect,
  onEdit,
  onDelete,
}: {
  level: Doc<"certificationLevels">;
  selected: boolean;
  /** Number of units in this certification; omit while loading. */
  unitCount?: number;
  disableDrag?: boolean;
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
  } = useSortable({ id: level._id, disabled: Boolean(disableDrag) });

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

  const unitChipBtn =
    "inline-flex shrink-0 items-center justify-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold leading-none transition-colors";

  const unitCountTooltip =
    unitCount === undefined
      ? "Loading unit count. Drag units from the centre column onto this certification to add them."
      : unitCount === 1
        ? "1 unit in this certification. Drag units from the centre column onto this certification to add them."
        : `${unitCount} units in this certification. Drag units from the centre column onto this certification to add them.`;

  const tier = effectiveCertificationTier(level);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-stretch overflow-hidden rounded-lg border shadow-sm",
        selected
          ? cn(ADMIN_CERT_PANEL_ROW_HIGHLIGHT, ADMIN_LIST_ROW_SELECTED)
          : "border-border bg-card",
      )}
    >
      {disableDrag ? (
        <div
          className="flex shrink-0 items-center self-stretch px-1.5 text-muted-foreground/45"
          title="Clear search or category filter to reorder certifications"
        >
          <GripHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </div>
      ) : (
        <button
          type="button"
          title="Drag to reorder certifications"
          className="cursor-grab touch-none shrink-0 self-stretch px-1.5 py-1.5 text-muted-foreground flex items-center"
          {...attributes}
          {...listeners}
        >
          <GripHorizontal className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-0 py-1.5">
        <button
          type="button"
          className="min-w-0 text-left leading-tight"
          onClick={onSelect}
        >
          <span className="block truncate text-sm font-medium">{level.name}</span>
          {level.code?.trim() ? (
            <span className="mt-0.5 block truncate font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/90">
              {level.code.trim()}
            </span>
          ) : null}
          {showShort ? (
            <span className="mt-0.5 block line-clamp-2 text-[11px] text-muted-foreground">
              {short}
            </span>
          ) : null}
        </button>
        <div
          className="mt-1 flex min-w-0 flex-row flex-wrap items-center gap-1"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Badge
            className={cn(
              "shrink-0 px-1.5 py-0 text-[10px] font-bold uppercase tracking-wide",
              certificationTierBadgeClass(tier),
            )}
            aria-label={certificationTierLabel(tier)}
            title={certificationTierSectionTitle(tier)}
          >
            <CertificationTierMedallion tier={tier} />
          </Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  unitChipBtn,
                  "cursor-default border-brand-lime/65 bg-background/90 text-lime-800 dark:bg-card/80 dark:text-lime-300",
                )}
              >
                <Layers className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
                <span>Units</span>
                <span className="tabular-nums">
                  {unitCount === undefined ? "…" : unitCount}
                </span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="left">{unitCountTooltip}</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div
        className={cn(
          "flex shrink-0 flex-col items-center justify-center self-stretch border-l border-border transition-opacity duration-150 ease-out",
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
            className="h-7 w-7 shrink-0 rounded-none"
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
  prerequisiteCount = 0,
  assignmentCount = 0,
  prereqsDrawerOpen,
  /** When true (e.g. search filter on), row is not a drag reorder source. */
  disableDrag,
  unitCategoryShortCode,
  onSelect,
  onEdit,
  onRemoveFromCert,
  onOpenPrerequisites,
}: {
  unit: Doc<"units">;
  selected: boolean;
  expandDrawerOpen?: boolean;
  prerequisiteCount?: number;
  assignmentCount?: number;
  prereqsDrawerOpen?: boolean;
  disableDrag?: boolean;
  unitCategoryShortCode?: string;
  onSelect: () => void;
  onEdit: () => void;
  onRemoveFromCert: () => void;
  onOpenPrerequisites?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: unit._id, disabled: Boolean(disableDrag) });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };
  const { text: descText, show: showDesc } = unitRowDescription(unit);
  const chips = onOpenPrerequisites ? (
    <UnitRowPereqAssignChips
      prerequisiteCount={prerequisiteCount}
      assignmentCount={assignmentCount}
      prereqsDrawerOpen={prereqsDrawerOpen}
      onOpenPrerequisites={onOpenPrerequisites}
    />
  ) : null;

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
      {disableDrag ? (
        <div
          className="flex shrink-0 items-center self-stretch px-1.5 text-muted-foreground/45"
          title="Clear search or category filter to reorder units in this certification"
        >
          <GripHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </div>
      ) : (
        <button
          type="button"
          title="Drag to reorder units in this certification"
          className="shrink-0 cursor-grab touch-none self-stretch px-1.5 py-1.5 text-muted-foreground flex items-center"
          {...attributes}
          {...listeners}
        >
          <GripHorizontal className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-0 py-1.5">
        <button
          type="button"
          className="min-w-0 text-left leading-tight"
          onClick={onSelect}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-medium">{unit.title}</span>
            {unit.deliveryMode === "live_workshop" ? (
              <Badge
                variant="outline"
                className="shrink-0 px-1.5 py-0 text-[9px] font-bold uppercase tracking-wide border-purple-500/50 text-purple-700 dark:border-purple-400/55 dark:text-purple-300"
              >
                Live
              </Badge>
            ) : null}
          </span>
          {unit.code?.trim() ? (
            <span className="mt-0.5 block truncate font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/90">
              {unit.code.trim()}
            </span>
          ) : null}
          {unitCategoryShortCode?.trim() ? (
            <span className="mt-0.5 block truncate text-[10px] font-medium uppercase tracking-wide text-brand-gold/90">
              {unitCategoryShortCode.trim()}
            </span>
          ) : null}
          {showDesc ? (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {descText}
            </span>
          ) : null}
        </button>
        {chips}
      </div>
      <div
        className={cn(
          "flex shrink-0 flex-col items-center justify-center self-stretch border-l border-border transition-opacity duration-150 ease-out",
          isDragging
            ? "opacity-100"
            : "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
        )}
      >
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
            Edit unit — title, category, and description
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-none text-brand-sky hover:bg-brand-sky/15 hover:text-brand-sky dark:hover:bg-brand-sky/20"
              title="Unlink from this certification"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveFromCert();
              }}
            >
              <Unlink2 className="h-3 w-3" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            Remove this unit from the current certification only — unit stays in
            the library
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
