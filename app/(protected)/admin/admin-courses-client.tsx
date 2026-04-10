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
  GripVertical,
  Layers,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PrerequisiteDropEditor } from "@/components/admin/prerequisite-drop-editor";

type ContentCategoryFilter =
  | "all"
  | "videos"
  | "tests"
  | "assignments"
  | "decks"
  | "references";

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
    default:
      return null;
  }
}

function contentItemMatchesCategory(
  item: Doc<"contentItems">,
  cat: ContentCategoryFilter,
): boolean {
  if (cat === "all") {
    return true;
  }
  if (cat === "videos") {
    return item.type === "video";
  }
  if (cat === "tests") {
    return item.type === "test";
  }
  if (cat === "assignments") {
    return item.type === "assignment";
  }
  if (cat === "decks") {
    return item.type === "slideshow";
  }
  if (cat === "references") {
    return item.type === "link" || item.type === "pdf";
  }
  return true;
}

import {
  ADMIN_CERT_PANEL_ROW_HIGHLIGHT,
  ContentLibraryDragRow,
  DraggableUnitPaletteItem,
  LevelRowDroppable,
  SortableLevelRow,
  SortableUnitContentRow,
  SortableUnitRow,
  UnitRowContentDropTarget,
  type UnitAdminListRow,
} from "./admin-shared";

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
  const [unitSearch, setUnitSearch] = useState("");
  const [contentSearch, setContentSearch] = useState("");
  const [contentCategory, setContentCategory] =
    useState<ContentCategoryFilter>("all");

  const [levelName, setLevelName] = useState("");
  const [levelSummary, setLevelSummary] = useState("");
  const [levelDesc, setLevelDesc] = useState("");
  const [certDetailName, setCertDetailName] = useState("");
  const [certDetailSummary, setCertDetailSummary] = useState("");
  const [certDetailDesc, setCertDetailDesc] = useState("");
  const [certDetailTagline, setCertDetailTagline] = useState("");
  const [certDetailThumbnail, setCertDetailThumbnail] = useState("");
  const [certDetailCompanyId, setCertDetailCompanyId] = useState("");
  const [certDetailOrder, setCertDetailOrder] = useState("0");
  const [editContentOpen, setEditContentOpen] = useState(false);
  const [editContentId, setEditContentId] = useState<Id<"contentItems"> | null>(
    null,
  );
  const [editContentTitle, setEditContentTitle] = useState("");
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

  const [unitTitle, setUnitTitle] = useState("");
  const [unitDesc, setUnitDesc] = useState("");
  const [editUnitOpen, setEditUnitOpen] = useState(false);
  const [editUnitId, setEditUnitId] = useState<Id<"units"> | null>(null);
  const [editUnitTitle, setEditUnitTitle] = useState("");
  const [editUnitDesc, setEditUnitDesc] = useState("");

  const [levelDeleteOpen, setLevelDeleteOpen] = useState(false);
  const [unitDeleteOpen, setUnitDeleteOpen] = useState(false);
  const [unitDeleteId, setUnitDeleteId] = useState<Id<"units"> | null>(null);
  const [detachFromCertOpen, setDetachFromCertOpen] = useState(false);
  const [detachFromCertUnitId, setDetachFromCertUnitId] =
    useState<Id<"units"> | null>(null);
  const [editUnitContentLinkId, setEditUnitContentLinkId] =
    useState<Id<"unitContents"> | null>(null);
  const [contentTitle, setContentTitle] = useState("");
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
      return (
        l.name.toLowerCase().includes(certSearchLower) ||
        l.description.toLowerCase().includes(certSearchLower) ||
        (l.summary?.toLowerCase().includes(certSearchLower) ?? false) ||
        (l.tagline?.toLowerCase().includes(certSearchLower) ?? false)
      );
    },
    [certSearchLower],
  );

  const unitMatchesSearch = useCallback(
    (u: UnitAdminListRow) => {
      if (!unitSearchLower) {
        return true;
      }
      return (
        u.title.toLowerCase().includes(unitSearchLower) ||
        u.description.toLowerCase().includes(unitSearchLower) ||
        u.certificationSummary.toLowerCase().includes(unitSearchLower)
      );
    },
    [unitSearchLower],
  );

  const contentMatchesSearch = useCallback(
    (item: Doc<"contentItems">) => {
      if (!contentItemMatchesCategory(item, contentCategory)) {
        return false;
      }
      if (!contentSearchLower) {
        return true;
      }
      return (
        item.title.toLowerCase().includes(contentSearchLower) ||
        item.type.toLowerCase().includes(contentSearchLower)
      );
    },
    [contentSearchLower, contentCategory],
  );

  useEffect(() => {
    setSelectedDetailUnitId(null);
  }, [filterCertId]);

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
    setCertDetailSummary(selectedCert.summary ?? "");
    setCertDetailDesc(selectedCert.description);
    setCertDetailTagline(selectedCert.tagline ?? "");
    setCertDetailThumbnail(selectedCert.thumbnailUrl ?? "");
    setCertDetailCompanyId(selectedCert.companyId ?? "");
    setCertDetailOrder(String(selectedCert.order));
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
    setEditUnitDesc(u.description);
    setEditUnitOpen(true);
  }

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

      if (displayedLevels) {
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
      filterCertId,
      centreUnitsShowAll,
      reorderLevels,
      reorderUnitsInLevel,
      selectedDetailUnitId,
      libraryShowAll,
      reorderContentOnUnit,
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
    "h-7 w-7 shrink-0 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-cyan-600 dark:hover:bg-cyan-500";

  const levelsListForUi = displayedLevels ?? levels ?? [];
  const unitsInCertListForUi =
    displayedUnitsInFilteredCert ?? unitsInFilteredCert;
  const detailContentListForUi =
    displayedDetailContent ?? detailContent;

  return (
    <TooltipProvider delayDuration={400}>
      <div className="min-h-0 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Courses</h1>
        <p className="text-sm text-muted-foreground">
          Provide structured training material by adding Content to Units and
          Units to Certifications.
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
          <div className="flex min-h-0 min-w-0 flex-col rounded-2xl border border-brand-lime/40 border-l-4 border-r-4 border-l-brand-lime border-r-brand-lime bg-brand-lime/[0.11] p-4 shadow-lg dark:border-brand-lime/35 dark:border-l-brand-lime dark:border-r-brand-lime dark:bg-brand-lime/[0.14]">
            <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
              <h2 className="flex min-w-0 flex-1 items-center gap-2 text-sm font-bold text-foreground">
                <GraduationCap
                  className="shrink-0 text-brand-lime"
                  size={20}
                  aria-hidden
                />
                <span className="truncate">
                  Certifications
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    ({levels?.length ?? 0})
                  </span>
                </span>
              </h2>
              <Button
                type="button"
                size="icon"
                className={cyanPlusBtn}
                aria-label="Add certification"
                onClick={() => setAddCertOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="mb-1 shrink-0">
              <label
                htmlFor="admin-cert-search"
                className="mb-0.5 block text-xs text-muted-foreground"
              >
                Search
              </label>
              <Input
                id="admin-cert-search"
                placeholder="Filter list…"
                value={certSearch}
                onChange={(e) => setCertSearch(e.target.value)}
                className="h-9 bg-card"
              />
            </div>
            <hr className="my-2 h-0 shrink-0 border-0 border-t-2 border-solid border-brand-lime/50 dark:border-brand-lime/40" />
            {!filterCertId ? (
              <p className="mb-3 shrink-0 text-sm text-muted-foreground">
                Drag and drop Units onto a Certification to add them.
              </p>
            ) : (
              <p className="mb-3 shrink-0 text-sm text-muted-foreground">
                Use{" "}
                <span className="font-medium text-foreground">
                  Show all units
                </span>{" "}
                in the centre column to drag here.
              </p>
            )}
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto scrollbar-panel">
              {levelsListForUi.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No certifications. Use +.
                </p>
              ) : (
                <SortableContext
                  items={levelsListForUi.map((l) => l._id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="space-y-1">
                    {levelsListForUi.map((l) => (
                      <li
                        key={l._id}
                        className={cn(
                          levelMatchesSearch(l) ? "" : "opacity-30",
                        )}
                      >
                        <LevelRowDroppable
                          levelId={l._id}
                          dropHighlight={dropHighlightLevelId === l._id}
                        >
                          <SortableLevelRow
                            level={l}
                            selected={filterCertId === l._id}
                            unitCount={
                              allUnits === undefined
                                ? undefined
                                : (unitCountByLevelId.get(l._id) ?? 0)
                            }
                            onSelect={() => handleCertFilterToggle(l._id)}
                            onEdit={() => openCertificationEditor(l._id)}
                            onDelete={() => {
                              setEditCertId(l._id);
                              setLevelDeleteOpen(true);
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
              "flex min-h-0 min-w-0 flex-col rounded-2xl border border-l-4 border-r-4 bg-brand-gold/[0.14] p-4 shadow-lg dark:bg-brand-gold/[0.12]",
              filterCertId
                ? "border-brand-lime/40 border-l-brand-lime border-r-brand-lime dark:border-brand-lime/35 dark:border-l-brand-lime dark:border-r-brand-lime"
                : "border-brand-gold/40 border-l-brand-gold border-r-brand-gold dark:border-brand-gold/35 dark:border-l-brand-gold dark:border-r-brand-gold",
            )}
          >
            <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
              <h2 className="flex min-w-0 flex-1 items-center gap-2 text-sm font-bold text-foreground">
                <Layers
                  className={cn(
                    "shrink-0",
                    filterCertId ? "text-brand-lime" : "text-brand-gold",
                  )}
                  size={20}
                  aria-hidden
                />
                <span className="truncate">
                  {filterCertId && !centreUnitsShowAll
                    ? `Units for ${filterCertName ?? "…"}`
                    : "All Units"}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    (
                    {filterCertId && !centreUnitsShowAll
                      ? unitsInFilteredCert === undefined
                        ? "…"
                        : unitsInFilteredCert.length
                      : (allUnits?.length ?? 0)}
                    )
                  </span>
                </span>
              </h2>
              <Button
                type="button"
                size="icon"
                className={cyanPlusBtn}
                aria-label="Add unit"
                onClick={() => setAddUnitOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="mb-1 shrink-0">
              <label
                htmlFor="admin-unit-search"
                className="mb-0.5 block text-xs text-muted-foreground"
              >
                Search
              </label>
              <Input
                id="admin-unit-search"
                placeholder="Filter list…"
                value={unitSearch}
                onChange={(e) => setUnitSearch(e.target.value)}
                className="h-9 bg-card"
              />
            </div>
            <hr className="my-2 h-0 shrink-0 border-0 border-t-2 border-solid border-brand-gold/50 dark:border-brand-gold/40" />
            {filterCertId && filterCertName ? (
              <button
                type="button"
                className={cn(
                  "mb-2 inline-flex max-w-full items-center rounded-full border px-3 py-1.5 text-left text-xs font-medium text-foreground transition-colors",
                  ADMIN_CERT_PANEL_ROW_HIGHLIGHT,
                  "hover:border-brand-lime/55 hover:bg-brand-lime/[0.16] dark:hover:border-brand-lime/45 dark:hover:bg-brand-lime/[0.18]",
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
                  ) : (
                    <SortableContext
                      items={unitsInCertListForUi!.map((u) => u._id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <ul className="space-y-1">
                        {unitsInCertListForUi!.map((u) => (
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
                ) : (
                  <ul className="space-y-2">
                    {allUnits.map((u) => (
                      <li
                        key={u._id}
                        className={cn(
                          "space-y-0",
                          unitMatchesSearch(u) ? "" : "opacity-30",
                        )}
                      >
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
                            prerequisiteCount={
                              countsByUnitId.get(u._id)?.prereqCount ?? 0
                            }
                            assignmentCount={
                              countsByUnitId.get(u._id)?.assignmentCount ?? 0
                            }
                            prereqsDrawerOpen={prereqsPanelUnitId === u._id}
                            onSelect={() => handleUnitRowClick(u._id)}
                            onEdit={() => openEditUnit(u._id)}
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
              "flex min-h-0 min-w-0 flex-col rounded-2xl border border-l-4 border-r-4 bg-brand-sky/[0.10] p-4 shadow-lg dark:bg-brand-sky/[0.12]",
              selectedDetailUnitId
                ? "border-brand-gold/40 border-l-brand-gold border-r-brand-gold dark:border-brand-gold/35 dark:border-l-brand-gold dark:border-r-brand-gold"
                : "border-brand-sky/40 border-l-brand-sky border-r-brand-sky dark:border-brand-sky/35 dark:border-l-brand-sky dark:border-r-brand-sky",
            )}
          >
            <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
              <h2 className="flex min-w-0 flex-1 items-center gap-2 text-sm font-bold text-foreground">
                <BookMarked
                  className={cn(
                    "shrink-0",
                    selectedDetailUnitId
                      ? "text-brand-gold"
                      : "text-brand-sky",
                  )}
                  size={20}
                  aria-hidden
                />
                <span className="truncate">
                  {selectedDetailUnitId &&
                  selectedDetailUnit &&
                  !libraryShowAll
                    ? `Content for ${filterUnitTitle ?? selectedDetailUnit.title}`
                    : "All Content"}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    (
                    {selectedDetailUnitId &&
                    selectedDetailUnit &&
                    !libraryShowAll
                      ? detailContent === undefined
                        ? "…"
                        : detailContent.length
                      : (allLibraryContent?.length ?? 0)}
                    )
                  </span>
                </span>
              </h2>
              <Button
                type="button"
                size="icon"
                className={cyanPlusBtn}
                aria-label="Add content to library"
                onClick={() => setAddLibraryOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="mb-1 shrink-0">
              <label
                htmlFor="admin-content-search"
                className="mb-0.5 block text-xs text-muted-foreground"
              >
                Search
              </label>
              <Input
                id="admin-content-search"
                placeholder="Filter list…"
                value={contentSearch}
                onChange={(e) => setContentSearch(e.target.value)}
                className="h-9 bg-card"
              />
            </div>
            <div className="mb-2 flex flex-wrap gap-1">
              {(
                [
                  ["all", "All"],
                  ["videos", "Videos"],
                  ["tests", "Tests"],
                  ["assignments", "Assignments"],
                  ["decks", "Decks"],
                  ["references", "References"],
                ] as const
              ).map(([id, label]) => (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant={contentCategory === id ? "default" : "outline"}
                  className="h-7 rounded-full px-2.5 text-xs"
                  onClick={() => setContentCategory(id)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <hr className="my-2 h-0 shrink-0 border-0 border-t-2 border-solid border-brand-sky/50 dark:border-brand-sky/40" />
            {selectedDetailUnitId && filterUnitTitle ? (
              <button
                type="button"
                className="mb-2 inline-flex max-w-full items-center rounded-full border border-brand-gold/40 bg-brand-gold/20 px-3 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:border-brand-gold/55 hover:bg-brand-gold/30 dark:bg-brand-gold/15 dark:hover:bg-brand-gold/25"
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
                    ) : (
                      <SortableContext
                        items={detailContentListForUi!.map((i) => i._id)}
                        strategy={verticalListSortingStrategy}
                      >
                      <ul className="space-y-1">
                        {detailContentListForUi!.map((item) => (
                          <li
                            key={item.unitContentId ?? `legacy-${item._id}`}
                          >
                            <SortableUnitContentRow
                              item={item}
                              dimmed={!contentMatchesSearch(item)}
                              selected={
                                Boolean(editContentOpen) &&
                                editContentId === item._id
                              }
                              onEdit={() => {
                                setEditContentId(item._id);
                                setEditUnitContentLinkId(item.unitContentId);
                                setEditContentTitle(item.title);
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
                                setEditContentOpen(true);
                              }}
                              onDelete={async () => {
                                try {
                                  if (item.unitContentId) {
                                    await detachContentFromUnit({
                                      unitContentId: item.unitContentId,
                                    });
                                  } else if (selectedDetailUnitId) {
                                    await legacyDetachContentFromUnit({
                                      unitId: selectedDetailUnitId,
                                      contentId: item._id,
                                    });
                                  }
                                  toast.success("Removed from unit");
                                } catch (e) {
                                  toast.error(
                                    e instanceof Error
                                      ? e.message
                                      : "Failed",
                                  );
                                }
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
                  {!allLibraryContent?.length ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      No library items. Use +.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {allLibraryContent.map((item) => (
                        <li
                          key={item._id}
                          className={cn(
                            contentMatchesSearch(item) ? "" : "opacity-30",
                          )}
                        >
                          <ContentLibraryDragRow
                            item={item}
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
                              setEditContentOpen(true);
                            }}
                            onDelete={() => {
                              if (
                                !confirm(
                                  "Delete this item from the library and remove it from all units?",
                                )
                              ) {
                                return;
                              }
                              void removeContent({ contentId: item._id })
                                .then(() => toast.success("Deleted"))
                                .catch((e) =>
                                  toast.error(
                                    e instanceof Error ? e.message : "Failed",
                                  ),
                                );
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

      <Dialog open={addCertOpen} onOpenChange={setAddCertOpen}>
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
                    summary: levelSummary.trim() || undefined,
                    description: levelDesc.trim() || "—",
                    order: n,
                  });
                  setLevelName("");
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

      <Dialog open={addUnitOpen} onOpenChange={setAddUnitOpen}>
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
                    description: unitDesc.trim() || "—",
                  });
                  setUnitTitle("");
                  setUnitDesc("");
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
                      url: "",
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
                  } else {
                    const urlMeta = urlFieldForContentKind(contentKind);
                    if (!contentUrl.trim() && urlMeta) {
                      toast.error(`${urlMeta.label} is required`);
                      return;
                    }
                    const cid = await createContent({
                      type: contentKind,
                      title: contentTitle.trim(),
                      url: contentUrl.trim() || "#",
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
                  setContentUrl("");
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
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__global__">
                        All companies (global)
                      </SelectItem>
                      {(companies ?? []).map((c) => (
                        <SelectItem key={c._id} value={c._id}>
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
                    const orderNum = Number.parseInt(certDetailOrder, 10);
                    if (Number.isNaN(orderNum)) {
                      toast.error("Display order must be a number");
                      return;
                    }
                    try {
                      await updateLevel({
                        levelId: editCertId,
                        name: certDetailName.trim(),
                        summary: certDetailSummary.trim() || undefined,
                        description: certDetailDesc.trim() || "—",
                        order: orderNum,
                        companyId: certDetailCompanyId
                          ? (certDetailCompanyId as Id<"companies">)
                          : undefined,
                        tagline: certDetailTagline.trim() || undefined,
                        thumbnailUrl:
                          certDetailThumbnail.trim() || undefined,
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
                        url: "",
                        type: editContentKind,
                        storageId: editContentStorageId ?? undefined,
                        assessment: {
                          ...editContentAssessment,
                          description:
                            editContentUrl.trim() ||
                            editContentAssessment.description,
                          questions: builtQuestions,
                        },
                      });
                    } else {
                      await updateContent({
                        contentId: editContentId,
                        title: editContentTitle.trim(),
                        url: editContentUrl.trim() || "#",
                        type: editContentKind,
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

      <Dialog open={editUnitOpen} onOpenChange={setEditUnitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit unit</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={editUnitTitle}
              onChange={(e) => setEditUnitTitle(e.target.value)}
            />
            <Textarea
              value={editUnitDesc}
              onChange={(e) => setEditUnitDesc(e.target.value)}
            />
            <Button
              onClick={async () => {
                if (!editUnitId) {
                  return;
                }
                await updateUnit({
                  unitId: editUnitId,
                  title: editUnitTitle,
                  description: editUnitDesc,
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

      <Dialog open={levelDeleteOpen} onOpenChange={setLevelDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete certification?</DialogTitle>
            <DialogDescription>
              This removes this certification and every unit inside it —
              including content, assignments, prerequisite links, and learner
              progress tied to those units. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLevelDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!editCertId}
              onClick={async () => {
                if (!editCertId) {
                  return;
                }
                try {
                  await deleteCertificationLevel({ levelId: editCertId });
                  toast.success("Certification deleted");
                  setFilterCertId((f) => (f === editCertId ? null : f));
                  setEditCertId(null);
                  setLevelDeleteOpen(false);
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

      </div>
    </TooltipProvider>
  );
}
