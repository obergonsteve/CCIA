"use client";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { ContentItemView } from "@/components/content-item-view";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
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
import { BookMarked, Eye, GraduationCap, Layers, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PrerequisiteDropEditor } from "@/components/admin/prerequisite-drop-editor";
import {
  AssignmentBuilderFields,
  ContentLibraryDragRow,
  ContentOnUnitAdminList,
  DraggableUnitPaletteItem,
  LevelRowDroppable,
  SortableLevelRow,
  SortableUnitRow,
  UnitRowContentDropTarget,
  type Q,
  type UnitAdminListRow,
} from "./admin-shared";

export default function AdminCoursesClient() {
  const companies = useQuery(api.companies.list);
  const levels = useQuery(api.certifications.listAllAdmin);
  const allUnits = useQuery(api.units.listAllAdmin);

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
  const generateUploadUrl = useMutation(api.content.generateUploadUrl);
  const allLibraryContent = useQuery(api.content.listAllAdmin);
  const createAssignment = useMutation(api.assignments.create);
  const updateAssignment = useMutation(api.assignments.update);
  const removeAssignment = useMutation(api.assignments.remove);
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

  const [certSearch, setCertSearch] = useState("");
  const [unitSearch, setUnitSearch] = useState("");
  const [contentSearch, setContentSearch] = useState("");

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
    "video" | "pdf" | "link" | "slideshow"
  >("link");
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
  const [assignDeleteOpen, setAssignDeleteOpen] = useState(false);
  const [assignDeleteId, setAssignDeleteId] =
    useState<Id<"assignments"> | null>(null);

  const [contentTitle, setContentTitle] = useState("");
  const [contentUrl, setContentUrl] = useState("");
  const [contentKind, setContentKind] = useState<
    "video" | "pdf" | "link" | "slideshow"
  >("link");
  const [contentUnitId, setContentUnitId] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const [assignUnitId, setAssignUnitId] = useState<string>("");
  const [assignId, setAssignId] = useState<string>("");
  const [assignTitle, setAssignTitle] = useState("");
  const [assignDesc, setAssignDesc] = useState("");
  const [assignPass, setAssignPass] = useState(80);
  const [questions, setQuestions] = useState<Q[]>([
    {
      id: crypto.randomUUID(),
      question: "",
      type: "multiple_choice",
      options: ["", ""],
      correctAnswer: "",
    },
  ]);

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
      if (!contentSearchLower) {
        return true;
      }
      return (
        item.title.toLowerCase().includes(contentSearchLower) ||
        item.type.toLowerCase().includes(contentSearchLower)
      );
    },
    [contentSearchLower],
  );

  useEffect(() => {
    setSelectedDetailUnitId(null);
  }, [filterCertId]);

  const detailContent = useQuery(
    api.content.listByUnit,
    selectedDetailUnitId ? { unitId: selectedDetailUnitId } : "skip",
  );

  /** All-content view + unit selected: which library items are already on that unit (for row tint). */
  const contentIdsInSelectedUnitWhenBrowsingLibrary = useMemo(() => {
    if (!selectedDetailUnitId || !libraryShowAll || detailContent === undefined) {
      return null;
    }
    return new Set(detailContent.map((c) => c._id));
  }, [selectedDetailUnitId, libraryShowAll, detailContent]);

  const detailAssignments = useQuery(
    api.assignments.listByUnit,
    selectedDetailUnitId ? { unitId: selectedDetailUnitId } : "skip",
  );

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
   * ADMIN.md: unit click filters the right column to that unit’s content.
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

  const assignmentsForUnit = useQuery(
    api.assignments.listByUnit,
    assignUnitId ? { unitId: assignUnitId as Id<"units"> } : "skip",
  );

  const loadAssignment = useCallback(
    (aid: Id<"assignments">) => {
      const a = assignmentsForUnit?.find((x) => x._id === aid);
      if (!a) {
        return;
      }
      setAssignId(a._id);
      setAssignTitle(a.title);
      setAssignDesc(a.description);
      setAssignPass(a.passingScore);
      setQuestions(
        a.questions.map((q) => ({
          id: q.id,
          question: q.question,
          type: q.type,
          options: q.options ?? ["", ""],
          correctAnswer: q.correctAnswer ?? "",
        })),
      );
    },
    [assignmentsForUnit],
  );

  const loadAssignmentFromRow = useCallback((a: Doc<"assignments">) => {
    if (selectedDetailUnitId) {
      setAssignUnitId(selectedDetailUnitId);
    }
    setAssignId(a._id);
    setAssignTitle(a.title);
    setAssignDesc(a.description);
    setAssignPass(a.passingScore);
    setQuestions(
      a.questions.map((q) => ({
        id: q.id,
        question: q.question,
        type: q.type,
        options: q.options ?? ["", ""],
        correctAnswer: q.correctAnswer ?? "",
      })),
    );
  }, [selectedDetailUnitId]);

  const resetToNewAssignment = useCallback(() => {
    setAssignId("");
    setAssignTitle("");
    setAssignDesc("");
    setAssignPass(80);
    setQuestions([
      {
        id: crypto.randomUUID(),
        question: "",
        type: "multiple_choice",
        options: ["", ""],
        correctAnswer: "",
      },
    ]);
  }, []);

  useEffect(() => {
    if (!selectedDetailUnitId) {
      setContentUnitId("");
      return;
    }
    setAssignUnitId(selectedDetailUnitId);
    setContentUnitId(selectedDetailUnitId);
    resetToNewAssignment();
  }, [selectedDetailUnitId, resetToNewAssignment]);

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
    setSelectedDetailUnitId((prev) => (prev === unitId ? null : unitId));
    setLibraryShowAll(false);
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

  const previewDoc: Doc<"contentItems"> | null =
    contentTitle && contentUnitId
      ? ({
          _id: "preview_content" as Id<"contentItems">,
          _creationTime: 0,
          type: contentKind,
          title: contentTitle,
          url: contentUrl || "#",
        } as Doc<"contentItems">)
      : null;

  const onUnifiedDragEnd = useCallback(
    async (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over) {
        return;
      }
      const activeStr = String(active.id);
      const overStr = String(over.id);

      if (activeStr.startsWith("palette-content:")) {
        const cid = activeStr.slice("palette-content:".length) as Id<
          "contentItems"
        >;
        if (overStr.startsWith("unit-content-drop-")) {
          const uid = overStr.slice("unit-content-drop-".length) as Id<"units">;
          try {
            await attachContentToUnit({ unitId: uid, contentId: cid });
            toast.success("Attached to unit");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed");
          }
        }
        return;
      }

      if (activeStr.startsWith("palette-unit:")) {
        const uid = activeStr.slice("palette-unit:".length) as Id<"units">;
        if (overStr.startsWith("level-units-add-")) {
          const lid = overStr.slice("level-units-add-".length) as Id<
            "certificationLevels"
          >;
          try {
            await addUnitToLevel({ levelId: lid, unitId: uid });
            toast.success("Unit added to certification");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed");
          }
        }
        return;
      }

      if (levels) {
        const oldIndex = levels.findIndex((l) => l._id === active.id);
        const newIndex = levels.findIndex((l) => l._id === over.id);
        if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
          const ordered = arrayMove(levels, oldIndex, newIndex).map(
            (l) => l._id,
          );
          try {
            await reorderLevels({ orderedIds: ordered });
            toast.success("Order updated");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Reorder failed");
          }
          return;
        }
      }

      if (
        filterCertId &&
        !centreUnitsShowAll &&
        unitsInFilteredCert &&
        unitsInFilteredCert.length
      ) {
        if (active.id === over.id) {
          return;
        }
        const oldIndex = unitsInFilteredCert.findIndex((u) => u._id === active.id);
        const newIndex = unitsInFilteredCert.findIndex((u) => u._id === over.id);
        if (oldIndex < 0 || newIndex < 0) {
          return;
        }
        const ordered = arrayMove(unitsInFilteredCert, oldIndex, newIndex).map(
          (u) => u._id,
        );
        try {
          await reorderUnitsInLevel({
            levelId: filterCertId,
            orderedUnitIds: ordered,
          });
          toast.success("Units reordered");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Reorder failed");
        }
      }
    },
    [
      levels,
      filterCertId,
      centreUnitsShowAll,
      unitsInFilteredCert,
      attachContentToUnit,
      addUnitToLevel,
      reorderLevels,
      reorderUnitsInLevel,
    ],
  );

  function addQuestion() {
    setQuestions((q) => [
      ...q,
      {
        id: crypto.randomUUID(),
        question: "",
        type: "multiple_choice",
        options: ["", ""],
        correctAnswer: "",
      },
    ]);
  }

  function updateQuestion(i: number, patch: Partial<Q>) {
    setQuestions((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

  function removeQuestion(i: number) {
    setQuestions((prev) => prev.filter((_, j) => j !== i));
  }

  async function saveAssignment() {
    if (!assignUnitId) {
      toast.error("Select a unit");
      return;
    }
    const built = questions.map((q) => ({
      id: q.id,
      question: q.question,
      type: q.type,
      options:
        q.type === "multiple_choice"
          ? q.options.filter((o) => o.trim())
          : undefined,
      correctAnswer: q.correctAnswer.trim() || undefined,
    }));
    try {
      if (assignId) {
        await updateAssignment({
          assignmentId: assignId as Id<"assignments">,
          title: assignTitle,
          description: assignDesc,
          passingScore: assignPass,
          questions: built,
        });
        toast.success("Assignment updated");
      } else {
        await createAssignment({
          unitId: assignUnitId as Id<"units">,
          title: assignTitle || "Assessment",
          description: assignDesc || "—",
          passingScore: assignPass,
          questions: built,
        });
        toast.success("Assignment created");
        setAssignTitle("");
        setAssignDesc("");
        setQuestions([
          {
            id: crypto.randomUUID(),
            question: "",
            type: "multiple_choice",
            options: ["", ""],
            correctAnswer: "",
          },
        ]);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  const cyanPlusBtn =
    "h-7 w-7 shrink-0 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-cyan-600 dark:hover:bg-cyan-500";

  return (
    <div className="min-h-0 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Courses</h1>
        <p className="text-sm text-muted-foreground">
          Construct and maintain Certifications, Units and Content.
        </p>
      </div>

      <DndContext
        sensors={mainSensors}
        collisionDetection={closestCenter}
        onDragEnd={(e) => void onUnifiedDragEnd(e)}
      >
        {/* Layout matches GritHub app/(dashboard)/dashboard/admin/company-maintenance/page.tsx */}
        <div className="grid min-h-0 grid-cols-1 gap-2 md:h-[min(calc((100dvh-14rem)*1.5),1200px)] md:grid-cols-3">
          <div className="flex min-h-0 flex-col rounded-2xl border border-brand-lime/40 border-l-4 border-r-4 border-l-brand-lime border-r-brand-lime bg-brand-lime/[0.11] p-4 shadow-lg dark:border-brand-lime/35 dark:border-l-brand-lime dark:border-r-brand-lime dark:bg-brand-lime/[0.14]">
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
            <hr className="my-2 shrink-0 border-t border-brand-lime/35 dark:border-brand-lime/25" />
            {!filterCertId ? (
              <p className="mb-3 shrink-0 text-sm text-muted-foreground">
                Drop a unit from the centre onto a certification to add it to
                that track.
              </p>
            ) : null}
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto scrollbar-panel">
              {(levels ?? []).length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No certifications. Use +.
                </p>
              ) : (
                <SortableContext
                  items={(levels ?? []).map((l) => l._id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="space-y-1">
                    {(levels ?? []).map((l) => (
                      <li
                        key={l._id}
                        className={cn(
                          levelMatchesSearch(l) ? "" : "opacity-30",
                        )}
                      >
                        <LevelRowDroppable levelId={l._id}>
                          <SortableLevelRow
                            level={l}
                            selected={filterCertId === l._id}
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

          <div className="flex min-h-0 flex-col rounded-2xl border border-brand-gold/40 border-l-4 border-r-4 border-l-brand-gold border-r-brand-gold bg-brand-gold/[0.14] p-4 shadow-lg dark:border-brand-gold/35 dark:border-l-brand-gold dark:border-r-brand-gold dark:bg-brand-gold/[0.12]">
            <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
              <h2 className="flex min-w-0 flex-1 items-center gap-2 text-sm font-bold text-foreground">
                <Layers
                  className="shrink-0 text-brand-gold"
                  size={20}
                  aria-hidden
                />
                <span className="truncate">
                  {filterCertId && !centreUnitsShowAll
                    ? filterCertName
                      ? `${filterCertName} Units`
                      : "Units"
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
            {filterCertId && filterCertName ? (
              <button
                type="button"
                className="mb-1 inline-flex max-w-full items-center rounded-full border border-brand-gold/40 bg-brand-gold/20 px-3 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:border-brand-gold/55 hover:bg-brand-gold/30 dark:bg-brand-gold/15 dark:hover:bg-brand-gold/25"
                onClick={() => setCentreUnitsShowAll((v) => !v)}
              >
                {centreUnitsShowAll
                  ? `Show ${filterCertName} units`
                  : "Show all units"}
              </button>
            ) : null}
            <p className="mb-3 shrink-0 text-sm text-muted-foreground">
              Drag units onto certifications or library items onto units (when no
              unit is selected in this column).
            </p>
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
                      items={unitsInFilteredCert.map((u) => u._id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <ul className="space-y-1">
                        {unitsInFilteredCert.map((u) => (
                          <li key={u._id}>
                            <SortableUnitRow
                              unit={u}
                              selected={selectedDetailUnitId === u._id}
                              onSelect={() => handleUnitRowClick(u._id)}
                              onEdit={() => openEditUnit(u._id)}
                              onRemoveFromCert={() => {
                                setDetachFromCertUnitId(u._id);
                                setDetachFromCertOpen(true);
                              }}
                            />
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
                          "space-y-1",
                          unitMatchesSearch(u) ? "" : "opacity-30",
                        )}
                      >
                        <UnitRowContentDropTarget
                          unitId={u._id}
                          disabled={
                            Boolean(selectedDetailUnitId) && !libraryShowAll
                          }
                        >
                          <DraggableUnitPaletteItem
                            unit={u}
                            selected={selectedDetailUnitId === u._id}
                            inSelectedCert={
                              unitIdsInSelectedCertWhenBrowsingAll?.has(u._id) ??
                              false
                            }
                            onSelect={() => handleUnitRowClick(u._id)}
                            onEdit={() => openEditUnit(u._id)}
                            onDelete={() => {
                              setUnitDeleteId(u._id);
                              setUnitDeleteOpen(true);
                            }}
                          />
                        </UnitRowContentDropTarget>
                      </li>
                    ))}
                  </ul>
                )}

                {selectedDetailUnitId && selectedDetailUnit ? (
                  <div className="space-y-2 border-t border-border pt-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Prerequisites for selected unit
                    </p>
                    <PrerequisiteDropEditor
                      targetUnitId={selectedDetailUnitId}
                      targetTitle={selectedDetailUnit.title}
                      allUnits={allUnits}
                    />
                  </div>
                ) : null}
            </div>
          </div>

          <div className="flex min-h-0 flex-col rounded-2xl border border-brand-sky/40 border-l-4 border-r-4 border-l-brand-sky border-r-brand-sky bg-brand-sky/[0.10] p-4 shadow-lg dark:border-brand-sky/35 dark:border-l-brand-sky dark:border-r-brand-sky dark:bg-brand-sky/[0.12]">
            <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
              <h2 className="flex min-w-0 flex-1 items-center gap-2 text-sm font-bold text-foreground">
                <BookMarked
                  className="shrink-0 text-brand-sky"
                  size={20}
                  aria-hidden
                />
                <span className="truncate">
                  {selectedDetailUnitId &&
                  selectedDetailUnit &&
                  !libraryShowAll
                    ? filterUnitTitle
                      ? `${filterUnitTitle} Content`
                      : "Content"
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
              <div className="flex shrink-0 items-center gap-1">
                {selectedDetailUnitId &&
                selectedDetailUnit &&
                !libraryShowAll ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => openEditUnit(selectedDetailUnitId)}
                  >
                    Edit unit
                  </Button>
                ) : null}
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
            {selectedDetailUnitId && filterUnitTitle ? (
              <button
                type="button"
                className="mb-1 inline-flex max-w-full items-center rounded-full border border-brand-sky/40 bg-brand-sky/15 px-3 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:border-brand-sky/55 hover:bg-brand-sky/25 dark:bg-brand-sky/12 dark:hover:bg-brand-sky/22"
                onClick={() => setLibraryShowAll((v) => !v)}
              >
                {libraryShowAll
                  ? `Show ${filterUnitTitle} content`
                  : "Show all content"}
              </button>
            ) : null}
            <hr className="my-2 shrink-0 border-t border-brand-sky/35 dark:border-brand-sky/25" />
            {!selectedDetailUnitId || libraryShowAll ? (
              <p className="mb-3 shrink-0 text-sm text-muted-foreground">
                Drag an item from this list onto a unit in the centre to attach
                it to that unit.
              </p>
            ) : (
              <p className="mb-3 shrink-0 text-sm text-muted-foreground">
                Publish new lessons below, or use{" "}
                <span className="font-medium text-foreground">
                  Show all content
                </span>{" "}
                to drag library items onto a unit in the centre column.
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
                        No lessons attached. Publish below or use{" "}
                        <span className="font-medium text-foreground">
                          Show all content
                        </span>{" "}
                        to drag items onto this unit.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {detailContent.map((item) => (
                          <li
                            key={item.unitContentId ?? `legacy-${item._id}`}
                          >
                            <ContentLibraryDragRow
                              item={item}
                              selected={
                                Boolean(editContentOpen) &&
                                editContentId === item._id
                              }
                              onEdit={() => {
                                setEditContentId(item._id);
                                setEditUnitContentLinkId(item.unitContentId);
                                setEditContentTitle(item.title);
                                setEditContentUrl(item.url);
                                setEditContentKind(item.type);
                                setEditContentOrder(String(item.order));
                                setEditContentStorageId(
                                  item.storageId ?? null,
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
                    )}
                    <div className="space-y-3 border-t border-border pt-3">
                      <div className="grid sm:grid-cols-2 gap-3 rounded-lg border p-4 bg-muted/25">
                        <p className="text-sm font-medium sm:col-span-2">
                          Add lesson to this unit
                        </p>
                        <Input
                          className="sm:col-span-2"
                          placeholder="Title"
                          value={contentTitle}
                          onChange={(e) => setContentTitle(e.target.value)}
                        />
                        <Select
                          value={contentKind}
                          onValueChange={(v) =>
                            setContentKind(
                              (v ?? "link") as typeof contentKind,
                            )
                          }
                        >
                          <SelectTrigger className="sm:col-span-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="link">link</SelectItem>
                            <SelectItem value="video">video</SelectItem>
                            <SelectItem value="pdf">pdf</SelectItem>
                            <SelectItem value="slideshow">slideshow</SelectItem>
                          </SelectContent>
                        </Select>
                        <Textarea
                          className="sm:col-span-2"
                          placeholder="URL(s) — slideshow: JSON array or | separated"
                          value={contentUrl}
                          onChange={(e) => setContentUrl(e.target.value)}
                        />
                        <div className="flex flex-wrap gap-2 sm:col-span-2">
                          <Dialog
                            open={previewOpen}
                            onOpenChange={setPreviewOpen}
                          >
                            <DialogTrigger
                              className={cn(
                                buttonVariants({ variant: "outline" }),
                                "inline-flex gap-1 items-center",
                              )}
                            >
                              <Eye className="h-4 w-4" />
                              Preview
                            </DialogTrigger>
                            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Learner preview</DialogTitle>
                              </DialogHeader>
                              {previewDoc ? (
                                <ContentItemView item={previewDoc} />
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  Add a title first.
                                </p>
                              )}
                            </DialogContent>
                          </Dialog>
                        </div>
                        <Input
                          className="sm:col-span-2"
                          type="file"
                          accept="video/*,application/pdf"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !selectedDetailUnitId) {
                              toast.error("Select a unit and choose a file");
                              return;
                            }
                            const postUrl = await generateUploadUrl();
                            const res = await fetch(postUrl, {
                              method: "POST",
                              headers: {
                                "Content-Type":
                                  file.type || "application/octet-stream",
                              },
                              body: file,
                            });
                            const json = (await res.json()) as {
                              storageId: string;
                            };
                            const kind = file.type.startsWith("video")
                              ? "video"
                              : "pdf";
                            setContentKind(kind);
                            const cid = await createContent({
                              type: kind,
                              title: contentTitle || file.name,
                              url: "#",
                              storageId: json.storageId as Id<"_storage">,
                            });
                            await attachContentToUnit({
                              unitId: selectedDetailUnitId,
                              contentId: cid,
                            });
                            toast.success("Uploaded and attached");
                          }}
                        />
                        <Button
                          type="button"
                          className="sm:col-span-2 w-fit"
                          size="sm"
                          onClick={async () => {
                            if (!selectedDetailUnitId || !contentTitle) {
                              toast.error("Title required");
                              return;
                            }
                            try {
                              const cid = await createContent({
                                type: contentKind,
                                title: contentTitle,
                                url: contentUrl || "#",
                              });
                              await attachContentToUnit({
                                unitId: selectedDetailUnitId,
                                contentId: cid,
                              });
                              toast.success("Lesson created and attached");
                              setContentTitle("");
                              setContentUrl("");
                            } catch (e) {
                              toast.error(
                                e instanceof Error ? e.message : "Failed",
                              );
                            }
                          }}
                        >
                          Publish lesson
                        </Button>
                      </div>
                    </div>
                    <div className="border-t border-border pt-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Assignments
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={resetToNewAssignment}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          New assignment
                        </Button>
                      </div>
                      {(detailAssignments ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground py-6 text-center border rounded-md">
                          No assignments yet.
                        </p>
                      ) : (
                        <ul className="border rounded-md divide-y max-h-40 overflow-y-auto text-sm mb-3">
                          {(detailAssignments ?? []).map((a) => (
                            <li
                              key={a._id}
                              className="flex items-center gap-2 px-3 py-2"
                            >
                              <span className="flex-1 truncate font-medium">
                                {a.title}
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => loadAssignmentFromRow(a)}
                              >
                                Edit
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  setAssignDeleteId(a._id);
                                  setAssignDeleteOpen(true);
                                }}
                              >
                                Remove
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <AssignmentBuilderFields
                        showUnitSelect={false}
                        allUnits={allUnits}
                        assignUnitId={assignUnitId}
                        setAssignUnitId={setAssignUnitId}
                        setAssignId={setAssignId}
                        resetToNewAssignment={resetToNewAssignment}
                        assignmentsForUnit={assignmentsForUnit}
                        assignId={assignId}
                        loadAssignment={loadAssignment}
                        assignTitle={assignTitle}
                        setAssignTitle={setAssignTitle}
                        assignDesc={assignDesc}
                        setAssignDesc={setAssignDesc}
                        assignPass={assignPass}
                        setAssignPass={setAssignPass}
                        questions={questions}
                        addQuestion={addQuestion}
                        updateQuestion={updateQuestion}
                        removeQuestion={removeQuestion}
                        saveAssignment={saveAssignment}
                      />
                    </div>
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
                              setEditContentUrl(item.url);
                              setEditContentKind(item.type);
                              setEditContentOrder(String(item.order ?? 0));
                              setEditContentStorageId(
                                item.storageId ?? null,
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
      </DndContext>

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

      <Dialog open={addLibraryOpen} onOpenChange={setAddLibraryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add to library</DialogTitle>
            <DialogDescription>
              Shared content you can drag onto units in the centre column.
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
                onValueChange={(v) =>
                  setContentKind((v ?? "link") as typeof contentKind)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="link">link</SelectItem>
                  <SelectItem value="video">video</SelectItem>
                  <SelectItem value="pdf">pdf</SelectItem>
                  <SelectItem value="slideshow">slideshow</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-lib-url">URL(s)</Label>
              <Textarea
                id="add-lib-url"
                placeholder="URL(s)"
                value={contentUrl}
                onChange={(e) => setContentUrl(e.target.value)}
                className="min-h-[72px]"
              />
            </div>
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
                  await createContent({
                    type: contentKind,
                    title: contentTitle.trim(),
                    url: contentUrl.trim() || "#",
                  });
                  setContentTitle("");
                  setContentUrl("");
                  setAddLibraryOpen(false);
                  toast.success("Saved to library");
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
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit lesson</DialogTitle>
            <DialogDescription>
              Update title, type, URL, and sort order for this content item.
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
                onValueChange={(v) =>
                  setEditContentKind((v ?? "link") as typeof editContentKind)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="link">link</SelectItem>
                  <SelectItem value="video">video</SelectItem>
                  <SelectItem value="pdf">pdf</SelectItem>
                  <SelectItem value="slideshow">slideshow</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ec-url">URL</Label>
              <Textarea
                id="ec-url"
                value={editContentUrl}
                onChange={(e) => setEditContentUrl(e.target.value)}
                className="min-h-[72px]"
              />
            </div>
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
                    await updateContent({
                      contentId: editContentId,
                      title: editContentTitle.trim(),
                      url: editContentUrl.trim() || "#",
                      type: editContentKind,
                      storageId: editContentStorageId ?? undefined,
                    });
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
                  if (assignUnitId === unitDeleteId) {
                    setAssignUnitId("");
                    resetToNewAssignment();
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

      <Dialog open={assignDeleteOpen} onOpenChange={setAssignDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove assignment?</DialogTitle>
            <DialogDescription>
              Deletes this assessment. Learners&apos; past quiz rows for it are
              removed as well.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAssignDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!assignDeleteId}
              onClick={async () => {
                if (!assignDeleteId) {
                  return;
                }
                try {
                  await removeAssignment({ assignmentId: assignDeleteId });
                  if (assignId === assignDeleteId) {
                    resetToNewAssignment();
                  }
                  toast.success("Assignment removed");
                  setAssignDeleteOpen(false);
                  setAssignDeleteId(null);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Remove assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
