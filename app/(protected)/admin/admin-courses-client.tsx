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
  CertUnitsAddDropZone,
  ContentLibraryDragRow,
  ContentOnUnitAdminList,
  DraggableUnitPaletteItem,
  LevelRowDroppable,
  SortableLevelRow,
  SortableUnitRow,
  UnitContentDropZone,
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

  /** Certification selected for editing (left column details). */
  const [editCertId, setEditCertId] =
    useState<Id<"certificationLevels"> | null>(null);
  /** When set, centre column lists units in this cert; when null, all units. */
  const [filterCertId, setFilterCertId] =
    useState<Id<"certificationLevels"> | null>(null);
  const [selectedDetailUnitId, setSelectedDetailUnitId] =
    useState<Id<"units"> | null>(null);

  const [certSearch, setCertSearch] = useState("");
  const [unitSearch, setUnitSearch] = useState("");
  const [contentSearch, setContentSearch] = useState("");

  const [levelName, setLevelName] = useState("");
  const [levelDesc, setLevelDesc] = useState("");
  const [certDetailName, setCertDetailName] = useState("");
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

  const certPaletteUnits = useMemo(() => {
    if (!allUnits || !filterCertId || !unitsInFilteredCert) {
      return [];
    }
    const inCert = new Set(unitsInFilteredCert.map((u) => u._id));
    return allUnits.filter((u) => !inCert.has(u._id));
  }, [allUnits, filterCertId, unitsInFilteredCert]);

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
        l.description.toLowerCase().includes(certSearchLower)
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

  const selectedCert = useMemo(() => {
    if (!editCertId || !levels) {
      return null;
    }
    return levels.find((l) => l._id === editCertId) ?? null;
  }, [editCertId, levels]);

  useEffect(() => {
    if (!selectedCert) {
      return;
    }
    setCertDetailName(selectedCert.name);
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

  function handleCertRowClick(id: Id<"certificationLevels">) {
    setEditCertId(id);
    setFilterCertId((prev) => (prev === id ? null : id));
  }

  function handleUnitRowClick(unitId: Id<"units">) {
    setSelectedDetailUnitId((prev) => (prev === unitId ? null : unitId));
  }

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

      if (filterCertId && unitsInFilteredCert && unitsInFilteredCert.length) {
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

  return (
    <div className="space-y-4 min-h-0">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Courses</h1>
        <p className="text-sm text-muted-foreground">
          Certifications → units → content. Seed or reset data from{" "}
          <strong className="text-foreground">Training data</strong> in the menu.
        </p>
      </div>

      <DndContext
        sensors={mainSensors}
        collisionDetection={closestCenter}
        onDragEnd={(e) => void onUnifiedDragEnd(e)}
      >
        {/* Fixed-height panes with internal scroll (same idea as GritHub company-maintenance). */}
        <div className="grid min-h-0 grid-cols-1 gap-2 md:grid-cols-[1fr_1.15fr_1fr] md:h-[min(calc((100dvh-11rem)*1.35),1080px)]">
          <div
            className={cn(
              "flex min-h-0 flex-col rounded-2xl border p-4 shadow-sm",
              "bg-brand-lime/[0.05] border-brand-lime/20 dark:bg-brand-lime/[0.07] dark:border-brand-lime/25",
            )}
          >
            <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <GraduationCap className="h-4 w-4 shrink-0 text-brand-lime" />
                Certifications
                <span className="font-normal text-muted-foreground">
                  ({levels?.length ?? 0})
                </span>
              </h2>
            </div>
            <p className="mb-3 shrink-0 text-xs text-muted-foreground">
              Click a row to select and filter the centre column; click again to
              clear. Drag units onto a row when the centre shows all units.
            </p>
            <div className="shrink-0 space-y-2">
              <Input
                placeholder="Search certifications…"
                value={certSearch}
                onChange={(e) => setCertSearch(e.target.value)}
              />
              <div className="space-y-2 rounded-lg border border-border/60 bg-background/60 p-3">
                <Input
                  placeholder="New certification name"
                  value={levelName}
                  onChange={(e) => setLevelName(e.target.value)}
                />
                <Textarea
                  placeholder="Description"
                  value={levelDesc}
                  onChange={(e) => setLevelDesc(e.target.value)}
                  className="min-h-[56px]"
                />
                <Button
                  size="sm"
                  type="button"
                  className="w-full"
                  onClick={async () => {
                    if (!levelName.trim()) {
                      toast.error("Enter a name");
                      return;
                    }
                    const n = levels?.length ?? 0;
                    try {
                      const newId = await createLevel({
                        name: levelName.trim(),
                        description: levelDesc.trim() || "—",
                        order: n,
                      });
                      setLevelName("");
                      setLevelDesc("");
                      setEditCertId(newId);
                      setFilterCertId(newId);
                      toast.success("Certification created");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Failed");
                    }
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add certification
                </Button>
              </div>
            </div>
            <hr className="my-3 shrink-0 border-border/60" />
            {filterCertId ? (
              <button
                type="button"
                className="mb-2 inline-flex max-w-full shrink-0 items-center rounded-full border border-brand-lime/30 bg-brand-lime/10 px-3 py-1 text-left text-xs font-medium text-foreground transition-colors hover:bg-brand-lime/15"
                onClick={() => setFilterCertId(null)}
              >
                Showing one certification — click to show all units
              </button>
            ) : (
              <p className="mb-2 shrink-0 text-xs text-muted-foreground">
                Centre column lists <span className="font-medium text-foreground">all</span>{" "}
                units.
              </p>
            )}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {(levels ?? []).length === 0 ? (
                <p className="rounded-md border py-8 text-center text-sm text-muted-foreground">
                  No certifications yet. Add one above.
                </p>
              ) : (
                <div className="rounded-md border border-border/60 bg-background/40 p-1">
                  <SortableContext
                    items={(levels ?? []).map((l) => l._id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul className="space-y-1">
                      {(levels ?? []).map((l) => (
                        <li
                          key={l._id}
                          className={cn(
                            "p-0.5",
                            levelMatchesSearch(l) ? "" : "opacity-35",
                          )}
                        >
                          <LevelRowDroppable levelId={l._id}>
                            <SortableLevelRow
                              level={l}
                              selected={editCertId === l._id}
                              onSelect={() => handleCertRowClick(l._id)}
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
                </div>
              )}
              {editCertId && selectedCert ? (
                <div className="space-y-4 border-t border-border/60 pt-4">
                  <p className="text-sm font-medium">Certification details</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="cert-name">Name</Label>
                      <Input
                        id="cert-name"
                        value={certDetailName}
                        onChange={(e) => setCertDetailName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="cert-desc">Description</Label>
                      <Textarea
                        id="cert-desc"
                        value={certDetailDesc}
                        onChange={(e) => setCertDetailDesc(e.target.value)}
                        className="min-h-[100px]"
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
                  <Button
                    type="button"
                    size="sm"
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
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                  >
                    Save certification
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          <div
            className={cn(
              "flex min-h-0 flex-col rounded-2xl border border-l-4 border-r-4 p-4 shadow-sm",
              "border-brand-gold/25 border-l-brand-gold/45 border-r-brand-gold/45 bg-muted/20",
            )}
          >
            <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Layers className="h-5 w-5 shrink-0 text-brand-gold" />
                Units
                <span className="text-sm font-normal text-muted-foreground">
                  ({allUnits?.length ?? 0})
                </span>
              </h2>
            </div>
            <p className="mb-3 shrink-0 text-xs text-muted-foreground">
              Drag onto a certification when all units are visible here. Select a
              unit to edit lessons and assessments in the right column.
            </p>
            <div className="shrink-0 space-y-3">
              <Input
                placeholder="Search units…"
                value={unitSearch}
                onChange={(e) => setUnitSearch(e.target.value)}
              />
              <div className="grid gap-2 rounded-lg border border-border/60 bg-background/60 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  New unit
                </p>
                <Input
                  placeholder="Title"
                  value={unitTitle}
                  onChange={(e) => setUnitTitle(e.target.value)}
                />
                <Textarea
                  placeholder="Description"
                  value={unitDesc}
                  onChange={(e) => setUnitDesc(e.target.value)}
                  className="min-h-[64px]"
                />
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
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
                      toast.success("Unit created");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Failed");
                    }
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create unit
                </Button>
              </div>
            </div>

            <hr className="my-3 shrink-0 border-border/60" />
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                {filterCertId && unitsInFilteredCert ? (
                  <div className="space-y-3">
                    <CertUnitsAddDropZone levelId={filterCertId} />
                    <div className="rounded-md border border-border/60 bg-background/40 p-1">
                      <SortableContext
                        items={unitsInFilteredCert.map((u) => u._id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <ul className="space-y-1 p-1">
                          {unitsInFilteredCert.map((u) => (
                            <li key={u._id} className="p-0.5">
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
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Not in this certification — drag up or onto a cert row
                      </p>
                      <div className="rounded-md border border-border/60 bg-background/40 p-2">
                        <div className="space-y-1.5">
                          {certPaletteUnits.length === 0 ? (
                            <p className="py-4 text-center text-sm text-muted-foreground">
                              Every unit is already in this certification.
                            </p>
                          ) : (
                            certPaletteUnits.map((u) => (
                              <DraggableUnitPaletteItem key={u._id} unit={u} />
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-border/60 bg-background/40 p-1">
                    {!allUnits?.length ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        No units yet. Create one above.
                      </p>
                    ) : (
                      <ul className="divide-y divide-border/60 p-1">
                        {allUnits.map((u) => (
                          <li
                            key={u._id}
                            className={cn(
                              "space-y-2 px-2 py-2",
                              unitMatchesSearch(u) ? "" : "opacity-35",
                            )}
                          >
                            <div className="flex flex-wrap items-start gap-2">
                              <DraggableUnitPaletteItem unit={u} />
                              <button
                                type="button"
                                className={cn(
                                  "-m-1 min-w-[120px] flex-1 rounded-md px-2 py-1 text-left text-sm transition-colors",
                                  selectedDetailUnitId === u._id
                                    ? "bg-brand-lime/15 ring-1 ring-brand-lime/40"
                                    : "hover:bg-muted/60",
                                )}
                                onClick={() => handleUnitRowClick(u._id)}
                              >
                                <div className="font-medium">{u.title}</div>
                                <div className="truncate text-xs text-muted-foreground">
                                  {u.certificationSummary}
                                </div>
                              </button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => openEditUnit(u._id)}
                              >
                                Edit
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  setUnitDeleteId(u._id);
                                  setUnitDeleteOpen(true);
                                }}
                              >
                                Delete
                              </Button>
                            </div>
                            {!selectedDetailUnitId ? (
                              <UnitContentDropZone unitId={u._id} />
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {selectedDetailUnitId && selectedDetailUnit ? (
                  <div className="space-y-2 border-t border-border/60 pt-4">
                    <p className="text-sm font-medium">Prerequisites</p>
                    <PrerequisiteDropEditor
                      targetUnitId={selectedDetailUnitId}
                      targetTitle={selectedDetailUnit.title}
                      allUnits={allUnits}
                    />
                  </div>
                ) : null}
              </div>
            </div>

          <div
            className={cn(
              "flex min-h-0 flex-col rounded-2xl border p-4 shadow-sm",
              "border-brand-sky/25 bg-brand-sky/[0.04] dark:bg-brand-sky/[0.06]",
            )}
          >
            <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <BookMarked className="h-4 w-4 shrink-0 text-brand-sky" />
                Content
                <span className="font-normal text-muted-foreground">
                  ({allLibraryContent?.length ?? 0} in library)
                </span>
              </h2>
            </div>
            <p className="mb-3 shrink-0 text-xs text-muted-foreground">
              No unit selected: build the shared library and drag into units in
              the centre. With a unit selected, manage that unit&apos;s lessons
              here.
            </p>
            <div className="shrink-0">
              <Input
                placeholder="Search library…"
                value={contentSearch}
                onChange={(e) => setContentSearch(e.target.value)}
              />
            </div>
            <hr className="my-3 shrink-0 border-border/60" />
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              {!selectedDetailUnitId || !selectedDetailUnit ? (
                <>
                  <div className="space-y-3 rounded-lg border border-border/60 bg-background/60 p-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      Add to library
                    </p>
                    <Input
                      placeholder="Title"
                      value={contentTitle}
                      onChange={(e) => setContentTitle(e.target.value)}
                    />
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
                    <Textarea
                      placeholder="URL(s)"
                      value={contentUrl}
                      onChange={(e) => setContentUrl(e.target.value)}
                      className="min-h-[72px]"
                    />
                    <Button
                      type="button"
                      size="sm"
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
                          toast.success("Saved to library");
                        } catch (e) {
                          toast.error(
                            e instanceof Error ? e.message : "Failed",
                          );
                        }
                      }}
                    >
                      Save to library
                    </Button>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Library (drag to a unit in the centre →)
                    </p>
                    {!allLibraryContent?.length ? (
                      <p className="rounded-md border border-border/60 py-8 text-center text-sm text-muted-foreground">
                        No content yet.
                      </p>
                    ) : (
                      <div className="space-y-1.5 rounded-md border border-border/60 bg-background/40 p-2">
                        {allLibraryContent.map((item) => (
                          <div
                            key={item._id}
                            className={cn(
                              "flex items-stretch gap-1 overflow-hidden rounded-md border bg-card/50",
                              contentMatchesSearch(item) ? "" : "opacity-35",
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <ContentLibraryDragRow item={item} />
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="shrink-0 rounded-none text-destructive hover:text-destructive"
                              onClick={async () => {
                                if (
                                  !confirm(
                                    "Delete this item from the library and remove it from all units?",
                                  )
                                ) {
                                  return;
                                }
                                try {
                                  await removeContent({
                                    contentId: item._id,
                                  });
                                  toast.success("Deleted");
                                } catch (e) {
                                  toast.error(
                                    e instanceof Error ? e.message : "Failed",
                                  );
                                }
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-6 pb-4 pr-1">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold">
                          {selectedDetailUnit.title}
                        </h3>
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 text-primary"
                          onClick={() => openEditUnit(selectedDetailUnitId)}
                        >
                          Edit unit
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Click the unit in the centre again to return to the full
                        library.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Lessons (content)
                      </p>
                      {(detailContent ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 border rounded-md text-center">
                          No lessons attached. Publish below or drag from the
                          library (clear unit selection first).
                        </p>
                      ) : (
                        <ul className="border rounded-md divide-y max-h-52 overflow-y-auto text-sm">
                          {(detailContent ?? []).map((item) => (
                            <li
                              key={item.unitContentId ?? `legacy-${item._id}`}
                              className="flex items-center gap-2 px-3 py-2"
                            >
                              <span className="flex-1 min-w-0 truncate">
                                <span className="font-medium">{item.title}</span>
                                <span className="text-muted-foreground text-xs ml-2">
                                  {item.type}
                                </span>
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => {
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
                              >
                                Edit
                              </Button>
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
                                    } else if (selectedDetailUnitId) {
                                      await legacyDetachContentFromUnit({
                                        unitId: selectedDetailUnitId,
                                        contentId: item._id,
                                      });
                                    }
                                    toast.success("Removed from unit");
                                  } catch (e) {
                                    toast.error(
                                      e instanceof Error ? e.message : "Failed",
                                    );
                                  }
                                }}
                              >
                                Remove
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
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
                    <div>
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
              )}
            </div>
          </div>
        </div>
      </DndContext>

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

      <Dialog open={detachFromCertOpen} onOpenChange={setDetachFromCertOpen}>
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
