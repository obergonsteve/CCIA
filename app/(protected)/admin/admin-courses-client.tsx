"use client";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminCategoryCrudSection } from "@/components/admin/admin-category-crud-section";
import { CertificationTierIconPicker } from "@/components/admin/certification-tier-icon-picker";
import { CertificationTierMedallion } from "@/components/certification-tier-medallion";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useMutation, useQuery } from "convex/react";
import {
  BookMarked,
  GraduationCap,
  GripHorizontal,
  GripVertical,
  Layers,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { suggestEntityCodeFromLabel } from "@/lib/entity-code-form";
import {
  certificationTierLabel,
  certificationTierSectionTitle,
  effectiveCertificationTier,
  type CertificationTierKey,
} from "@/lib/certificationTier";
import { cn } from "@/lib/utils";
import { PrerequisiteDropEditor } from "@/components/admin/prerequisite-drop-editor";
import {
  ContentLibraryDragRow,
  DraggableUnitPaletteItem,
  LevelRowDroppable,
  libraryContentDisplayTitle,
  SortableLevelRow,
  SortableUnitContentRow,
  SortableUnitRow,
  UnitRowContentDropTarget,
  type UnitAdminListRow,
} from "./admin-shared";

/** Radix Select sentinel — no category on entity. */
const CATEGORY_SELECT_NONE = "__none__" as const;

/** Filter chip second line: only when long text differs from short code (migration often duplicated the legacy label). */
function categoryChipSubtitle(
  longDescription: string,
  shortCode: string,
): string | undefined {
  const long = longDescription.trim();
  const short = shortCode.trim();
  if (!long) {
    return undefined;
  }
  if (long.localeCompare(short, undefined, { sensitivity: "accent" }) === 0) {
    return undefined;
  }
  return long;
}

/** Category dropdown row: short code plus long text when they differ. */
function categorySelectLabel(shortCode: string, longDescription: string): string {
  const sub = categoryChipSubtitle(longDescription, shortCode);
  return sub ? `${shortCode.trim()} — ${sub}` : shortCode.trim();
}

/** Closed-trigger + `itemToStringLabel`: show category short code (FK stays in `value`). */
function categoryTriggerLabel(shortCode: string): string {
  return shortCode.trim();
}

/**
 * Base UI Select shows the raw `value` string when it does not match any `SelectItem`
 * (e.g. Convex id before `listAdmin` resolves). Never pass an orphan id as `value`.
 */
function filterCategorySelectValue(
  value: "all" | string,
  categories: { _id: string }[],
): "all" | string {
  if (value === "all") {
    return "all";
  }
  return categories.some((c) => c._id === value) ? value : "all";
}

function entityCategorySelectValue(
  stored: string,
  noneToken: string,
  rows: { _id: string }[],
): string {
  if (stored === noneToken) {
    return noneToken;
  }
  return rows.some((r) => r._id === stored) ? stored : noneToken;
}

/**
 * Base UI `Select.Root`: when `items` is not passed, `Select.Value` uses `itemToStringLabel(value)`
 * for the closed trigger. Without this, the trigger shows the raw Convex id.
 */
function categorySelectItemToStringLabel(
  rows: { _id: string; shortCode: string }[] | undefined,
  options: {
    noneLabel: string;
    noneToken?: string;
    allToken?: string;
    allLabel?: string;
  },
): (value: string | null) => string {
  const {
    noneLabel,
    noneToken = CATEGORY_SELECT_NONE,
    allToken,
    allLabel,
  } = options;
  return (value) => {
    if (value == null) {
      return noneLabel;
    }
    const v = String(value);
    if (allToken != null && v === allToken) {
      return allLabel ?? v;
    }
    if (v === noneToken) {
      return noneLabel;
    }
    if (!rows?.length) {
      return "…";
    }
    const row = rows.find((r) => r._id === v);
    return row ? categoryTriggerLabel(row.shortCode) : "…";
  };
}

/** List-column filter: same rows as category CRUD / edit dialogs (`listAdmin`), not ad-hoc chips. */
function AdminCategoryFilterSelect({
  htmlId,
  label,
  value,
  onValueChange,
  categories,
}: {
  htmlId: string;
  label: string;
  value: "all" | string;
  onValueChange: (v: string) => void;
  categories:
    | { _id: string; shortCode: string; longDescription: string }[]
    | undefined;
}) {
  if (categories === undefined) {
    return (
      <div className="mb-2 space-y-1">
        <Label
          htmlFor={htmlId}
          className="text-xs font-medium text-muted-foreground"
        >
          {label}
        </Label>
        <div
          id={htmlId}
          aria-busy="true"
          className="flex h-9 w-full max-w-full items-center rounded-md border border-dashed border-muted-foreground/30 bg-muted/25 px-3 text-xs text-muted-foreground"
        >
          Loading categories…
        </div>
      </div>
    );
  }
  const selectValue = filterCategorySelectValue(value, categories);
  return (
    <div className="mb-2 space-y-1">
      <Label
        htmlFor={htmlId}
        className="text-xs font-medium text-muted-foreground"
      >
        {label}
      </Label>
      <Select
        value={selectValue}
        onValueChange={(v) => onValueChange(v ?? "all")}
        itemToStringLabel={categorySelectItemToStringLabel(categories, {
          noneLabel: "All categories",
          allToken: "all",
          allLabel: "All categories",
        })}
      >
        <SelectTrigger id={htmlId} className="h-9 w-full max-w-full bg-card">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" label="All categories">
            All categories
          </SelectItem>
          {categories.map((c) => (
            <SelectItem
              key={c._id}
              value={c._id}
              label={categoryTriggerLabel(c.shortCode)}
            >
              {categorySelectLabel(c.shortCode, c.longDescription)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type ContentDeleteDialogTarget =
  | {
      kind: "detachFromUnit";
      contentId: Id<"contentItems">;
      unitContentId: Id<"unitContents"> | null;
      unitId: Id<"units">;
      displayTitle: string;
      unitLabel: string;
    }
  | {
      kind: "library";
      contentId: Id<"contentItems">;
      displayTitle: string;
    };

type EditAssessmentQuestion = NonNullable<
  NonNullable<Doc<"contentItems">["assessment"]>["questions"]
>[number];

function createEmptyAssessment(): NonNullable<
  Doc<"contentItems">["assessment"]
> {
  return {
    description: "—",
    passingScore: 80,
    questions: [
      {
        id: crypto.randomUUID(),
        question: "",
        type: "multiple_choice",
        options: ["", ""],
        correctAnswer: "",
      },
    ],
  };
}

/** Link / video / PDF / deck: primary resource field. Tests & assignments use description + assessment block instead. */
function urlFieldForContentKind(kind: Doc<"contentItems">["type"]): {
  label: string;
  placeholder: string;
} | null {
  switch (kind) {
    case "link":
      return { label: "URL", placeholder: "https://…" };
    case "video":
      return {
        label: "Video URL",
        placeholder: "YouTube, Vimeo, or direct file URL",
      };
    case "pdf":
      return {
        label: "PDF URL",
        placeholder: "https://… to the PDF file",
      };
    case "slideshow":
      return {
        label: "Deck / slideshow URL",
        placeholder: "URL to the slideshow or presentation",
      };
    case "workshop_session":
      return {
        label: "Notes (optional)",
        placeholder: "Short message shown with this step",
      };
    default:
      return null;
  }
}

/** Prefer pointer-inside droppables so cross-column unit → certification drops register reliably. */
const coursesDndCollision: CollisionDetection = (args) => {
  const byPointer = pointerWithin(args);
  if (byPointer.length > 0) {
    return byPointer;
  }
  return closestCenter(args);
};

/**
 * Cert rows use `useSortable({ id: level._id })`, so `over` is the certification
 * id — not the wrapper droppable `level-units-add-*`. Accept both.
 */
function resolveCertificationIdForPaletteUnitDrop(
  overId: string,
  levels: Doc<"certificationLevels">[] | undefined,
): Id<"certificationLevels"> | null {
  if (!levels?.length) {
    return null;
  }
  if (overId.startsWith("level-units-add-")) {
    return overId.slice("level-units-add-".length) as Id<
      "certificationLevels"
    >;
  }
  return levels.some((l) => l._id === overId)
    ? (overId as Id<"certificationLevels">)
    : null;
}

/**
 * `over` may be the wrapper droppable `unit-content-drop-*` or the sortable
 * unit row id — same pattern as certifications.
 */
/** Sortable row id or nested `unit-content-drop-*` droppable from DnD collision. */
function resolveUnitSortCollisionId(id: string): string {
  if (id.startsWith("unit-content-drop-")) {
    return id.slice("unit-content-drop-".length);
  }
  return id;
}

/** Sortable cert id or wrapper `level-units-add-*` droppable. */
function resolveLevelSortCollisionId(id: string): string {
  if (id.startsWith("level-units-add-")) {
    return id.slice("level-units-add-".length);
  }
  return id;
}

function resolveUnitIdForPaletteContentDrop(
  overId: string,
  args: {
    allUnits: UnitAdminListRow[] | undefined;
    unitsInFilteredCert: Doc<"units">[] | undefined;
    filterCertId: Id<"certificationLevels"> | null;
    centreUnitsShowAll: boolean;
  },
): Id<"units"> | null {
  if (!overId) {
    return null;
  }
  if (overId.startsWith("unit-content-drop-")) {
    return overId.slice("unit-content-drop-".length) as Id<"units">;
  }
  /**
   * All-units rows nest `DraggableUnitPaletteItem` (`palette-unit:*`) inside
   * `UnitRowContentDropTarget`. Pointer collision often returns the inner
   * draggable id — same idea as sortable cert id vs level-units-add-*.
   */
  const unitKey = overId.startsWith("palette-unit:")
    ? overId.slice("palette-unit:".length)
    : overId;
  const { allUnits, unitsInFilteredCert, filterCertId, centreUnitsShowAll } =
    args;
  if (filterCertId && !centreUnitsShowAll) {
    if (!unitsInFilteredCert?.length) {
      return null;
    }
    return unitsInFilteredCert.some((u) => u._id === unitKey)
      ? (unitKey as Id<"units">)
      : null;
  }
  if (!allUnits?.length) {
    return null;
  }
  return allUnits.some((u) => u._id === unitKey)
    ? (unitKey as Id<"units">)
    : null;
}

function TrainingColumnChip({
  tone,
  label,
  count,
  /** Extra content between title and count (e.g. units scope + icon). */
  trailing,
}: {
  tone: "lime" | "gold" | "sky";
  /** Omit or leave empty to show only `trailing` + count (all three columns use `trailing` + icon). */
  label?: string;
  count: number | null;
  trailing?: ReactNode;
}) {
  const skin = {
    lime: "border-brand-lime/55 bg-[color-mix(in_oklab,var(--brand-lime)_30%,var(--card))] text-foreground dark:bg-[color-mix(in_oklab,var(--brand-lime)_24%,var(--card))]",
    gold: "border-brand-gold/55 bg-[color-mix(in_oklab,var(--brand-gold)_32%,var(--card))] text-foreground dark:bg-[color-mix(in_oklab,var(--brand-gold)_26%,var(--card))]",
    sky: "border-brand-sky/55 bg-[color-mix(in_oklab,var(--brand-sky)_30%,var(--card))] text-foreground dark:bg-[color-mix(in_oklab,var(--brand-sky)_24%,var(--card))]",
  }[tone];
  return (
    <div className="relative z-10 -mt-3 mb-1 flex w-full shrink-0 justify-center border-b border-border/40 pb-1">
      <span
        className={cn(
          "inline-flex max-w-full min-w-0 items-center gap-2 rounded-full border px-3.5 py-1 text-[13px] font-bold leading-tight shadow-sm",
          skin,
        )}
      >
        {label?.trim() ? (
          <span className="shrink-0">{label.trim()}</span>
        ) : null}
        {trailing != null ? (
          <span className="flex min-w-0 flex-1 items-center justify-center gap-1.5 text-center">
            {trailing}
          </span>
        ) : null}
        <span className="shrink-0 tabular-nums rounded-md bg-background px-1.5 py-0.5 text-xs font-bold leading-none text-foreground dark:bg-muted">
          {count === null ? "…" : count}
        </span>
      </span>
    </div>
  );
}

export default function AdminCoursesClient() {
  const companies = useQuery(api.companies.list);
  const levels = useQuery(api.certifications.listAllAdmin);
  const allUnits = useQuery(api.units.listAllAdmin);
  const unitPrereqAssignCounts = useQuery(api.units.adminPrereqAndAssignmentCounts);

  const createLevel = useMutation(api.certifications.create);
  const updateLevel = useMutation(api.certifications.update);
  const reorderLevels = useMutation(api.certifications.reorderLevels);
  const createUnit = useMutation(api.units.create);
  const updateUnit = useMutation(api.units.update);
  const addUnitToLevel = useMutation(api.units.addUnitToLevel);
  const removeUnitFromLevel = useMutation(api.units.removeUnitFromLevel);
  const reorderUnitsInLevel = useMutation(api.units.reorderUnitsInLevel);
  const createContent = useMutation(api.content.create);
  const updateContent = useMutation(api.content.update);
  const removeContent = useMutation(api.content.remove);
  const attachContentToUnit = useMutation(api.content.attachToUnit);
  const detachContentFromUnit = useMutation(api.content.detachFromUnit);
  const legacyDetachContentFromUnit = useMutation(
    api.content.legacyDetachFromUnit,
  );
  const patchUnitContentOrder = useMutation(api.content.patchUnitContentOrder);
  const patchLegacyContentOrder = useMutation(api.content.patchLegacyContentOrder);
  const reorderContentOnUnit = useMutation(api.content.reorderContentOnUnit);
  const allLibraryContent = useQuery(api.content.listAllAdmin);
  const workshopSessionsAdmin = useQuery(api.workshops.listSessionsAdmin);
  const certCategories = useQuery(api.certificationCategories.listAdmin);
  const unitCategories = useQuery(api.unitCategories.listAdmin);
  const contentCategories = useQuery(api.contentCategories.listAdmin);
  const deleteCertificationLevel = useMutation(api.certifications.remove);
  const deleteUnit = useMutation(api.units.remove);
  /** Certification chosen in the edit dialog or delete confirmation. */
  const [editCertId, setEditCertId] =
    useState<Id<"certificationLevels"> | null>(null);
  /**
   * ADMIN.md: clicking a certification filters the centre column to that cert’s
   * units; click again to show all units.
   */
  const [filterCertId, setFilterCertId] =
    useState<Id<"certificationLevels"> | null>(null);
  /**
   * When a cert is selected, centre column can show that cert’s units or all
   * units (Company Setup pattern); cert row stays highlighted either way.
   */
  const [centreUnitsShowAll, setCentreUnitsShowAll] = useState(false);
  /**
   * ADMIN.md: clicking a unit filters the right column to that unit’s content;
   * click again for all-content (library) mode.
   */
  const [selectedDetailUnitId, setSelectedDetailUnitId] =
    useState<Id<"units"> | null>(null);
  /**
   * When a unit is selected, the library column can list that unit’s content or
   * the full library (same pattern as cert + centre column).
   */
  const [libraryShowAll, setLibraryShowAll] = useState(false);
  const [certDetailsOpen, setCertDetailsOpen] = useState(false);
  const [addCertOpen, setAddCertOpen] = useState(false);
  const [addUnitOpen, setAddUnitOpen] = useState(false);
  const [addLibraryOpen, setAddLibraryOpen] = useState(false);
  /** Centre column: prerequisites panel expanded under this unit row. */
  const [prereqsPanelUnitId, setPrereqsPanelUnitId] =
    useState<Id<"units"> | null>(null);
  const [dragOverlayUnitId, setDragOverlayUnitId] =
    useState<Id<"units"> | null>(null);
  const [dragOverlayContentId, setDragOverlayContentId] =
    useState<Id<"contentItems"> | null>(null);
  const [dropHighlightLevelId, setDropHighlightLevelId] =
    useState<Id<"certificationLevels"> | null>(null);
  const [dropHighlightUnitId, setDropHighlightUnitId] =
    useState<Id<"units"> | null>(null);
  const [pendingAddUnitToCert, setPendingAddUnitToCert] = useState<{
    unitId: Id<"units">;
    levelId: Id<"certificationLevels">;
  } | null>(null);
  const [pendingAttachContentToUnit, setPendingAttachContentToUnit] = useState<{
    contentId: Id<"contentItems">;
    unitId: Id<"units">;
  } | null>(null);

  /** Avoid post-drop snap-back while Convex refetches (merge with server in useMemo). */
  const [optimisticLevelOrder, setOptimisticLevelOrder] = useState<
    Id<"certificationLevels">[] | null
  >(null);
  const [optimisticUnitsInCertOrder, setOptimisticUnitsInCertOrder] = useState<
    Id<"units">[] | null
  >(null);
  const [optimisticDetailContentOrder, setOptimisticDetailContentOrder] =
    useState<Id<"contentItems">[] | null>(null);

  const [certSearch, setCertSearch] = useState("");
  /** Certifications column: filter list by admin-defined category (chips). */
  const [certCategoryFilter, setCertCategoryFilter] = useState<"all" | string>(
    "all",
  );
  /** Certifications column: filter list by certification tier (bronze/silver/gold). */
  const [certTierFilter, setCertTierFilter] = useState<
    "all" | CertificationTierKey
  >("all");
  const [unitSearch, setUnitSearch] = useState("");
  /** Units column: filter list by admin-defined category (chips). */
  const [unitCategoryFilter, setUnitCategoryFilter] = useState<"all" | string>(
    "all",
  );
  const [contentSearch, setContentSearch] = useState("");
  /** Content / library column: filter by admin-defined content category (chips). */
  const [contentLibraryCategoryFilter, setContentLibraryCategoryFilter] =
    useState<"all" | string>("all");

  const [levelName, setLevelName] = useState("");
  const [levelCode, setLevelCode] = useState("");
  const [levelCertCategorySelect, setLevelCertCategorySelect] =
    useState<string>(CATEGORY_SELECT_NONE);
  const [levelSummary, setLevelSummary] = useState("");
  const [levelDesc, setLevelDesc] = useState("");
  const [certDetailName, setCertDetailName] = useState("");
  const [certDetailCode, setCertDetailCode] = useState("");
  const [certDetailCertCategorySelect, setCertDetailCertCategorySelect] =
    useState<string>(CATEGORY_SELECT_NONE);
  const [certDetailSummary, setCertDetailSummary] = useState("");
  const [certDetailDesc, setCertDetailDesc] = useState("");
  const [certDetailTagline, setCertDetailTagline] = useState("");
  const [certDetailThumbnail, setCertDetailThumbnail] = useState("");
  const [certDetailCompanyId, setCertDetailCompanyId] = useState("");
  const [certDetailOrder, setCertDetailOrder] = useState("0");
  const [certDetailTier, setCertDetailTier] = useState<
    "bronze" | "silver" | "gold"
  >("bronze");
  const [addCertTier, setAddCertTier] = useState<
    "bronze" | "silver" | "gold"
  >("bronze");
  const [newUnitDeliveryMode, setNewUnitDeliveryMode] = useState<
    "self_paced" | "live_workshop"
  >("self_paced");
  const [editUnitDeliveryMode, setEditUnitDeliveryMode] = useState<
    "self_paced" | "live_workshop"
  >("self_paced");
  const [addLibraryWorkshopSessionId, setAddLibraryWorkshopSessionId] =
    useState<string>("");
  const [editWorkshopSessionId, setEditWorkshopSessionId] = useState<string>("");
  const [editContentOpen, setEditContentOpen] = useState(false);
  const [editContentId, setEditContentId] = useState<Id<"contentItems"> | null>(
    null,
  );
  const [editContentTitle, setEditContentTitle] = useState("");
  const [editContentCode, setEditContentCode] = useState("");
  const [editContentUrl, setEditContentUrl] = useState("");
  const [editContentKind, setEditContentKind] = useState<
    Doc<"contentItems">["type"]
  >("link");
  const [editContentAssessment, setEditContentAssessment] = useState<
    NonNullable<Doc<"contentItems">["assessment"]> | null
  >(null);
  const [editContentOrder, setEditContentOrder] = useState("0");
  const [editContentStorageId, setEditContentStorageId] =
    useState<Id<"_storage"> | null>(null);
  const [editContentCategorySelect, setEditContentCategorySelect] =
    useState<string>(CATEGORY_SELECT_NONE);

  const [unitTitle, setUnitTitle] = useState("");
  const [unitCode, setUnitCode] = useState("");
  const [newUnitCategorySelect, setNewUnitCategorySelect] =
    useState<string>(CATEGORY_SELECT_NONE);
  const [unitDesc, setUnitDesc] = useState("");
  const [editUnitOpen, setEditUnitOpen] = useState(false);
  const [editUnitId, setEditUnitId] = useState<Id<"units"> | null>(null);
  const [editUnitTitle, setEditUnitTitle] = useState("");
  const [editUnitCode, setEditUnitCode] = useState("");
  const [editUnitDesc, setEditUnitDesc] = useState("");
  const [editUnitCategorySelect, setEditUnitCategorySelect] =
    useState<string>(CATEGORY_SELECT_NONE);

  const [certDeleteOpen, setCertDeleteOpen] = useState(false);
  const [certDeleteId, setCertDeleteId] = useState<
    Id<"certificationLevels"> | null
  >(null);
  const [unitDeleteOpen, setUnitDeleteOpen] = useState(false);
  const [unitDeleteId, setUnitDeleteId] = useState<Id<"units"> | null>(null);
  const [contentDeleteTarget, setContentDeleteTarget] =
    useState<ContentDeleteDialogTarget | null>(null);
  const [detachFromCertOpen, setDetachFromCertOpen] = useState(false);
  const [detachFromCertUnitId, setDetachFromCertUnitId] =
    useState<Id<"units"> | null>(null);
  const [editUnitContentLinkId, setEditUnitContentLinkId] =
    useState<Id<"unitContents"> | null>(null);
  const [contentTitle, setContentTitle] = useState("");
  const [contentLibraryCode, setContentLibraryCode] = useState("");
  const [newLibraryContentCategorySelect, setNewLibraryContentCategorySelect] =
    useState<string>(CATEGORY_SELECT_NONE);
  const [contentUrl, setContentUrl] = useState("");
  const [contentKind, setContentKind] = useState<Doc<"contentItems">["type"]>(
    "link",
  );
  const [addLibraryAssessment, setAddLibraryAssessment] = useState<
    NonNullable<Doc<"contentItems">["assessment"]> | null
  >(null);

  const unitsInFilteredCert = useQuery(
    api.units.listByLevel,
    filterCertId ? { levelId: filterCertId } : "skip",
  );

  /** All-units view + cert selected: which units are already in that cert (for row tint). */
  const unitIdsInSelectedCertWhenBrowsingAll = useMemo(() => {
    if (!filterCertId || !centreUnitsShowAll || unitsInFilteredCert === undefined) {
      return null;
    }
    return new Set(unitsInFilteredCert.map((u) => u._id));
  }, [filterCertId, centreUnitsShowAll, unitsInFilteredCert]);

  const countsByUnitId = useMemo(() => {
    const m = new Map<
      Id<"units">,
      { prereqCount: number; assignmentCount: number }
    >();
    for (const row of unitPrereqAssignCounts ?? []) {
      m.set(row.unitId, {
        prereqCount: row.prereqCount,
        assignmentCount: row.assignmentCount,
      });
    }
    return m;
  }, [unitPrereqAssignCounts]);

  const certCategoryMetaById = useMemo(() => {
    const m = new Map<
      Id<"certificationCategories">,
      { shortCode: string; longDescription: string }
    >();
    for (const c of certCategories ?? []) {
      m.set(c._id, {
        shortCode: c.shortCode,
        longDescription: c.longDescription,
      });
    }
    return m;
  }, [certCategories]);

  const unitCategoryMetaById = useMemo(() => {
    const m = new Map<
      Id<"unitCategories">,
      { shortCode: string; longDescription: string }
    >();
    for (const c of unitCategories ?? []) {
      m.set(c._id, {
        shortCode: c.shortCode,
        longDescription: c.longDescription,
      });
    }
    return m;
  }, [unitCategories]);

  const contentCategoryMetaById = useMemo(() => {
    const m = new Map<
      Id<"contentCategories">,
      { shortCode: string; longDescription: string }
    >();
    for (const c of contentCategories ?? []) {
      m.set(c._id, {
        shortCode: c.shortCode,
        longDescription: c.longDescription,
      });
    }
    return m;
  }, [contentCategories]);

  useEffect(() => {
    if (!selectedDetailUnitId || unitCategoryFilter === "all") {
      return;
    }
    const u = allUnits?.find((x) => x._id === selectedDetailUnitId);
    if (!u) {
      return;
    }
    const catId = u.unitCategoryId ?? "";
    if (catId === unitCategoryFilter) {
      return;
    }
    const meta = unitCategoryMetaById.get(
      unitCategoryFilter as Id<"unitCategories">,
    );
    const legacy = u.unitCategory?.trim() ?? "";
    if (meta && legacy === meta.shortCode) {
      return;
    }
    setSelectedDetailUnitId(null);
    setPrereqsPanelUnitId(null);
  }, [
    selectedDetailUnitId,
    allUnits,
    unitCategoryFilter,
    unitCategoryMetaById,
  ]);

  const unitCountByLevelId = useMemo(() => {
    const m = new Map<Id<"certificationLevels">, number>();
    if (!allUnits) {
      return m;
    }
    for (const u of allUnits) {
      for (const lid of u.certificationLevelIds) {
        m.set(lid, (m.get(lid) ?? 0) + 1);
      }
    }
    return m;
  }, [allUnits]);

  const dragOverlayUnit = useMemo((): UnitAdminListRow | null => {
    if (!dragOverlayUnitId || !allUnits) {
      return null;
    }
    return allUnits.find((u) => u._id === dragOverlayUnitId) ?? null;
  }, [dragOverlayUnitId, allUnits]);

  const pendingAddUnitToCertLabels = useMemo(() => {
    if (!pendingAddUnitToCert || !allUnits || !levels) {
      return null;
    }
    const u = allUnits.find((x) => x._id === pendingAddUnitToCert.unitId);
    const l = levels.find((x) => x._id === pendingAddUnitToCert.levelId);
    return {
      unitTitle: u?.title ?? "Unit",
      levelName: l?.name ?? "Certification",
    };
  }, [pendingAddUnitToCert, allUnits, levels]);

  const certSearchLower = certSearch.trim().toLowerCase();
  const unitSearchLower = unitSearch.trim().toLowerCase();
  const contentSearchLower = contentSearch.trim().toLowerCase();

  const levelMatchesSearch = useCallback(
    (l: Doc<"certificationLevels">) => {
      if (!certSearchLower) {
        return true;
      }
      const catMeta = l.certificationCategoryId
        ? certCategoryMetaById.get(l.certificationCategoryId)
        : undefined;
      const legacyCat = (l.certificationCategory?.trim() ?? "").toLowerCase();
      const catHay = [
        catMeta?.shortCode ?? "",
        catMeta?.longDescription ?? "",
        legacyCat,
      ]
        .join(" ")
        .toLowerCase();
      return (
        l.name.toLowerCase().includes(certSearchLower) ||
        (l.code?.toLowerCase().includes(certSearchLower) ?? false) ||
        l.description.toLowerCase().includes(certSearchLower) ||
        (l.summary?.toLowerCase().includes(certSearchLower) ?? false) ||
        (l.tagline?.toLowerCase().includes(certSearchLower) ?? false) ||
        (catHay.trim().length > 0 && catHay.includes(certSearchLower))
      );
    },
    [certSearchLower, certCategoryMetaById],
  );

  const levelMatchesCategoryChip = useCallback(
    (l: Doc<"certificationLevels">) => {
      if (certCategoryFilter === "all") {
        return true;
      }
      if ((l.certificationCategoryId ?? "") === certCategoryFilter) {
        return true;
      }
      const meta = certCategoryMetaById.get(
        certCategoryFilter as Id<"certificationCategories">,
      );
      const legacy = l.certificationCategory?.trim() ?? "";
      return Boolean(meta && legacy === meta.shortCode);
    },
    [certCategoryFilter, certCategoryMetaById],
  );

  const levelMatchesTierChip = useCallback(
    (l: Doc<"certificationLevels">) => {
      if (certTierFilter === "all") {
        return true;
      }
      return effectiveCertificationTier(l) === certTierFilter;
    },
    [certTierFilter],
  );

  const unitMatchesSearch = useCallback(
    (u: {
      title: string;
      description: string;
      code?: string;
      certificationSummary?: string;
      unitCategoryId?: Id<"unitCategories">;
      unitCategory?: string;
    }) => {
      if (!unitSearchLower) {
        return true;
      }
      const summary = (u.certificationSummary ?? "").toLowerCase();
      const catMeta = u.unitCategoryId
        ? unitCategoryMetaById.get(u.unitCategoryId)
        : undefined;
      const legacy = (u.unitCategory?.trim() ?? "").toLowerCase();
      const catHay = [
        catMeta?.shortCode ?? "",
        catMeta?.longDescription ?? "",
        legacy,
      ]
        .join(" ")
        .toLowerCase();
      return (
        u.title.toLowerCase().includes(unitSearchLower) ||
        (typeof u.code === "string" &&
          u.code.toLowerCase().includes(unitSearchLower)) ||
        u.description.toLowerCase().includes(unitSearchLower) ||
        summary.includes(unitSearchLower) ||
        (catHay.trim().length > 0 && catHay.includes(unitSearchLower))
      );
    },
    [unitSearchLower, unitCategoryMetaById],
  );

  const unitMatchesCategoryChip = useCallback(
    (u: { unitCategoryId?: Id<"unitCategories">; unitCategory?: string }) => {
      if (unitCategoryFilter === "all") {
        return true;
      }
      if ((u.unitCategoryId ?? "") === unitCategoryFilter) {
        return true;
      }
      const meta = unitCategoryMetaById.get(
        unitCategoryFilter as Id<"unitCategories">,
      );
      const legacy = u.unitCategory?.trim() ?? "";
      return Boolean(meta && legacy === meta.shortCode);
    },
    [unitCategoryFilter, unitCategoryMetaById],
  );

  const contentMatchesLibraryCategoryChip = useCallback(
    (item: Doc<"contentItems">) => {
      if (contentLibraryCategoryFilter === "all") {
        return true;
      }
      if ((item.contentCategoryId ?? "") === contentLibraryCategoryFilter) {
        return true;
      }
      const meta = contentCategoryMetaById.get(
        contentLibraryCategoryFilter as Id<"contentCategories">,
      );
      const legacy = item.contentCategory?.trim() ?? "";
      return Boolean(meta && legacy === meta.shortCode);
    },
    [contentLibraryCategoryFilter, contentCategoryMetaById],
  );

  const contentMatchesSearch = useCallback(
    (item: Doc<"contentItems">) => {
      if (!contentMatchesLibraryCategoryChip(item)) {
        return false;
      }
      if (!contentSearchLower) {
        return true;
      }
      const q = contentSearchLower;
      const displayTitle = libraryContentDisplayTitle(item.title).toLowerCase();
      const urlHaystack =
        item.type !== "test" && item.type !== "assignment"
          ? (item.url ?? "").toLowerCase()
          : "";
      const catMeta = item.contentCategoryId
        ? contentCategoryMetaById.get(item.contentCategoryId)
        : undefined;
      const legacy = (item.contentCategory?.trim() ?? "").toLowerCase();
      const catHay = [
        catMeta?.shortCode ?? "",
        catMeta?.longDescription ?? "",
        legacy,
      ]
        .join(" ")
        .toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        (item.code?.toLowerCase().includes(q) ?? false) ||
        displayTitle.includes(q) ||
        item.type.toLowerCase().includes(q) ||
        (urlHaystack.length > 0 && urlHaystack.includes(q)) ||
        (item.assessment?.description?.toLowerCase().includes(q) ?? false) ||
        (catHay.trim().length > 0 && catHay.includes(q))
      );
    },
    [
      contentSearchLower,
      contentMatchesLibraryCategoryChip,
      contentCategoryMetaById,
    ],
  );

  useEffect(() => {
    setSelectedDetailUnitId(null);
  }, [filterCertId]);

  useEffect(() => {
    if (!filterCertId || !levels?.length || certCategoryFilter === "all") {
      return;
    }
    const level = levels.find((l) => l._id === filterCertId);
    if (!level) {
      return;
    }
    const catId = level.certificationCategoryId ?? "";
    if (catId === certCategoryFilter) {
      return;
    }
    const meta = certCategoryMetaById.get(
      certCategoryFilter as Id<"certificationCategories">,
    );
    const legacy = level.certificationCategory?.trim() ?? "";
    if (meta && legacy === meta.shortCode) {
      return;
    }
    setFilterCertId(null);
  }, [filterCertId, levels, certCategoryFilter, certCategoryMetaById]);

  const detailContent = useQuery(
    api.content.listByUnit,
    selectedDetailUnitId ? { unitId: selectedDetailUnitId } : "skip",
  );

  const displayedLevels = useMemo(() => {
    if (levels === undefined) {
      return undefined;
    }
    if (!optimisticLevelOrder?.length) {
      return levels;
    }
    const byId = new Map(levels.map((l) => [l._id, l]));
    const next = optimisticLevelOrder
      .map((id) => byId.get(id))
      .filter(Boolean) as Doc<"certificationLevels">[];
    return next.length === levels.length ? next : levels;
  }, [levels, optimisticLevelOrder]);

  const displayedUnitsInFilteredCert = useMemo(() => {
    if (unitsInFilteredCert === undefined) {
      return undefined;
    }
    if (!optimisticUnitsInCertOrder?.length) {
      return unitsInFilteredCert;
    }
    const byId = new Map(unitsInFilteredCert.map((u) => [u._id, u]));
    const next = optimisticUnitsInCertOrder
      .map((id) => byId.get(id))
      .filter(Boolean) as Doc<"units">[];
    return next.length === unitsInFilteredCert.length
      ? next
      : unitsInFilteredCert;
  }, [unitsInFilteredCert, optimisticUnitsInCertOrder]);

  const displayedDetailContent = useMemo(() => {
    if (detailContent === undefined) {
      return undefined;
    }
    if (!optimisticDetailContentOrder?.length) {
      return detailContent;
    }
    const byId = new Map(detailContent.map((r) => [r._id, r]));
    const next = optimisticDetailContentOrder
      .map((id) => byId.get(id))
      .filter(Boolean);
    if (next.length !== detailContent.length) {
      return detailContent;
    }
    return next as typeof detailContent;
  }, [detailContent, optimisticDetailContentOrder]);

  useEffect(() => {
    if (!optimisticLevelOrder?.length || levels === undefined) {
      return;
    }
    if (levels.length !== optimisticLevelOrder.length) {
      setOptimisticLevelOrder(null);
      return;
    }
    const match = levels.every(
      (l, i) => l._id === optimisticLevelOrder[i],
    );
    if (match) {
      setOptimisticLevelOrder(null);
    }
  }, [levels, optimisticLevelOrder]);

  useEffect(() => {
    if (!optimisticUnitsInCertOrder?.length || unitsInFilteredCert === undefined) {
      return;
    }
    if (unitsInFilteredCert.length !== optimisticUnitsInCertOrder.length) {
      setOptimisticUnitsInCertOrder(null);
      return;
    }
    const match = unitsInFilteredCert.every(
      (u, i) => u._id === optimisticUnitsInCertOrder[i],
    );
    if (match) {
      setOptimisticUnitsInCertOrder(null);
    }
  }, [unitsInFilteredCert, optimisticUnitsInCertOrder]);

  useEffect(() => {
    if (!optimisticDetailContentOrder?.length || detailContent === undefined) {
      return;
    }
    if (detailContent.length !== optimisticDetailContentOrder.length) {
      setOptimisticDetailContentOrder(null);
      return;
    }
    const match = detailContent.every(
      (r, i) => r._id === optimisticDetailContentOrder[i],
    );
    if (match) {
      setOptimisticDetailContentOrder(null);
    }
  }, [detailContent, optimisticDetailContentOrder]);

  useEffect(() => {
    setOptimisticDetailContentOrder(null);
  }, [selectedDetailUnitId, libraryShowAll]);

  useEffect(() => {
    setOptimisticUnitsInCertOrder(null);
  }, [filterCertId, centreUnitsShowAll]);

  const dragOverlayContent = useMemo((): Doc<"contentItems"> | null => {
    if (!dragOverlayContentId || !allLibraryContent) {
      return null;
    }
    return (
      allLibraryContent.find((c) => c._id === dragOverlayContentId) ??
      (detailContent?.find((c) => c._id === dragOverlayContentId) ?? null)
    );
  }, [dragOverlayContentId, allLibraryContent, detailContent]);

  const pendingAttachContentToUnitLabels = useMemo(() => {
    if (!pendingAttachContentToUnit || !allUnits) {
      return null;
    }
    const c =
      allLibraryContent?.find(
        (x) => x._id === pendingAttachContentToUnit.contentId,
      ) ??
      detailContent?.find(
        (x) => x._id === pendingAttachContentToUnit.contentId,
      );
    const u = allUnits.find((x) => x._id === pendingAttachContentToUnit.unitId);
    return {
      contentTitle: c?.title ?? "Content",
      unitTitle: u?.title ?? "Unit",
    };
  }, [pendingAttachContentToUnit, allLibraryContent, detailContent, allUnits]);

  /** All-content view + unit selected: which library items are already on that unit (for row tint). */
  const contentIdsInSelectedUnitWhenBrowsingLibrary = useMemo(() => {
    if (!selectedDetailUnitId || !libraryShowAll || detailContent === undefined) {
      return null;
    }
    return new Set(detailContent.map((c) => c._id));
  }, [selectedDetailUnitId, libraryShowAll, detailContent]);

  const selectedDetailUnit = useMemo((): UnitAdminListRow | Doc<"units"> | null => {
    if (!selectedDetailUnitId) {
      return null;
    }
    return (
      allUnits?.find((u) => u._id === selectedDetailUnitId) ??
      unitsInFilteredCert?.find((u) => u._id === selectedDetailUnitId) ??
      null
    );
  }, [selectedDetailUnitId, allUnits, unitsInFilteredCert]);

  /**
   * ADMIN.md: unit click filters the right column to this unit’s content.
   * While `allUnits` / `unitsInFilteredCert` are still loading, avoid treating
   * the selection as “cleared” and flashing the full library.
   */
  const unitSelectionResolving = useMemo(() => {
    if (!selectedDetailUnitId || selectedDetailUnit) {
      return false;
    }
    if (libraryShowAll) {
      return false;
    }
    if (allUnits === undefined) {
      return true;
    }
    if (
      filterCertId != null &&
      !centreUnitsShowAll &&
      unitsInFilteredCert === undefined
    ) {
      return true;
    }
    return false;
  }, [
    selectedDetailUnitId,
    selectedDetailUnit,
    libraryShowAll,
    allUnits,
    filterCertId,
    centreUnitsShowAll,
    unitsInFilteredCert,
  ]);

  const selectedCert = useMemo(() => {
    if (!editCertId || !levels) {
      return null;
    }
    return levels.find((l) => l._id === editCertId) ?? null;
  }, [editCertId, levels]);

  const certPendingDelete = useMemo(() => {
    if (!certDeleteId || !levels) {
      return null;
    }
    return levels.find((l) => l._id === certDeleteId) ?? null;
  }, [certDeleteId, levels]);

  const filterCertName = useMemo(() => {
    if (!filterCertId || !levels) {
      return null;
    }
    return levels.find((l) => l._id === filterCertId)?.name ?? null;
  }, [filterCertId, levels]);

  const filterUnitTitle = useMemo(() => {
    if (!selectedDetailUnitId || !selectedDetailUnit) {
      return null;
    }
    return selectedDetailUnit.title;
  }, [selectedDetailUnitId, selectedDetailUnit]);

  useEffect(() => {
    if (!selectedCert) {
      return;
    }
    setCertDetailName(selectedCert.name);
    setCertDetailCode(
      selectedCert.code?.trim() ||
        suggestEntityCodeFromLabel(selectedCert.name),
    );
    setCertDetailCertCategorySelect(
      selectedCert.certificationCategoryId ?? CATEGORY_SELECT_NONE,
    );
    setCertDetailSummary(selectedCert.summary ?? "");
    setCertDetailDesc(selectedCert.description);
    setCertDetailTagline(selectedCert.tagline ?? "");
    setCertDetailThumbnail(selectedCert.thumbnailUrl ?? "");
    setCertDetailCompanyId(selectedCert.companyId ?? "");
    setCertDetailOrder(String(selectedCert.order));
    setCertDetailTier(selectedCert.certificationTier ?? "bronze");
  }, [selectedCert]);

  useEffect(() => {
    if (!levels?.length) {
      setEditCertId(null);
      setFilterCertId(null);
      return;
    }
    setEditCertId((prev) => {
      if (prev && levels.some((l) => l._id === prev)) {
        return prev;
      }
      return null;
    });
    setFilterCertId((prev) => {
      if (prev && levels.some((l) => l._id === prev)) {
        return prev;
      }
      return null;
    });
  }, [levels]);

  const mainSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function openCertificationEditor(id: Id<"certificationLevels">) {
    setEditCertId(id);
    setCertDetailsOpen(true);
  }

  /** ADMIN.md: cert row click toggles centre column unit filter only. */
  function handleCertFilterToggle(id: Id<"certificationLevels">) {
    setFilterCertId((prev) => (prev === id ? null : id));
    setCentreUnitsShowAll(false);
  }

  useEffect(() => {
    if (!filterCertId) {
      setCentreUnitsShowAll(false);
    }
  }, [filterCertId]);

  /** ADMIN.md: unit row click selects unit for library column; click again off. */
  function handleUnitRowClick(unitId: Id<"units">) {
    setPrereqsPanelUnitId(null);
    setSelectedDetailUnitId((prev) => (prev === unitId ? null : unitId));
    setLibraryShowAll(false);
  }

  function togglePrereqsUnderRow(unitId: Id<"units">) {
    setSelectedDetailUnitId(unitId);
    setLibraryShowAll(false);
    setPrereqsPanelUnitId((prev) => (prev === unitId ? null : unitId));
  }

  useEffect(() => {
    if (!selectedDetailUnitId) {
      setLibraryShowAll(false);
    }
  }, [selectedDetailUnitId]);

  function openEditUnit(uid: Id<"units">) {
    const u =
      allUnits?.find((x) => x._id === uid) ??
      unitsInFilteredCert?.find((x) => x._id === uid);
    if (!u) {
      return;
    }
    setEditUnitId(uid);
    setEditUnitTitle(u.title);
    setEditUnitCode(
      u.code?.trim() || suggestEntityCodeFromLabel(u.title),
    );
    setEditUnitDesc(u.description);
    setEditUnitCategorySelect(u.unitCategoryId ?? CATEGORY_SELECT_NONE);
    setEditUnitDeliveryMode(u.deliveryMode ?? "self_paced");
    setEditUnitOpen(true);
  }

  /** Radix Select: if stored id is missing from the list, fall back to None (stale id / deleted category). */
  useEffect(() => {
    if (!certDetailsOpen || certCategories === undefined) {
      return;
    }
    if (
      certDetailCertCategorySelect !== CATEGORY_SELECT_NONE &&
      !certCategories.some((c) => c._id === certDetailCertCategorySelect)
    ) {
      setCertDetailCertCategorySelect(CATEGORY_SELECT_NONE);
    }
  }, [
    certDetailsOpen,
    certCategories,
    certDetailCertCategorySelect,
  ]);

  useEffect(() => {
    if (!editUnitOpen || unitCategories === undefined) {
      return;
    }
    if (
      editUnitCategorySelect !== CATEGORY_SELECT_NONE &&
      !unitCategories.some((c) => c._id === editUnitCategorySelect)
    ) {
      setEditUnitCategorySelect(CATEGORY_SELECT_NONE);
    }
  }, [editUnitOpen, unitCategories, editUnitCategorySelect]);

  useEffect(() => {
    if (!editContentOpen || contentCategories === undefined) {
      return;
    }
    if (
      editContentCategorySelect !== CATEGORY_SELECT_NONE &&
      !contentCategories.some((c) => c._id === editContentCategorySelect)
    ) {
      setEditContentCategorySelect(CATEGORY_SELECT_NONE);
    }
  }, [editContentOpen, contentCategories, editContentCategorySelect]);

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const id = String(e.active.id);
    if (id.startsWith("palette-unit:")) {
      setDragOverlayUnitId(
        id.slice("palette-unit:".length) as Id<"units">,
      );
    } else if (id.startsWith("palette-content:")) {
      setDragOverlayContentId(
        id.slice("palette-content:".length) as Id<"contentItems">,
      );
    }
  }, []);

  const handleDragCancel = useCallback(() => {
    setDragOverlayUnitId(null);
    setDragOverlayContentId(null);
    setDropHighlightLevelId(null);
    setDropHighlightUnitId(null);
  }, []);

  const handleDragOver = useCallback(
    (e: DragOverEvent) => {
      const { active, over } = e;
      if (!over) {
        setDropHighlightLevelId(null);
        setDropHighlightUnitId(null);
        return;
      }
      const activeStr = String(active.id);
      const overStr = String(over.id);
      if (activeStr.startsWith("palette-unit:")) {
        setDropHighlightLevelId(
          resolveCertificationIdForPaletteUnitDrop(overStr, levels),
        );
        setDropHighlightUnitId(null);
        return;
      }
      if (activeStr.startsWith("palette-content:")) {
        if (selectedDetailUnitId && !libraryShowAll) {
          setDropHighlightUnitId(null);
        } else {
          setDropHighlightUnitId(
            resolveUnitIdForPaletteContentDrop(overStr, {
              allUnits,
              unitsInFilteredCert,
              filterCertId,
              centreUnitsShowAll,
            }),
          );
        }
        setDropHighlightLevelId(null);
        return;
      }
      setDropHighlightLevelId(null);
      setDropHighlightUnitId(null);
    },
    [
      levels,
      allUnits,
      unitsInFilteredCert,
      filterCertId,
      centreUnitsShowAll,
      selectedDetailUnitId,
      libraryShowAll,
    ],
  );

  const onUnifiedDragEnd = useCallback(
    async (e: DragEndEvent) => {
      const { active, over } = e;
      setDragOverlayUnitId(null);
      setDragOverlayContentId(null);
      setDropHighlightLevelId(null);
      setDropHighlightUnitId(null);

      if (!over) {
        return;
      }
      const activeStr = String(active.id);
      const overStr = String(over.id);

      if (activeStr.startsWith("palette-content:")) {
        const cid = activeStr.slice("palette-content:".length) as Id<
          "contentItems"
        >;
        if (selectedDetailUnitId && !libraryShowAll) {
          return;
        }
        const uid = resolveUnitIdForPaletteContentDrop(overStr, {
          allUnits,
          unitsInFilteredCert,
          filterCertId,
          centreUnitsShowAll,
        });
        if (uid) {
          setPendingAttachContentToUnit({ contentId: cid, unitId: uid });
        }
        return;
      }

      if (activeStr.startsWith("palette-unit:")) {
        const uid = activeStr.slice("palette-unit:".length) as Id<"units">;
        const lid = resolveCertificationIdForPaletteUnitDrop(
          overStr,
          levels ?? undefined,
        );
        if (lid) {
          setPendingAddUnitToCert({ unitId: uid, levelId: lid });
        }
        return;
      }

      if (
        selectedDetailUnitId &&
        !libraryShowAll &&
        contentLibraryCategoryFilter === "all" &&
        !contentSearchLower &&
        displayedDetailContent &&
        displayedDetailContent.length >= 2
      ) {
        const inList = (id: string) =>
          displayedDetailContent.some((i) => i._id === id);
        if (
          inList(activeStr) &&
          inList(overStr) &&
          !activeStr.startsWith("palette-")
        ) {
          const oldIndex = displayedDetailContent.findIndex(
            (i) => i._id === activeStr,
          );
          const newIndex = displayedDetailContent.findIndex(
            (i) => i._id === overStr,
          );
          if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
            const ordered = arrayMove(
              displayedDetailContent,
              oldIndex,
              newIndex,
            );
            setOptimisticDetailContentOrder(ordered.map((row) => row._id));
            try {
              await reorderContentOnUnit({
                unitId: selectedDetailUnitId,
                orderedContentIds: ordered.map((row) => row._id),
              });
              toast.success("Lessons reordered");
            } catch (err) {
              setOptimisticDetailContentOrder(null);
              toast.error(err instanceof Error ? err.message : "Reorder failed");
            }
          }
          return;
        }
      }

      if (
        displayedLevels &&
        !certSearchLower &&
        certCategoryFilter === "all"
      ) {
        const activeLevelKey = resolveLevelSortCollisionId(String(active.id));
        const overLevelKey = resolveLevelSortCollisionId(overStr);
        const oldIndex = displayedLevels.findIndex(
          (l) => l._id === activeLevelKey,
        );
        const newIndex = displayedLevels.findIndex(
          (l) => l._id === overLevelKey,
        );
        if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
          const ordered = arrayMove(displayedLevels, oldIndex, newIndex).map(
            (l) => l._id,
          );
          setOptimisticLevelOrder(ordered);
          try {
            await reorderLevels({ orderedIds: ordered });
            toast.success("Order updated");
          } catch (err) {
            setOptimisticLevelOrder(null);
            toast.error(err instanceof Error ? err.message : "Reorder failed");
          }
          return;
        }
      }

      if (
        filterCertId &&
        !centreUnitsShowAll &&
        !unitSearchLower &&
        unitCategoryFilter === "all" &&
        displayedUnitsInFilteredCert &&
        displayedUnitsInFilteredCert.length
      ) {
        if (active.id === over.id) {
          return;
        }
        const activeUnitKey = resolveUnitSortCollisionId(String(active.id));
        const overUnitKey = resolveUnitSortCollisionId(overStr);
        const oldIndex = displayedUnitsInFilteredCert.findIndex(
          (u) => u._id === activeUnitKey,
        );
        const newIndex = displayedUnitsInFilteredCert.findIndex(
          (u) => u._id === overUnitKey,
        );
        if (oldIndex < 0 || newIndex < 0) {
          return;
        }
        const ordered = arrayMove(
          displayedUnitsInFilteredCert,
          oldIndex,
          newIndex,
        ).map((u) => u._id);
        setOptimisticUnitsInCertOrder(ordered);
        try {
          await reorderUnitsInLevel({
            levelId: filterCertId,
            orderedUnitIds: ordered,
          });
          toast.success("Units reordered");
        } catch (err) {
          setOptimisticUnitsInCertOrder(null);
          toast.error(err instanceof Error ? err.message : "Reorder failed");
        }
      }
    },
    [
      displayedLevels,
      displayedUnitsInFilteredCert,
      displayedDetailContent,
      certSearchLower,
      certCategoryFilter,
      unitSearchLower,
      unitCategoryFilter,
      filterCertId,
      centreUnitsShowAll,
      reorderLevels,
      reorderUnitsInLevel,
      selectedDetailUnitId,
      libraryShowAll,
      reorderContentOnUnit,
      contentLibraryCategoryFilter,
      contentSearchLower,
    ],
  );

  function addEditContentQuestion() {
    setEditContentAssessment((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        questions: [
          ...prev.questions,
          {
            id: crypto.randomUUID(),
            question: "",
            type: "multiple_choice",
            options: ["", ""],
            correctAnswer: "",
          },
        ],
      };
    });
  }

  function updateEditContentQuestion(
    i: number,
    patch: Partial<EditAssessmentQuestion>,
  ) {
    setEditContentAssessment((prev) => {
      if (!prev) {
        return prev;
      }
      const questions = [...prev.questions];
      questions[i] = { ...questions[i], ...patch };
      return { ...prev, questions };
    });
  }

  function removeEditContentQuestion(i: number) {
    setEditContentAssessment((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        questions: prev.questions.filter((_, j) => j !== i),
      };
    });
  }

  function addAddLibraryQuestion() {
    setAddLibraryAssessment((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        questions: [
          ...prev.questions,
          {
            id: crypto.randomUUID(),
            question: "",
            type: "multiple_choice",
            options: ["", ""],
            correctAnswer: "",
          },
        ],
      };
    });
  }

  function updateAddLibraryQuestion(
    i: number,
    patch: Partial<EditAssessmentQuestion>,
  ) {
    setAddLibraryAssessment((prev) => {
      if (!prev) {
        return prev;
      }
      const questions = [...prev.questions];
      questions[i] = { ...questions[i], ...patch };
      return { ...prev, questions };
    });
  }

  function removeAddLibraryQuestion(i: number) {
    setAddLibraryAssessment((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        questions: prev.questions.filter((_, j) => j !== i),
      };
    });
  }

  const cyanPlusBtn =
    "rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-cyan-600 dark:hover:bg-cyan-500";

  const levelsListForUi = displayedLevels ?? levels ?? [];

  useEffect(() => {
    if (certCategoryFilter === "all" || certCategories === undefined) {
      return;
    }
    if (!certCategories.some((c) => c._id === certCategoryFilter)) {
      setCertCategoryFilter("all");
    }
  }, [certCategoryFilter, certCategories]);

  useEffect(() => {
    if (unitCategoryFilter === "all" || unitCategories === undefined) {
      return;
    }
    if (!unitCategories.some((c) => c._id === unitCategoryFilter)) {
      setUnitCategoryFilter("all");
    }
  }, [unitCategoryFilter, unitCategories]);

  useEffect(() => {
    if (
      contentLibraryCategoryFilter === "all" ||
      contentCategories === undefined
    ) {
      return;
    }
    if (
      !contentCategories.some((c) => c._id === contentLibraryCategoryFilter)
    ) {
      setContentLibraryCategoryFilter("all");
    }
  }, [contentLibraryCategoryFilter, contentCategories]);

  const unitsInCertListForUi =
    displayedUnitsInFilteredCert ?? unitsInFilteredCert;
  const detailContentListForUi =
    displayedDetailContent ?? detailContent;

  const certFilterActive =
    certSearchLower.length > 0 ||
    certCategoryFilter !== "all" ||
    certTierFilter !== "all";
  const unitFilterActive =
    unitSearchLower.length > 0 || unitCategoryFilter !== "all";

  const levelsVisibleForUi = useMemo(
    () =>
      levelsListForUi.filter(
        (l) =>
          levelMatchesSearch(l) &&
          levelMatchesCategoryChip(l) &&
          levelMatchesTierChip(l),
      ),
    [
      levelsListForUi,
      levelMatchesSearch,
      levelMatchesCategoryChip,
      levelMatchesTierChip,
    ],
  );

  const unitsInCertVisibleForUi = useMemo(() => {
    if (!unitsInCertListForUi) {
      return [];
    }
    return unitsInCertListForUi.filter(
      (u) => unitMatchesSearch(u) && unitMatchesCategoryChip(u),
    );
  }, [unitsInCertListForUi, unitMatchesSearch, unitMatchesCategoryChip]);

  const allUnitsVisibleForUi = useMemo(() => {
    if (!allUnits?.length) {
      return [];
    }
    return allUnits.filter(
      (u) => unitMatchesSearch(u) && unitMatchesCategoryChip(u),
    );
  }, [allUnits, unitMatchesSearch, unitMatchesCategoryChip]);

  /** When set, unit content list is filtered — reorder would be ambiguous, so drag is disabled. */
  const contentFilterActive =
    contentLibraryCategoryFilter !== "all" || contentSearchLower.length > 0;

  const filteredLibraryContent = useMemo(() => {
    if (allLibraryContent === undefined) {
      return undefined;
    }
    return allLibraryContent.filter((item) => contentMatchesSearch(item));
  }, [allLibraryContent, contentMatchesSearch]);

  const filteredDetailContentForUi = useMemo(() => {
    if (!detailContentListForUi?.length) {
      return [];
    }
    return detailContentListForUi.filter((item) => contentMatchesSearch(item));
  }, [detailContentListForUi, contentMatchesSearch]);

  const unitContentSortableList = contentFilterActive
    ? filteredDetailContentForUi
    : (detailContentListForUi ?? []);

  const certListCount = certFilterActive
    ? levelsVisibleForUi.length
    : levelsListForUi.length;
  const unitsListCount: number | null =
    filterCertId && !centreUnitsShowAll
      ? unitsInCertListForUi === undefined
        ? null
        : unitFilterActive
          ? unitsInCertVisibleForUi.length
          : unitsInCertListForUi.length
      : allUnits === undefined
        ? null
        : unitFilterActive
          ? allUnitsVisibleForUi.length
          : allUnits.length;
  const contentListCount: number | null =
    selectedDetailUnitId && selectedDetailUnit && !libraryShowAll
      ? detailContent === undefined
        ? null
        : unitContentSortableList.length
      : allLibraryContent === undefined
        ? null
        : (filteredLibraryContent?.length ?? 0);

  return (
    <TooltipProvider delayDuration={400}>
      <div className="min-h-0 space-y-4">
      <div className="pb-2">
        <p className="text-base leading-snug text-muted-foreground">
          Assemble Units and Content into structured Certification courses.
        </p>
        <p
          className={cn(
            "mx-auto mt-3 flex w-full max-w-3xl flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-md border px-2.5 py-1 text-center text-sm leading-none",
            "border-[oklch(0.58_0.11_232/0.88)] text-[oklch(0.44_0.095_232)]",
            "dark:border-[oklch(0.55_0.095_232/0.65)] dark:text-[oklch(0.82_0.065_232)]",
          )}
        >
          <GripHorizontal
            className="h-3 w-3 shrink-0 text-current opacity-90"
            aria-hidden
          />
          <span>drag up or down to reorder</span>
          <span className="text-current opacity-45">·</span>
          <GripVertical
            className="h-3 w-3 shrink-0 text-current opacity-90"
            aria-hidden
          />
          <span>drag left to attach units and content</span>
        </p>
      </div>

      <DndContext
        sensors={mainSensors}
        collisionDetection={coursesDndCollision}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragCancel={handleDragCancel}
        onDragEnd={(e) => void onUnifiedDragEnd(e)}
      >
        {/* Layout matches GritHub app/(dashboard)/dashboard/admin/company-maintenance/page.tsx */}
        <div className="grid min-h-0 grid-cols-1 gap-2 md:h-[min(calc((100dvh-14rem)*1.5),1200px)] md:grid-cols-[repeat(3,minmax(0,1fr))]">
          <div className="flex min-h-0 min-w-0 flex-col rounded-2xl border border-brand-lime/40 border-l-4 border-r-4 border-l-brand-lime border-r-brand-lime bg-brand-lime/[0.11] px-4 pb-4 pt-0 shadow-lg dark:border-brand-lime/35 dark:border-l-brand-lime dark:border-r-brand-lime dark:bg-brand-lime/[0.14]">
            <TrainingColumnChip
              tone="lime"
              count={certListCount}
              trailing={
                <>
                  <GraduationCap
                    className="h-4 w-4 shrink-0 text-brand-lime"
                    aria-hidden
                  />
                  <span className="min-w-0 truncate">Certifications</span>
                </>
              }
            />
            <h2 className="sr-only">Certifications</h2>
            <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
              <div className="relative w-[min(100%,13rem)] shrink-0">
                <Input
                  id="admin-cert-search"
                  aria-label="Filter certifications"
                  placeholder="Filter..."
                  value={certSearch}
                  onChange={(e) => setCertSearch(e.target.value)}
                  className={cn(
                    "h-9 w-full bg-card",
                    certSearch.trim() ? "pr-9" : "",
                  )}
                />
                {certSearch.trim() ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0.5 top-1/2 h-7 w-7 -translate-y-1/2 shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label="Clear certification filter"
                    onClick={() => setCertSearch("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              <Button
                type="button"
                size="icon-lg"
                className={cn(cyanPlusBtn, "shrink-0")}
                aria-label="Add certification"
                onClick={() => setAddCertOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <AdminCategoryFilterSelect
              htmlId="admin-cert-category-filter"
              label="Certification category"
              value={certCategoryFilter}
              onValueChange={setCertCategoryFilter}
              categories={certCategories}
            />
            <hr className="my-2 h-0 shrink-0 border-0 border-t-2 border-solid border-brand-lime/50 dark:border-brand-lime/40" />
            <div className="mb-3 shrink-0 space-y-2">
              <div
                className="flex flex-wrap items-center gap-1.5"
                role="group"
                aria-label="Filter certifications by tier"
              >
                <Button
                  type="button"
                  size="sm"
                  variant={
                    certTierFilter === "all" ? "secondary" : "outline"
                  }
                  className="h-8 min-w-8 shrink-0 px-2 text-xs font-semibold"
                  onClick={() => setCertTierFilter("all")}
                  aria-label="All tiers"
                  title="Show all certification tiers"
                >
                  All
                </Button>
                {(["bronze", "silver", "gold"] as const).map((tier) => (
                  <Button
                    key={tier}
                    type="button"
                    size="icon"
                    variant={
                      certTierFilter === tier ? "secondary" : "outline"
                    }
                    className="shrink-0"
                    onClick={() => setCertTierFilter(tier)}
                    aria-label={certificationTierLabel(tier)}
                    title={certificationTierSectionTitle(tier)}
                  >
                    <CertificationTierMedallion tier={tier} className="size-6" />
                  </Button>
                ))}
              </div>
              {filterCertId ? (
                <p className="text-sm text-muted-foreground">
                  Use{" "}
                  <span className="font-medium text-foreground">
                    Show all units
                  </span>{" "}
                  in the centre column to drag here.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Drag units from the centre column onto a certification below.
                </p>
              )}
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto scrollbar-panel">
              {levelsListForUi.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No certifications. Use +.
                </p>
              ) : levelsVisibleForUi.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No certifications match the current filters.
                </p>
              ) : (
                <SortableContext
                  items={levelsVisibleForUi.map((l) => l._id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="space-y-1">
                    {levelsVisibleForUi.map((l) => (
                      <li key={l._id}>
                        <LevelRowDroppable
                          levelId={l._id}
                          dropHighlight={dropHighlightLevelId === l._id}
                        >
                          <SortableLevelRow
                            level={l}
                            selected={filterCertId === l._id}
                            disableDrag={certFilterActive}
                            unitCount={
                              allUnits === undefined
                                ? undefined
                                : (unitCountByLevelId.get(l._id) ?? 0)
                            }
                            onSelect={() => handleCertFilterToggle(l._id)}
                            onEdit={() => openCertificationEditor(l._id)}
                            onDelete={() => {
                              setCertDeleteId(l._id);
                              setCertDeleteOpen(true);
                            }}
                          />
                        </LevelRowDroppable>
                      </li>
                    ))}
                  </ul>
                </SortableContext>
              )}
            </div>
          </div>

          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-col rounded-2xl border border-l-4 border-r-4 bg-brand-gold/[0.14] px-4 pb-4 pt-0 shadow-lg dark:bg-brand-gold/[0.12]",
              filterCertId
                ? "border-brand-lime/40 border-l-brand-lime border-r-brand-lime dark:border-brand-lime/35 dark:border-l-brand-lime dark:border-r-brand-lime"
                : "border-brand-gold/40 border-l-brand-gold border-r-brand-gold dark:border-brand-gold/35 dark:border-l-brand-gold dark:border-r-brand-gold",
            )}
          >
            <TrainingColumnChip
              tone="gold"
              count={unitsListCount}
              trailing={
                <>
                  <Layers
                    className={cn(
                      "h-4 w-4 shrink-0",
                      filterCertId ? "text-brand-lime" : "text-brand-gold",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 truncate">
                    {filterCertId && !centreUnitsShowAll
                      ? (filterCertName ?? "…")
                      : "All units"}
                  </span>
                </>
              }
            />
            <h2 className="sr-only">Units</h2>
            <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
              <div className="relative w-[min(100%,13rem)] shrink-0">
                <Input
                  id="admin-unit-search"
                  aria-label="Filter units"
                  placeholder="Filter..."
                  value={unitSearch}
                  onChange={(e) => setUnitSearch(e.target.value)}
                  className={cn(
                    "h-9 w-full bg-card",
                    unitSearch.trim() ? "pr-9" : "",
                  )}
                />
                {unitSearch.trim() ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0.5 top-1/2 h-7 w-7 -translate-y-1/2 shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label="Clear unit filter"
                    onClick={() => setUnitSearch("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              <Button
                type="button"
                size="icon-lg"
                className={cn(cyanPlusBtn, "shrink-0")}
                aria-label="Add unit"
                onClick={() => setAddUnitOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <AdminCategoryFilterSelect
              htmlId="admin-unit-category-filter"
              label="Unit category"
              value={unitCategoryFilter}
              onValueChange={setUnitCategoryFilter}
              categories={unitCategories}
            />
            <hr className="my-2 h-0 shrink-0 border-0 border-t-2 border-solid border-brand-gold/50 dark:border-brand-gold/40" />
            {filterCertId && filterCertName ? (
              <button
                type="button"
                className={cn(
                  "mb-2 inline-flex max-w-full items-center rounded-full border-2 px-3 py-1.5 text-left text-xs font-medium text-foreground shadow-sm transition-colors",
                  "border-brand-gold/50 bg-brand-gold/[0.14] hover:border-brand-gold/70 hover:bg-brand-gold/[0.22]",
                  "dark:border-brand-gold/45 dark:bg-brand-gold/[0.12] dark:hover:bg-brand-gold/[0.18]",
                )}
                onClick={() => setCentreUnitsShowAll((v) => !v)}
              >
                {centreUnitsShowAll
                  ? `Show ${filterCertName} units`
                  : "Show all units"}
              </button>
            ) : null}
            {filterCertId && !centreUnitsShowAll ? (
              <p className="mb-3 shrink-0 text-sm text-muted-foreground">
                Show all units to drag and drop onto a Certification.
              </p>
            ) : (
              <p className="mb-3 shrink-0 text-sm text-muted-foreground">
                Drag and drop Content onto a Unit.
              </p>
            )}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto scrollbar-panel">
                {/*
                  ADMIN.md: cert click filters centre to that cert’s units.
                  While Convex loads, unitsInFilteredCert is undefined — must not
                  fall through to “all units” or filtering looks broken.
                */}
                {filterCertId && !centreUnitsShowAll ? (
                  unitsInFilteredCert === undefined ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Loading units…
                    </p>
                  ) : unitsInCertListForUi!.length > 0 &&
                    unitsInCertVisibleForUi.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      {unitSearch.trim() ? (
                        <>
                          No units match &ldquo;{unitSearch.trim()}&rdquo;.
                        </>
                      ) : (
                        <>No units in this category.</>
                      )}
                    </p>
                  ) : (
                    <SortableContext
                      items={unitsInCertVisibleForUi.map((u) => u._id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <ul className="space-y-1">
                        {unitsInCertVisibleForUi.map((u) => (
                          <li key={u._id} className="space-y-0">
                            <UnitRowContentDropTarget
                              unitId={u._id}
                              disabled={
                                Boolean(selectedDetailUnitId) && !libraryShowAll
                              }
                              dropHighlight={dropHighlightUnitId === u._id}
                            >
                              <SortableUnitRow
                                unit={u}
                                selected={selectedDetailUnitId === u._id}
                                expandDrawerOpen={prereqsPanelUnitId === u._id}
                                disableDrag={unitFilterActive}
                                unitCategoryShortCode={
                                  u.unitCategoryId
                                    ? unitCategoryMetaById.get(u.unitCategoryId)
                                        ?.shortCode
                                    : u.unitCategory?.trim() || undefined
                                }
                                prerequisiteCount={
                                  countsByUnitId.get(u._id)?.prereqCount ?? 0
                                }
                                assignmentCount={
                                  countsByUnitId.get(u._id)?.assignmentCount ??
                                  0
                                }
                                prereqsDrawerOpen={prereqsPanelUnitId === u._id}
                                onSelect={() => handleUnitRowClick(u._id)}
                                onEdit={() => openEditUnit(u._id)}
                                onRemoveFromCert={() => {
                                  setDetachFromCertUnitId(u._id);
                                  setDetachFromCertOpen(true);
                                }}
                                onOpenPrerequisites={() =>
                                  togglePrereqsUnderRow(u._id)
                                }
                              />
                            </UnitRowContentDropTarget>
                            {prereqsPanelUnitId === u._id ? (
                              <div className="max-h-[min(70vh,560px)] overflow-y-auto rounded-b-lg border border-t-0 border-border bg-card/90 p-3 shadow-inner">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Prerequisites
                                  </p>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => setPrereqsPanelUnitId(null)}
                                  >
                                    Close
                                  </Button>
                                </div>
                                <PrerequisiteDropEditor
                                  targetUnitId={u._id}
                                  targetTitle={u.title}
                                  allUnits={allUnits}
                                />
                              </div>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </SortableContext>
                  )
                ) : !allUnits?.length ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No units. Use +.
                  </p>
                ) : allUnitsVisibleForUi.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    {unitSearch.trim() ? (
                      <>
                        No units match &ldquo;{unitSearch.trim()}&rdquo;.
                      </>
                    ) : (
                      <>No units in this category.</>
                    )}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {allUnitsVisibleForUi.map((u) => (
                      <li key={u._id} className="space-y-0">
                        <UnitRowContentDropTarget
                          unitId={u._id}
                          disabled={
                            Boolean(selectedDetailUnitId) && !libraryShowAll
                          }
                          dropHighlight={dropHighlightUnitId === u._id}
                        >
                          <DraggableUnitPaletteItem
                            unit={u}
                            selected={selectedDetailUnitId === u._id}
                            inSelectedCert={
                              unitIdsInSelectedCertWhenBrowsingAll?.has(u._id) ??
                              false
                            }
                            expandDrawerOpen={prereqsPanelUnitId === u._id}
                            unitCategoryShortCode={
                              u.unitCategoryId
                                ? unitCategoryMetaById.get(u.unitCategoryId)
                                    ?.shortCode
                                : u.unitCategory?.trim() || undefined
                            }
                            prerequisiteCount={
                              countsByUnitId.get(u._id)?.prereqCount ?? 0
                            }
                            assignmentCount={
                              countsByUnitId.get(u._id)?.assignmentCount ?? 0
                            }
                            prereqsDrawerOpen={prereqsPanelUnitId === u._id}
                            onSelect={() => handleUnitRowClick(u._id)}
                            onEdit={() => openEditUnit(u._id)}
                            deleteVariant={
                              filterCertId &&
                              u.certificationLevelIds.includes(filterCertId)
                                ? "unlink"
                                : "trash"
                            }
                            deleteTooltip={
                              filterCertId &&
                              u.certificationLevelIds.includes(filterCertId)
                                ? "Remove from the selected certification only — unit stays in the library"
                                : "Delete unit permanently from the system"
                            }
                            onDelete={() => {
                              if (
                                filterCertId &&
                                u.certificationLevelIds.includes(
                                  filterCertId,
                                )
                              ) {
                                setDetachFromCertUnitId(u._id);
                                setDetachFromCertOpen(true);
                                return;
                              }
                              setUnitDeleteId(u._id);
                              setUnitDeleteOpen(true);
                            }}
                            onOpenPrerequisites={() =>
                              togglePrereqsUnderRow(u._id)
                            }
                          />
                        </UnitRowContentDropTarget>
                        {prereqsPanelUnitId === u._id ? (
                          <div className="max-h-[min(70vh,560px)] overflow-y-auto rounded-b-lg border border-t-0 border-border bg-card/90 p-3 shadow-inner">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Prerequisites
                              </p>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setPrereqsPanelUnitId(null)}
                              >
                                Close
                              </Button>
                            </div>
                            <PrerequisiteDropEditor
                              targetUnitId={u._id}
                              targetTitle={u.title}
                              allUnits={allUnits}
                            />
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
            </div>
          </div>

          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-col rounded-2xl border border-l-4 border-r-4 bg-brand-sky/[0.10] px-4 pb-4 pt-0 shadow-lg dark:bg-brand-sky/[0.12]",
              selectedDetailUnitId
                ? "border-brand-gold/40 border-l-brand-gold border-r-brand-gold dark:border-brand-gold/35 dark:border-l-brand-gold dark:border-r-brand-gold"
                : "border-brand-sky/40 border-l-brand-sky border-r-brand-sky dark:border-brand-sky/35 dark:border-l-brand-sky dark:border-r-brand-sky",
            )}
          >
            <TrainingColumnChip
              tone="sky"
              count={contentListCount}
              trailing={
                <>
                  <BookMarked
                    className={cn(
                      "h-4 w-4 shrink-0",
                      selectedDetailUnitId
                        ? "text-brand-gold"
                        : "text-brand-sky",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 truncate">
                    {selectedDetailUnitId &&
                    selectedDetailUnit &&
                    !libraryShowAll
                      ? (filterUnitTitle ?? selectedDetailUnit.title)
                      : "All content"}
                  </span>
                </>
              }
            />
            <h2 className="sr-only">Content</h2>
            <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
              <div className="relative w-[min(100%,13rem)] shrink-0">
                <Input
                  id="admin-content-search"
                  aria-label="Filter content"
                  placeholder="Filter..."
                  value={contentSearch}
                  onChange={(e) => setContentSearch(e.target.value)}
                  className={cn(
                    "h-9 w-full bg-card",
                    contentSearch.trim() ? "pr-9" : "",
                  )}
                />
                {contentSearch.trim() ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0.5 top-1/2 h-7 w-7 -translate-y-1/2 shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label="Clear content filter"
                    onClick={() => setContentSearch("")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              <Button
                type="button"
                size="icon-lg"
                className={cn(cyanPlusBtn, "shrink-0")}
                aria-label="Add content to library"
                onClick={() => setAddLibraryOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <AdminCategoryFilterSelect
              htmlId="admin-content-category-filter"
              label="Content category"
              value={contentLibraryCategoryFilter}
              onValueChange={setContentLibraryCategoryFilter}
              categories={contentCategories}
            />
            <hr className="my-2 h-0 shrink-0 border-0 border-t-2 border-solid border-brand-sky/50 dark:border-brand-sky/40" />
            {selectedDetailUnitId && filterUnitTitle ? (
              <button
                type="button"
                className={cn(
                  "mb-2 inline-flex max-w-full items-center rounded-full border-2 px-3 py-1.5 text-left text-xs font-medium text-foreground shadow-sm transition-colors",
                  "border-brand-sky/50 bg-brand-sky/[0.12] hover:border-brand-sky/70 hover:bg-brand-sky/[0.18]",
                  "dark:border-brand-sky/45 dark:bg-brand-sky/[0.10] dark:hover:bg-brand-sky/[0.16]",
                )}
                onClick={() => setLibraryShowAll((v) => !v)}
              >
                {libraryShowAll
                  ? `Show ${filterUnitTitle} content`
                  : "Show all content"}
              </button>
            ) : null}
            {selectedDetailUnitId && !libraryShowAll ? (
              <p className="mb-3 shrink-0 text-sm text-muted-foreground">
                Show all content to drag and drop onto a Unit.
              </p>
            ) : (
              <p className="mb-3 shrink-0 text-sm text-muted-foreground">
                Drag Content onto a Unit to attach it.
              </p>
            )}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto scrollbar-panel">
              {selectedDetailUnitId && unitSelectionResolving ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Loading…
                </p>
              ) : selectedDetailUnitId &&
                selectedDetailUnit &&
                !libraryShowAll ? (
                <div className="space-y-6 pb-4 pr-1">
                    {detailContent === undefined ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        Loading lessons…
                      </p>
                    ) : detailContent.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 border rounded-md text-center">
                        No lessons attached. Use + to add content (attached to
                        this unit when it is selected), or{" "}
                        <span className="font-medium text-foreground">
                          Show all content
                        </span>{" "}
                        to drag from the library.
                      </p>
                    ) : contentFilterActive &&
                      filteredDetailContentForUi.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-6 border rounded-md text-center">
                        No content matches the current category or search (
                        {detailContent.length} on this unit).
                      </p>
                    ) : (
                      <SortableContext
                        items={unitContentSortableList.map((i) => i._id)}
                        strategy={verticalListSortingStrategy}
                      >
                      <ul className="space-y-1">
                        {unitContentSortableList.map((item) => (
                          <li
                            key={item.unitContentId ?? `legacy-${item._id}`}
                          >
                            <SortableUnitContentRow
                              item={item}
                              disableDrag={contentFilterActive}
                              contentCategoryShortCode={
                                item.contentCategoryId
                                  ? contentCategoryMetaById.get(
                                      item.contentCategoryId,
                                    )?.shortCode
                                  : item.contentCategory?.trim() || undefined
                              }
                              selected={
                                Boolean(editContentOpen) &&
                                editContentId === item._id
                              }
                              onEdit={() => {
                                setEditContentId(item._id);
                                setEditUnitContentLinkId(item.unitContentId);
                                setEditContentTitle(item.title);
                                setEditContentCode(
                                  item.code?.trim() ||
                                    suggestEntityCodeFromLabel(item.title),
                                );
                                setEditContentUrl(
                                  item.type === "test" ||
                                    item.type === "assignment"
                                    ? item.assessment?.description ?? ""
                                    : item.url,
                                );
                                setEditContentKind(item.type);
                                setEditContentOrder(String(item.order));
                                setEditContentStorageId(
                                  item.storageId ?? null,
                                );
                                setEditContentAssessment(
                                  item.type === "test" ||
                                    item.type === "assignment"
                                    ? item.assessment ?? null
                                    : null,
                                );
                                setEditContentCategorySelect(
                                  item.contentCategoryId ?? CATEGORY_SELECT_NONE,
                                );
                                setEditWorkshopSessionId(
                                  item.workshopSessionId ?? "",
                                );
                                setEditContentOpen(true);
                              }}
                              onDelete={() => {
                                if (!selectedDetailUnitId) {
                                  return;
                                }
                                setContentDeleteTarget({
                                  kind: "detachFromUnit",
                                  contentId: item._id,
                                  unitContentId: item.unitContentId,
                                  unitId: selectedDetailUnitId,
                                  displayTitle: libraryContentDisplayTitle(
                                    item.title,
                                  ),
                                  unitLabel:
                                    filterUnitTitle?.trim() ||
                                    selectedDetailUnit?.title?.trim() ||
                                    "this unit",
                                });
                              }}
                            />
                          </li>
                        ))}
                      </ul>
                      </SortableContext>
                    )}
                  </div>
              ) : (
                <>
                  {allLibraryContent === undefined ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      Loading library…
                    </p>
                  ) : !allLibraryContent.length ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      No library items. Use +.
                    </p>
                  ) : !filteredLibraryContent?.length ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      No content matches the current category or search (
                      {allLibraryContent.length} in library).
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {filteredLibraryContent.map((item) => (
                        <li key={item._id}>
                          <ContentLibraryDragRow
                            item={item}
                            contentCategoryShortCode={
                              item.contentCategoryId
                                ? contentCategoryMetaById.get(
                                    item.contentCategoryId,
                                  )?.shortCode
                                : item.contentCategory?.trim() || undefined
                            }
                            selected={
                              Boolean(editContentOpen) &&
                              editContentId === item._id
                            }
                            inSelectedUnit={
                              contentIdsInSelectedUnitWhenBrowsingLibrary?.has(
                                item._id,
                              ) ?? false
                            }
                            onEdit={() => {
                              setEditContentId(item._id);
                              setEditUnitContentLinkId(null);
                              setEditContentTitle(item.title);
                              setEditContentCode(
                                item.code?.trim() ||
                                  suggestEntityCodeFromLabel(item.title),
                              );
                              setEditContentUrl(
                                item.type === "test" ||
                                  item.type === "assignment"
                                  ? item.assessment?.description ?? ""
                                  : item.url,
                              );
                              setEditContentKind(item.type);
                              setEditContentOrder(String(item.order ?? 0));
                              setEditContentStorageId(
                                item.storageId ?? null,
                              );
                              setEditContentAssessment(
                                item.type === "test" ||
                                  item.type === "assignment"
                                  ? item.assessment ?? null
                                  : null,
                              );
                              setEditContentCategorySelect(
                                item.contentCategoryId ?? CATEGORY_SELECT_NONE,
                              );
                              setEditWorkshopSessionId(
                                item.workshopSessionId ?? "",
                              );
                              setEditContentOpen(true);
                            }}
                            onDelete={() => {
                              setContentDeleteTarget({
                                kind: "library",
                                contentId: item._id,
                                displayTitle: libraryContentDisplayTitle(
                                  item.title,
                                ),
                              });
                            }}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {dragOverlayUnit ? (
            <div className="pointer-events-none flex min-w-[220px] max-w-sm cursor-grabbing items-stretch overflow-hidden rounded-lg border border-border bg-card text-sm shadow-xl">
              <span className="flex shrink-0 items-center self-stretch border-r border-border bg-muted/40 px-2 text-muted-foreground">
                <GripVertical className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 px-2 py-2">
                <span className="block truncate font-medium">
                  {dragOverlayUnit.title}
                </span>
              </div>
            </div>
          ) : dragOverlayContent ? (
            <div className="pointer-events-none flex min-w-[220px] max-w-sm cursor-grabbing items-stretch overflow-hidden rounded-lg border border-border bg-card text-sm shadow-xl">
              <span className="flex shrink-0 items-center self-stretch border-r border-border bg-muted/40 px-2 text-muted-foreground">
                <GripVertical className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 px-2 py-2">
                <span className="block truncate font-medium">
                  {dragOverlayContent.title}
                </span>
                <span className="mt-0.5 block truncate text-xs capitalize text-muted-foreground">
                  {dragOverlayContent.type}
                </span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <AdminCategoryCrudSection />

      <Dialog
        open={pendingAddUnitToCert !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAddUnitToCert(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add unit to certification?</DialogTitle>
            <DialogDescription>
              {pendingAddUnitToCertLabels ? (
                <>
                  Add{" "}
                  <span className="font-medium text-foreground">
                    {pendingAddUnitToCertLabels.unitTitle}
                  </span>{" "}
                  to{" "}
                  <span className="font-medium text-foreground">
                    {pendingAddUnitToCertLabels.levelName}
                  </span>
                  ?
                </>
              ) : (
                "Confirm adding this unit to the certification."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingAddUnitToCert(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!pendingAddUnitToCert}
              onClick={async () => {
                if (!pendingAddUnitToCert) {
                  return;
                }
                const { unitId, levelId } = pendingAddUnitToCert;
                try {
                  await addUnitToLevel({ levelId, unitId });
                  toast.success("Unit added to certification");
                  setPendingAddUnitToCert(null);
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : "Failed",
                  );
                }
              }}
            >
              Add to certification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingAttachContentToUnit !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAttachContentToUnit(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Attach content to unit?</DialogTitle>
            <DialogDescription>
              {pendingAttachContentToUnitLabels ? (
                <>
                  Attach{" "}
                  <span className="font-medium text-foreground">
                    {pendingAttachContentToUnitLabels.contentTitle}
                  </span>{" "}
                  to{" "}
                  <span className="font-medium text-foreground">
                    {pendingAttachContentToUnitLabels.unitTitle}
                  </span>
                  ?
                </>
              ) : (
                "Confirm attaching this content to the unit."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingAttachContentToUnit(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!pendingAttachContentToUnit}
              onClick={async () => {
                if (!pendingAttachContentToUnit) {
                  return;
                }
                const { contentId, unitId } = pendingAttachContentToUnit;
                try {
                  await attachContentToUnit({ unitId, contentId });
                  toast.success("Attached to unit");
                  setPendingAttachContentToUnit(null);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed");
                }
              }}
            >
              Attach
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addCertOpen}
        onOpenChange={(open) => {
          setAddCertOpen(open);
          if (!open) {
            setLevelName("");
            setLevelCode("");
            setLevelCertCategorySelect(CATEGORY_SELECT_NONE);
            setLevelSummary("");
            setLevelDesc("");
            setAddCertTier("bronze");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New certification</DialogTitle>
            <DialogDescription>
              Add a certification track. You can edit full details after saving.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="add-cert-name">Name</Label>
              <Input
                id="add-cert-name"
                placeholder="Name"
                value={levelName}
                onChange={(e) => setLevelName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-cert-code">Code (optional)</Label>
              <Input
                id="add-cert-code"
                placeholder="Leave blank to auto-generate from name"
                value={levelCode}
                onChange={(e) => setLevelCode(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Uppercase letters, digits, <span className="font-mono">.</span>{" "}
                <span className="font-mono">_</span>{" "}
                <span className="font-mono">-</span> only. Unique per certification.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Certification category</Label>
              {certCategories === undefined ? (
                <div
                  aria-busy="true"
                  className="flex h-10 w-full items-center rounded-md border border-dashed border-muted-foreground/30 bg-muted/25 px-3 text-sm text-muted-foreground"
                >
                  Loading categories…
                </div>
              ) : (
                <Select
                  value={entityCategorySelectValue(
                    levelCertCategorySelect,
                    CATEGORY_SELECT_NONE,
                    certCategories,
                  )}
                  onValueChange={(v) =>
                    setLevelCertCategorySelect(v ?? CATEGORY_SELECT_NONE)
                  }
                  itemToStringLabel={categorySelectItemToStringLabel(
                    certCategories,
                    { noneLabel: "None" },
                  )}
                >
                  <SelectTrigger id="add-cert-category">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CATEGORY_SELECT_NONE} label="None">
                      None
                    </SelectItem>
                    {certCategories.map((c) => (
                      <SelectItem
                        key={c._id}
                        value={c._id}
                        label={categoryTriggerLabel(c.shortCode)}
                      >
                        {categorySelectLabel(c.shortCode, c.longDescription)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-[11px] text-muted-foreground">
                {certCategories === undefined
                  ? "Loading categories…"
                  : "Manage categories in the section below this page."}
              </p>
            </div>
            <div className="space-y-1">
              <Label id="add-cert-tier-label">Certification tier</Label>
              <CertificationTierIconPicker
                aria-labelledby="add-cert-tier-label"
                value={addCertTier}
                onChange={setAddCertTier}
              />
              <p className="text-[11px] text-muted-foreground">
                Higher-level grouping for the catalog and workshops. Enforcement
                of “mandatory” is an org policy, not a hard rule in the app.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-cert-summary">Short summary</Label>
              <Textarea
                id="add-cert-summary"
                placeholder="One or two sentences for lists and cards"
                value={levelSummary}
                onChange={(e) => setLevelSummary(e.target.value)}
                className="min-h-[60px]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-cert-desc">Full description</Label>
              <Textarea
                id="add-cert-desc"
                placeholder="Detailed overview (level page, catalog)"
                value={levelDesc}
                onChange={(e) => setLevelDesc(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddCertOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!levelName.trim()) {
                  toast.error("Enter a name");
                  return;
                }
                const n = levels?.length ?? 0;
                try {
                  const newId = await createLevel({
                    name: levelName.trim(),
                    ...(levelCode.trim()
                      ? { code: levelCode.trim() }
                      : {}),
                    certificationCategoryId:
                      levelCertCategorySelect === CATEGORY_SELECT_NONE
                        ? undefined
                        : (levelCertCategorySelect as Id<"certificationCategories">),
                    summary: levelSummary.trim() || undefined,
                    description: levelDesc.trim() || "—",
                    order: n,
                    certificationTier: addCertTier,
                  });
                  setLevelName("");
                  setLevelCode("");
                  setLevelCertCategorySelect(CATEGORY_SELECT_NONE);
                  setLevelSummary("");
                  setLevelDesc("");
                  setAddCertOpen(false);
                  setEditCertId(newId);
                  setCertDetailsOpen(true);
                  toast.success("Certification created");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addUnitOpen}
        onOpenChange={(open) => {
          setAddUnitOpen(open);
          if (!open) {
            setUnitTitle("");
            setUnitCode("");
            setNewUnitCategorySelect(CATEGORY_SELECT_NONE);
            setUnitDesc("");
            setNewUnitDeliveryMode("self_paced");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New unit</DialogTitle>
            <DialogDescription>
              Units can belong to certifications and hold lessons and
              assessments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="add-unit-title">Title</Label>
              <Input
                id="add-unit-title"
                placeholder="Title"
                value={unitTitle}
                onChange={(e) => setUnitTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-unit-code">Code (optional)</Label>
              <Input
                id="add-unit-code"
                placeholder="Leave blank to auto-generate from title"
                value={unitCode}
                onChange={(e) => setUnitCode(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label>Unit category</Label>
              {unitCategories === undefined ? (
                <div
                  aria-busy="true"
                  className="flex h-10 w-full items-center rounded-md border border-dashed border-muted-foreground/30 bg-muted/25 px-3 text-sm text-muted-foreground"
                >
                  Loading categories…
                </div>
              ) : (
                <Select
                  value={entityCategorySelectValue(
                    newUnitCategorySelect,
                    CATEGORY_SELECT_NONE,
                    unitCategories,
                  )}
                  onValueChange={(v) =>
                    setNewUnitCategorySelect(v ?? CATEGORY_SELECT_NONE)
                  }
                  itemToStringLabel={categorySelectItemToStringLabel(
                    unitCategories,
                    { noneLabel: "None" },
                  )}
                >
                  <SelectTrigger id="add-unit-category">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CATEGORY_SELECT_NONE} label="None">
                      None
                    </SelectItem>
                    {unitCategories.map((c) => (
                      <SelectItem
                        key={c._id}
                        value={c._id}
                        label={categoryTriggerLabel(c.shortCode)}
                      >
                        {categorySelectLabel(c.shortCode, c.longDescription)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-[11px] text-muted-foreground">
                {unitCategories === undefined
                  ? "Loading categories…"
                  : "Manage categories in the section below this page."}
              </p>
            </div>
            <div className="space-y-1">
              <Label>Delivery</Label>
              <Select
                value={newUnitDeliveryMode}
                onValueChange={(v) =>
                  setNewUnitDeliveryMode(
                    (v ?? "self_paced") as "self_paced" | "live_workshop",
                  )
                }
              >
                <SelectTrigger id="add-unit-delivery">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self_paced" label="Self-paced (default)">
                    Self-paced (default)
                  </SelectItem>
                  <SelectItem
                    value="live_workshop"
                    label="Live workshop (scheduled sessions)"
                  >
                    Live workshop (scheduled sessions)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Live workshop units get dated sessions under Admin → Workshops.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-unit-desc">Description</Label>
              <Textarea
                id="add-unit-desc"
                placeholder="Description"
                value={unitDesc}
                onChange={(e) => setUnitDesc(e.target.value)}
                className="min-h-[72px]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddUnitOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!unitTitle.trim()) {
                  toast.error("Title required");
                  return;
                }
                try {
                  await createUnit({
                    title: unitTitle.trim(),
                    ...(unitCode.trim() ? { code: unitCode.trim() } : {}),
                    description: unitDesc.trim() || "—",
                    unitCategoryId:
                      newUnitCategorySelect === CATEGORY_SELECT_NONE
                        ? undefined
                        : (newUnitCategorySelect as Id<"unitCategories">),
                    ...(newUnitDeliveryMode === "live_workshop"
                      ? { deliveryMode: "live_workshop" as const }
                      : {}),
                  });
                  setUnitTitle("");
                  setUnitCode("");
                  setNewUnitCategorySelect(CATEGORY_SELECT_NONE);
                  setUnitDesc("");
                  setNewUnitDeliveryMode("self_paced");
                  setAddUnitOpen(false);
                  toast.success("Unit created");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addLibraryOpen}
        onOpenChange={(open) => {
          setAddLibraryOpen(open);
          if (!open) {
            setAddLibraryAssessment(null);
            setContentLibraryCode("");
            setNewLibraryContentCategorySelect(CATEGORY_SELECT_NONE);
            setAddLibraryWorkshopSessionId("");
            return;
          }
          if (contentKind === "test" || contentKind === "assignment") {
            setAddLibraryAssessment(createEmptyAssessment());
          } else {
            setAddLibraryAssessment(null);
          }
        }}
      >
        <DialogContent className="max-h-[min(90dvh,800px)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add to library</DialogTitle>
            <DialogDescription>
              Fields depend on type. If a unit is selected in the centre, new
              items attach to it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="add-lib-title">Title</Label>
              <Input
                id="add-lib-title"
                placeholder="Title"
                value={contentTitle}
                onChange={(e) => setContentTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-lib-code">Code (optional)</Label>
              <Input
                id="add-lib-code"
                placeholder="Leave blank to auto-generate from title"
                value={contentLibraryCode}
                onChange={(e) => setContentLibraryCode(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label>Content category</Label>
              {contentCategories === undefined ? (
                <div
                  aria-busy="true"
                  className="flex h-10 w-full items-center rounded-md border border-dashed border-muted-foreground/30 bg-muted/25 px-3 text-sm text-muted-foreground"
                >
                  Loading categories…
                </div>
              ) : (
                <Select
                  value={entityCategorySelectValue(
                    newLibraryContentCategorySelect,
                    CATEGORY_SELECT_NONE,
                    contentCategories,
                  )}
                  onValueChange={(v) =>
                    setNewLibraryContentCategorySelect(v ?? CATEGORY_SELECT_NONE)
                  }
                  itemToStringLabel={categorySelectItemToStringLabel(
                    contentCategories,
                    { noneLabel: "None" },
                  )}
                >
                  <SelectTrigger id="add-lib-category">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CATEGORY_SELECT_NONE} label="None">
                      None
                    </SelectItem>
                    {contentCategories.map((c) => (
                      <SelectItem
                        key={c._id}
                        value={c._id}
                        label={categoryTriggerLabel(c.shortCode)}
                      >
                        {categorySelectLabel(c.shortCode, c.longDescription)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-[11px] text-muted-foreground">
                {contentCategories === undefined
                  ? "Loading categories…"
                  : "Manage categories in the section below this page."}
              </p>
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select
                value={contentKind}
                onValueChange={(v) => {
                  const k = (v ?? "link") as Doc<"contentItems">["type"];
                  setContentKind(k);
                  if (k === "test" || k === "assignment") {
                    setAddLibraryAssessment((prev) => prev ?? createEmptyAssessment());
                  } else {
                    setAddLibraryAssessment(null);
                  }
                  if (k !== "workshop_session") {
                    setAddLibraryWorkshopSessionId("");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="link">Link</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="slideshow">Deck (slideshow)</SelectItem>
                  <SelectItem value="test">Test</SelectItem>
                  <SelectItem value="assignment">Assignment</SelectItem>
                  <SelectItem value="workshop_session">
                    Live workshop session
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {contentKind === "test" || contentKind === "assignment" ? (
              addLibraryAssessment ? (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="add-lib-desc">Description</Label>
                    <Textarea
                      id="add-lib-desc"
                      placeholder="Learner-facing intro (shown before questions)"
                      value={contentUrl}
                      onChange={(e) => setContentUrl(e.target.value)}
                      className="min-h-[72px]"
                    />
                  </div>
                  <div className="max-h-[min(50vh,380px)] space-y-3 overflow-y-auto rounded-md border p-3">
                    <div className="space-y-2">
                      <Label>Passing score %</Label>
                      <Input
                        type="number"
                        className="w-24"
                        value={addLibraryAssessment.passingScore}
                        onChange={(e) =>
                          setAddLibraryAssessment({
                            ...addLibraryAssessment,
                            passingScore:
                              Number.parseInt(e.target.value, 10) || 80,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-4 border-t pt-3">
                      {addLibraryAssessment.questions.map((q, i) => (
                        <div
                          key={q.id}
                          className="space-y-2 border-b pb-3 last:border-0"
                        >
                          <div className="flex justify-between gap-2">
                            <Label>Question {i + 1}</Label>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0"
                              onClick={() => removeAddLibraryQuestion(i)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <Input
                            placeholder="Question text"
                            value={q.question}
                            onChange={(e) =>
                              updateAddLibraryQuestion(i, {
                                question: e.target.value,
                              })
                            }
                          />
                          <Select
                            value={q.type}
                            onValueChange={(v) =>
                              updateAddLibraryQuestion(i, {
                                type: (v ?? "multiple_choice") as
                                  | "multiple_choice"
                                  | "text",
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="multiple_choice">
                                Multiple choice
                              </SelectItem>
                              <SelectItem value="text">Text</SelectItem>
                            </SelectContent>
                          </Select>
                          {q.type === "multiple_choice" ? (
                            <div className="space-y-2">
                              {(q.options ?? ["", ""]).map((opt, j) => (
                                <Input
                                  key={j}
                                  placeholder={`Option ${j + 1}`}
                                  value={opt}
                                  onChange={(e) => {
                                    const next = [...(q.options ?? ["", ""])];
                                    next[j] = e.target.value;
                                    updateAddLibraryQuestion(i, {
                                      options: next,
                                    });
                                  }}
                                />
                              ))}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  updateAddLibraryQuestion(i, {
                                    options: [
                                      ...(q.options ?? ["", ""]),
                                      "",
                                    ],
                                  })
                                }
                              >
                                <Plus className="mr-1 h-4 w-4" />
                                Add option
                              </Button>
                            </div>
                          ) : null}
                          <Input
                            placeholder="Correct answer (exact match, case-insensitive)"
                            value={q.correctAnswer ?? ""}
                            onChange={(e) =>
                              updateAddLibraryQuestion(i, {
                                correctAnswer: e.target.value,
                              })
                            }
                          />
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={addAddLibraryQuestion}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Add question
                      </Button>
                    </div>
                  </div>
                </>
              ) : null
            ) : contentKind === "workshop_session" ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Scheduled session</Label>
                  {workshopSessionsAdmin === undefined ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : workshopSessionsAdmin.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Create sessions under{" "}
                      <span className="font-medium text-foreground">
                        Admin → Workshops
                      </span>{" "}
                      first.
                    </p>
                  ) : (
                    <Select
                      value={addLibraryWorkshopSessionId || "__pick__"}
                      onValueChange={(v) =>
                        setAddLibraryWorkshopSessionId(
                          v === "__pick__" ? "" : (v ?? ""),
                        )
                      }
                      itemToStringLabel={(v) => {
                        if (v == null || v === "" || v === "__pick__") {
                          return "Choose a session…";
                        }
                        const s = workshopSessionsAdmin.find(
                          (x) => x._id === v,
                        );
                        if (!s) {
                          return String(v);
                        }
                        const start = new Date(s.startsAt).toLocaleString();
                        return `${s.workshopTitle} — ${start}`;
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a session…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__pick__" label="Choose a session…">
                          Choose a session…
                        </SelectItem>
                        {workshopSessionsAdmin
                          .filter((s) => s.status === "scheduled")
                          .map((s) => {
                            const start = new Date(s.startsAt).toLocaleString();
                            const label = `${s.workshopTitle} — ${start}`;
                            return (
                              <SelectItem key={s._id} value={s._id} label={label}>
                                {label}
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="add-lib-ws-notes">Notes (optional)</Label>
                  <Textarea
                    id="add-lib-ws-notes"
                    placeholder="Short message shown with this step"
                    value={contentUrl}
                    onChange={(e) => setContentUrl(e.target.value)}
                    className="min-h-[60px]"
                  />
                </div>
              </div>
            ) : urlFieldForContentKind(contentKind) ? (
              <div className="space-y-1">
                <Label htmlFor="add-lib-url">
                  {urlFieldForContentKind(contentKind)!.label}
                </Label>
                <Textarea
                  id="add-lib-url"
                  placeholder={
                    urlFieldForContentKind(contentKind)!.placeholder
                  }
                  value={contentUrl}
                  onChange={(e) => setContentUrl(e.target.value)}
                  className="min-h-[72px]"
                />
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddLibraryOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!contentTitle.trim()) {
                  toast.error("Title required");
                  return;
                }
                try {
                  const isAsm =
                    contentKind === "test" || contentKind === "assignment";
                  if (isAsm) {
                    if (!addLibraryAssessment) {
                      toast.error("Assessment data missing");
                      return;
                    }
                    if (!addLibraryAssessment.questions.length) {
                      toast.error("Add at least one question");
                      return;
                    }
                    const builtQuestions =
                      addLibraryAssessment.questions.map((q) => ({
                        id: q.id,
                        question: q.question,
                        type: q.type,
                        options:
                          q.type === "multiple_choice"
                            ? (q.options ?? []).filter((o) => o.trim())
                            : undefined,
                        correctAnswer:
                          q.correctAnswer?.trim() || undefined,
                      }));
                    const cid = await createContent({
                      type: contentKind,
                      title: contentTitle.trim(),
                      ...(contentLibraryCode.trim()
                        ? { code: contentLibraryCode.trim() }
                        : {}),
                      url: "",
                      contentCategoryId:
                        newLibraryContentCategorySelect === CATEGORY_SELECT_NONE
                          ? undefined
                          : (newLibraryContentCategorySelect as Id<"contentCategories">),
                      assessment: {
                        ...addLibraryAssessment,
                        description: contentUrl.trim() || "—",
                        questions: builtQuestions,
                      },
                    });
                    if (selectedDetailUnitId) {
                      await attachContentToUnit({
                        unitId: selectedDetailUnitId,
                        contentId: cid,
                      });
                      toast.success("Saved to library and attached to unit");
                    } else {
                      toast.success("Saved to library");
                    }
                  } else if (contentKind === "workshop_session") {
                    if (!addLibraryWorkshopSessionId) {
                      toast.error("Select a scheduled workshop session");
                      return;
                    }
                    const cid = await createContent({
                      type: "workshop_session",
                      title: contentTitle.trim(),
                      ...(contentLibraryCode.trim()
                        ? { code: contentLibraryCode.trim() }
                        : {}),
                      url: contentUrl.trim() || "",
                      workshopSessionId: addLibraryWorkshopSessionId as Id<
                        "workshopSessions"
                      >,
                      contentCategoryId:
                        newLibraryContentCategorySelect === CATEGORY_SELECT_NONE
                          ? undefined
                          : (newLibraryContentCategorySelect as Id<"contentCategories">),
                    });
                    if (selectedDetailUnitId) {
                      await attachContentToUnit({
                        unitId: selectedDetailUnitId,
                        contentId: cid,
                      });
                      toast.success("Saved to library and attached to unit");
                    } else {
                      toast.success("Saved to library");
                    }
                  } else {
                    const urlMeta = urlFieldForContentKind(contentKind);
                    if (!contentUrl.trim() && urlMeta) {
                      toast.error(`${urlMeta.label} is required`);
                      return;
                    }
                    const cid = await createContent({
                      type: contentKind,
                      title: contentTitle.trim(),
                      ...(contentLibraryCode.trim()
                        ? { code: contentLibraryCode.trim() }
                        : {}),
                      url: contentUrl.trim() || "#",
                      contentCategoryId:
                        newLibraryContentCategorySelect === CATEGORY_SELECT_NONE
                          ? undefined
                          : (newLibraryContentCategorySelect as Id<"contentCategories">),
                    });
                    if (selectedDetailUnitId) {
                      await attachContentToUnit({
                        unitId: selectedDetailUnitId,
                        contentId: cid,
                      });
                      toast.success("Saved to library and attached to unit");
                    } else {
                      toast.success("Saved to library");
                    }
                  }
                  setContentTitle("");
                  setContentLibraryCode("");
                  setNewLibraryContentCategorySelect(CATEGORY_SELECT_NONE);
                  setContentUrl("");
                  setAddLibraryWorkshopSessionId("");
                  setAddLibraryAssessment(null);
                  setAddLibraryOpen(false);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Save to library
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={certDetailsOpen}
        onOpenChange={(o) => {
          setCertDetailsOpen(o);
          if (!o) {
            setEditCertId(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit certification</DialogTitle>
            <DialogDescription>
              Catalog fields and company scope. Click the certification in the
              list (not the pencil) to filter the centre to its units.
            </DialogDescription>
          </DialogHeader>
          {editCertId && selectedCert ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="cert-name">Name</Label>
                  <Input
                    id="cert-name"
                    value={certDetailName}
                    onChange={(e) => setCertDetailName(e.target.value)}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="cert-code">Code</Label>
                  <Input
                    id="cert-code"
                    value={certDetailCode}
                    onChange={(e) => setCertDetailCode(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Unique identifier (normalized to uppercase). Used in admin
                    search and for formal references.
                  </p>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Certification category</Label>
                  {certCategories === undefined ? (
                    <div
                      aria-busy="true"
                      className="flex h-10 w-full items-center rounded-md border border-dashed border-muted-foreground/30 bg-muted/25 px-3 text-sm text-muted-foreground"
                    >
                      Loading categories…
                    </div>
                  ) : (
                    <Select
                      value={entityCategorySelectValue(
                        certDetailCertCategorySelect,
                        CATEGORY_SELECT_NONE,
                        certCategories,
                      )}
                      onValueChange={(v) =>
                        setCertDetailCertCategorySelect(
                          v ?? CATEGORY_SELECT_NONE,
                        )
                      }
                      itemToStringLabel={categorySelectItemToStringLabel(
                        certCategories,
                        { noneLabel: "None" },
                      )}
                    >
                      <SelectTrigger id="cert-category">
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CATEGORY_SELECT_NONE} label="None">
                          None
                        </SelectItem>
                        {certCategories.map((c) => (
                          <SelectItem
                            key={c._id}
                            value={c._id}
                            label={categoryTriggerLabel(c.shortCode)}
                          >
                            {categorySelectLabel(c.shortCode, c.longDescription)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label id="cert-tier-label">Certification tier</Label>
                  <CertificationTierIconPicker
                    aria-labelledby="cert-tier-label"
                    value={certDetailTier}
                    onChange={setCertDetailTier}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Higher-level grouping for the catalog and workshops.
                  </p>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="cert-summary">Short summary</Label>
                  <Textarea
                    id="cert-summary"
                    value={certDetailSummary}
                    onChange={(e) => setCertDetailSummary(e.target.value)}
                    placeholder="For lists, cards, and the admin column preview"
                    className="min-h-[72px]"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="cert-desc">Full description</Label>
                  <Textarea
                    id="cert-desc"
                    value={certDetailDesc}
                    onChange={(e) => setCertDetailDesc(e.target.value)}
                    className="min-h-[120px]"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="cert-tag">Tagline</Label>
                  <Input
                    id="cert-tag"
                    value={certDetailTagline}
                    onChange={(e) => setCertDetailTagline(e.target.value)}
                    placeholder="Short line on catalog cards"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cert-order">Display order</Label>
                  <Input
                    id="cert-order"
                    type="number"
                    value={certDetailOrder}
                    onChange={(e) => setCertDetailOrder(e.target.value)}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="cert-thumb">Thumbnail URL</Label>
                  <Input
                    id="cert-thumb"
                    value={certDetailThumbnail}
                    onChange={(e) => setCertDetailThumbnail(e.target.value)}
                    placeholder="https://…"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Company scope</Label>
                  <Select
                    value={certDetailCompanyId || "__global__"}
                    onValueChange={(v) =>
                      setCertDetailCompanyId(
                        v === "__global__" ? "" : (v ?? ""),
                      )
                    }
                    itemToStringLabel={(v) => {
                      if (v == null || v === "" || v === "__global__") {
                        return "All companies (global)";
                      }
                      const id = String(v);
                      const row = companies?.find((c) => c._id === id);
                      return row?.name ?? "…";
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__global__" label="All companies (global)">
                        All companies (global)
                      </SelectItem>
                      {(companies ?? []).map((c) => (
                        <SelectItem key={c._id} value={c._id} label={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCertDetailsOpen(false)}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    if (!editCertId || !certDetailName.trim()) {
                      toast.error("Name is required");
                      return;
                    }
                    if (!certDetailCode.trim()) {
                      toast.error("Code is required");
                      return;
                    }
                    const orderNum = Number.parseInt(certDetailOrder, 10);
                    if (Number.isNaN(orderNum)) {
                      toast.error("Display order must be a number");
                      return;
                    }
                    try {
                      await updateLevel({
                        levelId: editCertId,
                        name: certDetailName.trim(),
                        code: certDetailCode.trim(),
                        certificationCategoryId:
                          certDetailCertCategorySelect === CATEGORY_SELECT_NONE
                            ? null
                            : (certDetailCertCategorySelect as Id<"certificationCategories">),
                        summary: certDetailSummary.trim() || undefined,
                        description: certDetailDesc.trim() || "—",
                        order: orderNum,
                        companyId: certDetailCompanyId
                          ? (certDetailCompanyId as Id<"companies">)
                          : undefined,
                        tagline: certDetailTagline.trim() || undefined,
                        thumbnailUrl:
                          certDetailThumbnail.trim() || undefined,
                        certificationTier: certDetailTier,
                      });
                      toast.success("Certification saved");
                      setCertDetailsOpen(false);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Failed");
                    }
                  }}
                >
                  Save
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={editContentOpen}
        onOpenChange={(o) => {
          setEditContentOpen(o);
          if (!o) {
            setEditContentId(null);
            setEditContentStorageId(null);
            setEditUnitContentLinkId(null);
            setEditContentAssessment(null);
            setEditContentCode("");
            setEditContentCategorySelect(CATEGORY_SELECT_NONE);
            setEditWorkshopSessionId("");
          }
        }}
      >
        <DialogContent className="max-h-[min(90dvh,800px)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit content</DialogTitle>
            <DialogDescription>
              Fields depend on content type. Change type to switch between URL
              resources and tests/assignments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="ec-title">Title</Label>
              <Input
                id="ec-title"
                value={editContentTitle}
                onChange={(e) => setEditContentTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ec-code">Code</Label>
              <Input
                id="ec-code"
                value={editContentCode}
                onChange={(e) => setEditContentCode(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label>Content category</Label>
              {contentCategories === undefined ? (
                <div
                  aria-busy="true"
                  className="flex h-10 w-full items-center rounded-md border border-dashed border-muted-foreground/30 bg-muted/25 px-3 text-sm text-muted-foreground"
                >
                  Loading categories…
                </div>
              ) : (
                <Select
                  value={entityCategorySelectValue(
                    editContentCategorySelect,
                    CATEGORY_SELECT_NONE,
                    contentCategories,
                  )}
                  onValueChange={(v) =>
                    setEditContentCategorySelect(v ?? CATEGORY_SELECT_NONE)
                  }
                  itemToStringLabel={categorySelectItemToStringLabel(
                    contentCategories,
                    { noneLabel: "None" },
                  )}
                >
                  <SelectTrigger id="ec-category">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CATEGORY_SELECT_NONE} label="None">
                      None
                    </SelectItem>
                    {contentCategories.map((c) => (
                      <SelectItem
                        key={c._id}
                        value={c._id}
                        label={categoryTriggerLabel(c.shortCode)}
                      >
                        {categorySelectLabel(c.shortCode, c.longDescription)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select
                value={editContentKind}
                onValueChange={(v) => {
                  const k = (v ?? "link") as Doc<"contentItems">["type"];
                  setEditContentKind(k);
                  if (k === "test" || k === "assignment") {
                    setEditContentAssessment((prev) => {
                      const base =
                        prev ?? {
                          description: "—",
                          questions: [],
                          passingScore: 80,
                        };
                      if (base.questions.length === 0) {
                        return {
                          ...base,
                          questions: [
                            {
                              id: crypto.randomUUID(),
                              question: "",
                              type: "multiple_choice" as const,
                              options: ["", ""],
                              correctAnswer: "",
                            },
                          ],
                        };
                      }
                      return base;
                    });
                  } else {
                    setEditContentAssessment(null);
                  }
                  if (k !== "workshop_session") {
                    setEditWorkshopSessionId("");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="link">Link</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="slideshow">Deck (slideshow)</SelectItem>
                  <SelectItem value="test">Test</SelectItem>
                  <SelectItem value="assignment">Assignment</SelectItem>
                  <SelectItem value="workshop_session">
                    Live workshop session
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editContentKind === "test" ||
            editContentKind === "assignment" ? (
              <div className="space-y-1">
                <Label htmlFor="ec-url">Description</Label>
                <Textarea
                  id="ec-url"
                  placeholder="Learner-facing intro (shown before questions)"
                  value={editContentUrl}
                  onChange={(e) => setEditContentUrl(e.target.value)}
                  className="min-h-[72px]"
                />
              </div>
            ) : editContentKind === "workshop_session" ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Scheduled session</Label>
                  {workshopSessionsAdmin === undefined ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : workshopSessionsAdmin.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Add sessions under Admin → Workshops.
                    </p>
                  ) : (
                    <Select
                      value={editWorkshopSessionId || "__pick__"}
                      onValueChange={(v) =>
                        setEditWorkshopSessionId(
                          v === "__pick__" ? "" : (v ?? ""),
                        )
                      }
                      itemToStringLabel={(v) => {
                        if (v == null || v === "" || v === "__pick__") {
                          return "Choose a session…";
                        }
                        const s = workshopSessionsAdmin.find(
                          (x) => x._id === v,
                        );
                        if (!s) {
                          return String(v);
                        }
                        const start = new Date(s.startsAt).toLocaleString();
                        return `${s.workshopTitle} — ${start}`;
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a session…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__pick__" label="Choose a session…">
                          Choose a session…
                        </SelectItem>
                        {workshopSessionsAdmin
                          .filter((s) => s.status === "scheduled")
                          .map((s) => {
                            const start = new Date(s.startsAt).toLocaleString();
                            const label = `${s.workshopTitle} — ${start}`;
                            return (
                              <SelectItem key={s._id} value={s._id} label={label}>
                                {label}
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ec-ws-notes">Notes (optional)</Label>
                  <Textarea
                    id="ec-ws-notes"
                    placeholder="Short message shown with this step"
                    value={editContentUrl}
                    onChange={(e) => setEditContentUrl(e.target.value)}
                    className="min-h-[60px]"
                  />
                </div>
              </div>
            ) : urlFieldForContentKind(editContentKind) ? (
              <div className="space-y-1">
                <Label htmlFor="ec-url">
                  {urlFieldForContentKind(editContentKind)!.label}
                </Label>
                <Textarea
                  id="ec-url"
                  placeholder={
                    urlFieldForContentKind(editContentKind)!.placeholder
                  }
                  value={editContentUrl}
                  onChange={(e) => setEditContentUrl(e.target.value)}
                  className="min-h-[72px]"
                />
              </div>
            ) : null}
            {(editContentKind === "test" ||
              editContentKind === "assignment") &&
            editContentAssessment ? (
              <div className="max-h-[min(55vh,420px)] space-y-3 overflow-y-auto rounded-md border p-3">
                <div className="space-y-2">
                  <Label>Passing score %</Label>
                  <Input
                    type="number"
                    className="w-24"
                    value={editContentAssessment.passingScore}
                    onChange={(e) =>
                      setEditContentAssessment({
                        ...editContentAssessment,
                        passingScore:
                          Number.parseInt(e.target.value, 10) || 80,
                      })
                    }
                  />
                </div>
                <div className="space-y-4 border-t pt-3">
                  {editContentAssessment.questions.map((q, i) => (
                    <div
                      key={q.id}
                      className="space-y-2 border-b pb-3 last:border-0"
                    >
                      <div className="flex justify-between gap-2">
                        <Label>Question {i + 1}</Label>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          onClick={() => removeEditContentQuestion(i)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input
                        placeholder="Question text"
                        value={q.question}
                        onChange={(e) =>
                          updateEditContentQuestion(i, {
                            question: e.target.value,
                          })
                        }
                      />
                      <Select
                        value={q.type}
                        onValueChange={(v) =>
                          updateEditContentQuestion(i, {
                            type: (v ?? "multiple_choice") as
                              | "multiple_choice"
                              | "text",
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="multiple_choice">
                            Multiple choice
                          </SelectItem>
                          <SelectItem value="text">Text</SelectItem>
                        </SelectContent>
                      </Select>
                      {q.type === "multiple_choice" ? (
                        <div className="space-y-2">
                          {(q.options ?? ["", ""]).map((opt, j) => (
                            <Input
                              key={j}
                              placeholder={`Option ${j + 1}`}
                              value={opt}
                              onChange={(e) => {
                                const next = [...(q.options ?? ["", ""])];
                                next[j] = e.target.value;
                                updateEditContentQuestion(i, { options: next });
                              }}
                            />
                          ))}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateEditContentQuestion(i, {
                                options: [...(q.options ?? ["", ""]), ""],
                              })
                            }
                          >
                            <Plus className="mr-1 h-4 w-4" />
                            Add option
                          </Button>
                        </div>
                      ) : null}
                      <Input
                        placeholder="Correct answer (exact match, case-insensitive)"
                        value={q.correctAnswer ?? ""}
                        onChange={(e) =>
                          updateEditContentQuestion(i, {
                            correctAnswer: e.target.value,
                          })
                        }
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={addEditContentQuestion}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Add question
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="space-y-1">
              <Label htmlFor="ec-order">Order</Label>
              <Input
                id="ec-order"
                type="number"
                value={editContentOrder}
                onChange={(e) => setEditContentOrder(e.target.value)}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditContentOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!editContentId}
                onClick={async () => {
                  if (!editContentId) {
                    return;
                  }
                  if (!editContentCode.trim()) {
                    toast.error("Code is required");
                    return;
                  }
                  const ord = Number.parseInt(editContentOrder, 10);
                  if (Number.isNaN(ord)) {
                    toast.error("Order must be a number");
                    return;
                  }
                  try {
                    const isAsm =
                      editContentKind === "test" ||
                      editContentKind === "assignment";
                    if (isAsm) {
                      if (!editContentAssessment) {
                        toast.error("Assessment data missing");
                        return;
                      }
                      if (!editContentAssessment.questions.length) {
                        toast.error("Add at least one question");
                        return;
                      }
                      const builtQuestions =
                        editContentAssessment.questions.map((q) => ({
                          id: q.id,
                          question: q.question,
                          type: q.type,
                          options:
                            q.type === "multiple_choice"
                              ? (q.options ?? []).filter((o) => o.trim())
                              : undefined,
                          correctAnswer:
                            q.correctAnswer?.trim() || undefined,
                        }));
                      await updateContent({
                        contentId: editContentId,
                        title: editContentTitle.trim(),
                        code: editContentCode.trim(),
                        url: "",
                        type: editContentKind,
                        contentCategoryId:
                          editContentCategorySelect === CATEGORY_SELECT_NONE
                            ? null
                            : (editContentCategorySelect as Id<"contentCategories">),
                        storageId: editContentStorageId ?? undefined,
                        assessment: {
                          ...editContentAssessment,
                          description:
                            editContentUrl.trim() ||
                            editContentAssessment.description,
                          questions: builtQuestions,
                        },
                      });
                    } else if (editContentKind === "workshop_session") {
                      if (!editWorkshopSessionId) {
                        toast.error("Select a scheduled workshop session");
                        return;
                      }
                      await updateContent({
                        contentId: editContentId,
                        title: editContentTitle.trim(),
                        code: editContentCode.trim(),
                        url: editContentUrl.trim() || "",
                        type: "workshop_session",
                        workshopSessionId: editWorkshopSessionId as Id<
                          "workshopSessions"
                        >,
                        contentCategoryId:
                          editContentCategorySelect === CATEGORY_SELECT_NONE
                            ? null
                            : (editContentCategorySelect as Id<"contentCategories">),
                        storageId: editContentStorageId ?? undefined,
                      });
                    } else {
                      await updateContent({
                        contentId: editContentId,
                        title: editContentTitle.trim(),
                        code: editContentCode.trim(),
                        url: editContentUrl.trim() || "#",
                        type: editContentKind,
                        contentCategoryId:
                          editContentCategorySelect === CATEGORY_SELECT_NONE
                            ? null
                            : (editContentCategorySelect as Id<"contentCategories">),
                        storageId: editContentStorageId ?? undefined,
                      });
                    }
                    if (editUnitContentLinkId) {
                      await patchUnitContentOrder({
                        unitContentId: editUnitContentLinkId,
                        order: ord,
                      });
                    } else if (editContentId) {
                      await patchLegacyContentOrder({
                        contentId: editContentId,
                        order: ord,
                      });
                    }
                    toast.success("Lesson updated");
                    setEditContentOpen(false);
                  } catch (e) {
                    toast.error(
                      e instanceof Error ? e.message : "Failed",
                    );
                  }
                }}
              >
                Save
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editUnitOpen}
        onOpenChange={(open) => {
          setEditUnitOpen(open);
          if (!open) {
            setEditUnitCategorySelect(CATEGORY_SELECT_NONE);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit unit</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="edit-unit-title">Title</Label>
              <Input
                id="edit-unit-title"
                value={editUnitTitle}
                onChange={(e) => setEditUnitTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-unit-code">Code</Label>
              <Input
                id="edit-unit-code"
                value={editUnitCode}
                onChange={(e) => setEditUnitCode(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label>Unit category</Label>
              {unitCategories === undefined ? (
                <div
                  aria-busy="true"
                  className="flex h-10 w-full items-center rounded-md border border-dashed border-muted-foreground/30 bg-muted/25 px-3 text-sm text-muted-foreground"
                >
                  Loading categories…
                </div>
              ) : (
                <Select
                  value={entityCategorySelectValue(
                    editUnitCategorySelect,
                    CATEGORY_SELECT_NONE,
                    unitCategories,
                  )}
                  onValueChange={(v) =>
                    setEditUnitCategorySelect(v ?? CATEGORY_SELECT_NONE)
                  }
                  itemToStringLabel={categorySelectItemToStringLabel(
                    unitCategories,
                    { noneLabel: "None" },
                  )}
                >
                  <SelectTrigger id="edit-unit-category">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CATEGORY_SELECT_NONE} label="None">
                      None
                    </SelectItem>
                    {unitCategories.map((c) => (
                      <SelectItem
                        key={c._id}
                        value={c._id}
                        label={categoryTriggerLabel(c.shortCode)}
                      >
                        {categorySelectLabel(c.shortCode, c.longDescription)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1">
              <Label>Delivery</Label>
              <Select
                value={editUnitDeliveryMode}
                onValueChange={(v) =>
                  setEditUnitDeliveryMode(
                    (v ?? "self_paced") as "self_paced" | "live_workshop",
                  )
                }
              >
                <SelectTrigger id="edit-unit-delivery">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self_paced" label="Self-paced (default)">
                    Self-paced (default)
                  </SelectItem>
                  <SelectItem
                    value="live_workshop"
                    label="Live workshop (scheduled sessions)"
                  >
                    Live workshop (scheduled sessions)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-unit-desc">Description</Label>
              <Textarea
                id="edit-unit-desc"
                value={editUnitDesc}
                onChange={(e) => setEditUnitDesc(e.target.value)}
              />
            </div>
            <Button
              onClick={async () => {
                if (!editUnitId) {
                  return;
                }
                if (!editUnitCode.trim()) {
                  toast.error("Code is required");
                  return;
                }
                await updateUnit({
                  unitId: editUnitId,
                  title: editUnitTitle,
                  code: editUnitCode.trim(),
                  description: editUnitDesc,
                  unitCategoryId:
                    editUnitCategorySelect === CATEGORY_SELECT_NONE
                      ? null
                      : (editUnitCategorySelect as Id<"unitCategories">),
                  deliveryMode:
                    editUnitDeliveryMode === "live_workshop"
                      ? "live_workshop"
                      : null,
                });
                toast.success("Unit updated");
                setEditUnitOpen(false);
              }}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={certDeleteOpen}
        onOpenChange={(open) => {
          setCertDeleteOpen(open);
          if (!open) {
            setCertDeleteId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete certification?</DialogTitle>
            <DialogDescription>
              {certPendingDelete ? (
                <>
                  <span className="font-medium text-foreground">
                    {certPendingDelete.name}
                  </span>{" "}
                  will be removed from the catalog. Units stay in the library;
                  only their link to this certification is removed (other
                  certifications that use the same units are unchanged). This
                  cannot be undone.
                </>
              ) : (
                <>
                  This removes the certification from the catalog and unlinks
                  every unit from it. Units and their lessons remain in the
                  library. This cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCertDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!certDeleteId}
              onClick={async () => {
                if (!certDeleteId) {
                  return;
                }
                const id = certDeleteId;
                try {
                  await deleteCertificationLevel({ levelId: id });
                  toast.success("Certification deleted");
                  setFilterCertId((f) => (f === id ? null : f));
                  if (editCertId === id) {
                    setEditCertId(null);
                    setCertDetailsOpen(false);
                  }
                  setCertDeleteOpen(false);
                  setCertDeleteId(null);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Delete certification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={detachFromCertOpen}
        onOpenChange={(o) => {
          setDetachFromCertOpen(o);
          if (!o) {
            setDetachFromCertUnitId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from certification?</DialogTitle>
            <DialogDescription>
              The unit stays in the library and can remain in other certifications.
              It will no longer appear in this certification&apos;s ordered list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDetachFromCertOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!detachFromCertUnitId || !filterCertId}
              onClick={async () => {
                if (!detachFromCertUnitId || !filterCertId) {
                  return;
                }
                try {
                  await removeUnitFromLevel({
                    levelId: filterCertId,
                    unitId: detachFromCertUnitId,
                  });
                  if (selectedDetailUnitId === detachFromCertUnitId) {
                    setSelectedDetailUnitId(null);
                  }
                  toast.success("Removed from certification");
                  setDetachFromCertOpen(false);
                  setDetachFromCertUnitId(null);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Remove from certification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unitDeleteOpen} onOpenChange={setUnitDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete unit permanently?</DialogTitle>
            <DialogDescription>
              Removes this unit everywhere: certification links, attachments,
              assignments, prerequisite edges, and related learner progress and quiz
              results. Library content items are kept but detached.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setUnitDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!unitDeleteId}
              onClick={async () => {
                if (!unitDeleteId) {
                  return;
                }
                try {
                  await deleteUnit({ unitId: unitDeleteId });
                  if (selectedDetailUnitId === unitDeleteId) {
                    setSelectedDetailUnitId(null);
                  }
                  if (prereqsPanelUnitId === unitDeleteId) {
                    setPrereqsPanelUnitId(null);
                  }
                  toast.success("Unit deleted");
                  setUnitDeleteOpen(false);
                  setUnitDeleteId(null);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Delete unit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={contentDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setContentDeleteTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {contentDeleteTarget?.kind === "library"
                ? "Delete from library?"
                : contentDeleteTarget?.kind === "detachFromUnit"
                  ? "Remove from unit?"
                  : "Delete content?"}
            </DialogTitle>
            <DialogDescription>
              {contentDeleteTarget?.kind === "library" ? (
                <>
                  <span className="font-medium text-foreground">
                    {contentDeleteTarget.displayTitle}
                  </span>{" "}
                  will be removed from the library and unlinked from every unit.
                  Related quiz results for this item may be deleted.
                </>
              ) : contentDeleteTarget?.kind === "detachFromUnit" ? (
                <>
                  <span className="font-medium text-foreground">
                    {contentDeleteTarget.displayTitle}
                  </span>{" "}
                  will be unlinked from{" "}
                  <span className="font-medium text-foreground">
                    {contentDeleteTarget.unitLabel}
                  </span>{" "}
                  only. It stays in the library and on other units.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter
            className={
              contentDeleteTarget?.kind === "library"
                ? "flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end"
                : "gap-2 sm:gap-0"
            }
          >
            <Button
              type="button"
              variant="outline"
              onClick={() => setContentDeleteTarget(null)}
            >
              Cancel
            </Button>
            {contentDeleteTarget?.kind === "detachFromUnit" ? (
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  const t = contentDeleteTarget;
                  if (t?.kind !== "detachFromUnit") {
                    return;
                  }
                  try {
                    if (t.unitContentId) {
                      await detachContentFromUnit({
                        unitContentId: t.unitContentId,
                      });
                    } else {
                      await legacyDetachContentFromUnit({
                        unitId: t.unitId,
                        contentId: t.contentId,
                      });
                    }
                    toast.success("Removed from unit");
                    setContentDeleteTarget(null);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed");
                  }
                }}
              >
                Remove from unit
              </Button>
            ) : null}
            {contentDeleteTarget?.kind === "library" ? (
              <Button
                type="button"
                variant="destructive"
                disabled={!contentDeleteTarget}
                onClick={async () => {
                  const t = contentDeleteTarget;
                  if (!t || t.kind !== "library") {
                    return;
                  }
                  try {
                    await removeContent({ contentId: t.contentId });
                    if (editContentId === t.contentId) {
                      setEditContentOpen(false);
                      setEditContentId(null);
                      setEditContentStorageId(null);
                      setEditUnitContentLinkId(null);
                      setEditContentAssessment(null);
                    }
                    toast.success("Deleted from library");
                    setContentDeleteTarget(null);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed");
                  }
                }}
              >
                Delete from library
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      </div>
    </TooltipProvider>
  );
}
