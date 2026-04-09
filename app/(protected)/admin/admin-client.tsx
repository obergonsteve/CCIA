"use client";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { ContentItemView } from "@/components/content-item-view";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAction, useMutation, useQuery } from "convex/react";
import { Database, Eye, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PrerequisiteDropEditor } from "@/components/admin/prerequisite-drop-editor";

function SortableLevelRow({
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

function SortableUnitRow({
  unit,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  unit: Doc<"units">;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
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
          title="Delete unit"
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

type Q = {
  id: string;
  question: string;
  type: "multiple_choice" | "text";
  options: string[];
  correctAnswer: string;
};

function AssignmentBuilderFields({
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
  allUnits: Doc<"units">[] | undefined;
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

export default function AdminPage() {
  const companies = useQuery(api.companies.list);
  const users = useQuery(api.users.listAll);
  const levels = useQuery(api.certifications.listAllAdmin);
  const allUnits = useQuery(api.units.listAllAdmin);

  const createCompany = useMutation(api.companies.create);
  const updateCompany = useMutation(api.companies.update);
  const removeCompany = useMutation(api.companies.remove);
  const adminUpdateUserProfile = useMutation(api.users.adminUpdateProfile);
  const adminDeleteUser = useMutation(api.users.adminDelete);
  const adminSetPassword = useAction(api.auth.adminSetPassword);
  const createLevel = useMutation(api.certifications.create);
  const updateLevel = useMutation(api.certifications.update);
  const reorderLevels = useMutation(api.certifications.reorderLevels);
  const createUnit = useMutation(api.units.create);
  const updateUnit = useMutation(api.units.update);
  const reorderUnits = useMutation(api.units.reorderUnits);
  const createContent = useMutation(api.content.create);
  const updateContent = useMutation(api.content.update);
  const removeContent = useMutation(api.content.remove);
  const generateUploadUrl = useMutation(api.content.generateUploadUrl);
  const createAssignment = useMutation(api.assignments.create);
  const updateAssignment = useMutation(api.assignments.update);
  const removeAssignment = useMutation(api.assignments.remove);
  const deleteCertificationLevel = useMutation(api.certifications.remove);
  const deleteUnit = useMutation(api.units.remove);
  const adminCreateUser = useAction(api.auth.adminCreateUser);
  const bootstrapDemo = useMutation(api.seed.bootstrapDemo);
  const clearTrainingData = useMutation(api.seed.adminClearTrainingData);
  const seedTrainingDatabase = useMutation(api.seed.adminSeedTrainingDatabase);

  const [clearTrainingDialogOpen, setClearTrainingDialogOpen] = useState(false);

  const [selectedLevel, setSelectedLevel] =
    useState<Id<"certificationLevels"> | null>(null);
  const [selectedDetailUnitId, setSelectedDetailUnitId] =
    useState<Id<"units"> | null>(null);

  const [selectedCompanyId, setSelectedCompanyId] =
    useState<Id<"companies"> | null>(null);

  const companyUsers = useQuery(
    api.users.listByCompany,
    selectedCompanyId ? { companyId: selectedCompanyId } : "skip",
  );

  const units = useQuery(
    api.units.listByLevel,
    selectedLevel ? { levelId: selectedLevel } : "skip",
  );

  useEffect(() => {
    setSelectedDetailUnitId(null);
  }, [selectedLevel]);

  const detailContent = useQuery(
    api.content.listByUnit,
    selectedDetailUnitId ? { unitId: selectedDetailUnitId } : "skip",
  );
  const detailAssignments = useQuery(
    api.assignments.listByUnit,
    selectedDetailUnitId ? { unitId: selectedDetailUnitId } : "skip",
  );

  const selectedDetailUnit = useMemo(() => {
    if (!selectedDetailUnitId || !units) {
      return null;
    }
    return units.find((u) => u._id === selectedDetailUnitId) ?? null;
  }, [selectedDetailUnitId, units]);

  const selectedCert = useMemo(() => {
    if (!selectedLevel || !levels) {
      return null;
    }
    return levels.find((l) => l._id === selectedLevel) ?? null;
  }, [selectedLevel, levels]);

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

  const memberCounts = useMemo(() => {
    const m = new Map<Id<"companies">, number>();
    for (const u of users ?? []) {
      m.set(u.companyId, (m.get(u.companyId) ?? 0) + 1);
    }
    return m;
  }, [users]);

  useEffect(() => {
    if (!companies?.length) {
      setSelectedCompanyId(null);
      return;
    }
    setSelectedCompanyId((prev) => {
      if (prev && companies.some((c) => c._id === prev)) {
        return prev;
      }
      return companies[0]!._id;
    });
  }, [companies]);

  useEffect(() => {
    if (!levels?.length) {
      setSelectedLevel(null);
      return;
    }
    setSelectedLevel((prev) => {
      if (prev && levels.some((l) => l._id === prev)) {
        return prev;
      }
      return null;
    });
  }, [levels]);

  const selectedCompany = useMemo(
    () => companies?.find((c) => c._id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId],
  );

  useEffect(() => {
    if (!selectedCompany) {
      return;
    }
    setCoDetailName(selectedCompany.name);
    setCoDetailAddress(selectedCompany.address ?? "");
    setCoDetailEmail(selectedCompany.email ?? "");
    setCoDetailPhone(selectedCompany.phone ?? "");
    setCoDetailStatus(
      selectedCompany.status === "inactive" ||
        selectedCompany.status === "pending"
        ? selectedCompany.status
        : "active",
    );
    const j = selectedCompany.joinedAt;
    if (j != null && typeof j === "number") {
      const d = new Date(j);
      setCoDetailJoined(
        Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10),
      );
    } else {
      setCoDetailJoined("");
    }
  }, [selectedCompany]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const [companyName, setCompanyName] = useState("");
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

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPass, setNewUserPass] = useState("");
  const [newUserRole, setNewUserRole] = useState<
    "operator" | "supervisor" | "admin" | "content_creator"
  >("operator");

  const [companyDeleteOpen, setCompanyDeleteOpen] = useState(false);
  const [coDetailName, setCoDetailName] = useState("");
  const [coDetailAddress, setCoDetailAddress] = useState("");
  const [coDetailEmail, setCoDetailEmail] = useState("");
  const [coDetailPhone, setCoDetailPhone] = useState("");
  const [coDetailStatus, setCoDetailStatus] = useState<
    "active" | "inactive" | "pending"
  >("active");
  const [coDetailJoined, setCoDetailJoined] = useState("");

  const [userEditOpen, setUserEditOpen] = useState(false);
  const [userEditId, setUserEditId] = useState<Id<"users"> | null>(null);
  const [userEditName, setUserEditName] = useState("");
  const [userEditEmail, setUserEditEmail] = useState("");
  const [userEditRole, setUserEditRole] = useState<
    "operator" | "supervisor" | "admin" | "content_creator"
  >("operator");
  const [userEditCompanyId, setUserEditCompanyId] = useState<string>("");
  const [userEditPassword, setUserEditPassword] = useState("");

  const [userDeleteOpen, setUserDeleteOpen] = useState(false);
  const [userDeleteId, setUserDeleteId] = useState<Id<"users"> | null>(null);

  const [levelDeleteOpen, setLevelDeleteOpen] = useState(false);
  const [unitDeleteOpen, setUnitDeleteOpen] = useState(false);
  const [unitDeleteId, setUnitDeleteId] = useState<Id<"units"> | null>(null);
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

  function openEditUnit(uid: Id<"units">) {
    const u = units?.find((x) => x._id === uid);
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
          unitId: contentUnitId as Id<"units">,
          type: contentKind,
          title: contentTitle,
          url: contentUrl || "#",
          order: 0,
        } as Doc<"contentItems">)
      : null;

  async function onReorderLevels(e: DragEndEvent) {
    if (!levels) {
      return;
    }
    const { active, over } = e;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = levels.findIndex((l) => l._id === active.id);
    const newIndex = levels.findIndex((l) => l._id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }
    const ordered = arrayMove(levels, oldIndex, newIndex).map((l) => l._id);
    try {
      await reorderLevels({ orderedIds: ordered });
      toast.success("Order updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reorder failed");
    }
  }

  async function onReorderUnits(e: DragEndEvent) {
    if (!units) {
      return;
    }
    const { active, over } = e;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = units.findIndex((u) => u._id === active.id);
    const newIndex = units.findIndex((u) => u._id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }
    const ordered = arrayMove(units, oldIndex, newIndex).map((u) => u._id);
    try {
      await reorderUnits({ orderedIds: ordered });
      toast.success("Units reordered");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reorder failed");
    }
  }

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
        <p className="text-muted-foreground">
          <strong>Users</strong> — companies and accounts.{" "}
          <strong>Curriculum</strong> — pick a certification to edit its catalog
          fields, units, lesson content, assessments, and prerequisite drops.{" "}
          <strong>Database</strong> — seed or clear training data.
        </p>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
          <TabsTrigger value="database" className="gap-1">
            <Database className="h-3.5 w-3.5 opacity-70" />
            Database
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4 mt-4">
          <div className="grid lg:grid-cols-[minmax(0,280px)_1fr] gap-6 items-start">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Companies</CardTitle>
                  <CardDescription>
                    Select a company to edit its profile and people. Add or delete
                    companies here.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="New company name"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (!companyName.trim()) {
                          toast.error("Enter a name");
                          return;
                        }
                        try {
                          await createCompany({ name: companyName });
                          setCompanyName("");
                          toast.success("Company created");
                        } catch (e) {
                          toast.error(
                            e instanceof Error ? e.message : "Failed",
                          );
                        }
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={async () => {
                      try {
                        await bootstrapDemo({});
                        toast.success("Demo level + unit created");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                  >
                    Seed demo content
                  </Button>
                  <ScrollArea className="h-[min(420px,50vh)] rounded-md border">
                    <ul className="p-1">
                      {(companies ?? []).map((c) => {
                        const count = memberCounts.get(c._id) ?? 0;
                        const active = selectedCompanyId === c._id;
                        return (
                          <li key={c._id} className="p-0.5">
                            <div
                              className={cn(
                                "flex rounded-md border transition-colors",
                                active
                                  ? "border-brand-lime/50 bg-brand-lime/10"
                                  : "border-transparent hover:bg-muted/60",
                              )}
                            >
                              <button
                                type="button"
                                className="flex-1 text-left px-3 py-2.5 text-sm min-w-0"
                                onClick={() => setSelectedCompanyId(c._id)}
                              >
                                <span className="font-medium block truncate">
                                  {c.name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {count} user{count === 1 ? "" : "s"}
                                </span>
                              </button>
                              <div className="flex flex-col border-l shrink-0">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-10 w-10 rounded-none text-destructive hover:text-destructive"
                                  title="Delete company"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCompanyId(c._id);
                                    setCompanyDeleteOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4 min-w-0">
              {!selectedCompany || !selectedCompanyId ? (
                <Card>
                  <CardContent className="py-12 text-center text-sm text-muted-foreground">
                    Add a company on the left, then select it to manage users.
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Company details</CardTitle>
                      <CardDescription>
                        Profile for this organization (contact, status, onboarding
                        date). Save before switching companies. Users are managed
                        below.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-3 max-w-3xl">
                        <div className="sm:col-span-2 space-y-1">
                          <Label htmlFor="co-name">Company name</Label>
                          <Input
                            id="co-name"
                            value={coDetailName}
                            onChange={(e) => setCoDetailName(e.target.value)}
                            placeholder="Registered or display name"
                          />
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <Label htmlFor="co-address">Address</Label>
                          <Textarea
                            id="co-address"
                            value={coDetailAddress}
                            onChange={(e) => setCoDetailAddress(e.target.value)}
                            placeholder="Street, city, state, postcode"
                            className="min-h-[80px]"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="co-email">Company email</Label>
                          <Input
                            id="co-email"
                            type="email"
                            value={coDetailEmail}
                            onChange={(e) => setCoDetailEmail(e.target.value)}
                            placeholder="contact@example.com"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="co-phone">Phone</Label>
                          <Input
                            id="co-phone"
                            type="tel"
                            value={coDetailPhone}
                            onChange={(e) => setCoDetailPhone(e.target.value)}
                            placeholder="+61 …"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Status</Label>
                          <Select
                            value={coDetailStatus}
                            onValueChange={(v) =>
                              setCoDetailStatus(
                                (v ?? "active") as typeof coDetailStatus,
                              )
                            }
                          >
                            <SelectTrigger id="co-status">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="co-joined">Date joined</Label>
                          <Input
                            id="co-joined"
                            type="date"
                            value={coDetailJoined}
                            onChange={(e) => setCoDetailJoined(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={async () => {
                            if (!selectedCompanyId || !coDetailName.trim()) {
                              toast.error("Company name is required");
                              return;
                            }
                            let joinedAt: number | null = null;
                            if (coDetailJoined.trim()) {
                              const t = Date.parse(
                                `${coDetailJoined.trim()}T12:00:00.000Z`,
                              );
                              if (Number.isNaN(t)) {
                                toast.error("Invalid date");
                                return;
                              }
                              joinedAt = t;
                            }
                            try {
                              await updateCompany({
                                companyId: selectedCompanyId,
                                name: coDetailName.trim(),
                                address: coDetailAddress,
                                email: coDetailEmail,
                                phone: coDetailPhone,
                                status: coDetailStatus,
                                joinedAt,
                              });
                              toast.success("Company saved");
                            } catch (e) {
                              toast.error(
                                e instanceof Error ? e.message : "Failed",
                              );
                            }
                          }}
                        >
                          Save company details
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive/40 hover:bg-destructive/10"
                          onClick={() => setCompanyDeleteOpen(true)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Delete company
                        </Button>
                      </div>

                      <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                        <h4 className="text-sm font-medium">Add user</h4>
                        <div className="grid sm:grid-cols-2 gap-3 max-w-2xl">
                          <Input
                            placeholder="Name"
                            value={newUserName}
                            onChange={(e) => setNewUserName(e.target.value)}
                          />
                          <Input
                            placeholder="Email"
                            type="email"
                            value={newUserEmail}
                            onChange={(e) =>
                              setNewUserEmail(e.target.value)
                            }
                          />
                          <Input
                            placeholder="Temporary password (min 8 chars)"
                            type="password"
                            value={newUserPass}
                            onChange={(e) => setNewUserPass(e.target.value)}
                          />
                          <Select
                            value={newUserRole}
                            onValueChange={(v) =>
                              setNewUserRole(
                                (v ?? "operator") as typeof newUserRole,
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="operator">operator</SelectItem>
                              <SelectItem value="supervisor">
                                supervisor
                              </SelectItem>
                              <SelectItem value="content_creator">
                                content_creator
                              </SelectItem>
                              <SelectItem value="admin">admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={async () => {
                            if (!newUserEmail.trim() || !newUserPass) {
                              toast.error("Email and password required");
                              return;
                            }
                            if (newUserPass.length < 8) {
                              toast.error("Password must be at least 8 characters");
                              return;
                            }
                            try {
                              await adminCreateUser({
                                name: newUserName.trim() || newUserEmail.trim(),
                                email: newUserEmail,
                                password: newUserPass,
                                companyId: selectedCompanyId,
                                role: newUserRole,
                              });
                              toast.success("User created");
                              setNewUserName("");
                              setNewUserEmail("");
                              setNewUserPass("");
                            } catch (err) {
                              toast.error(
                                err instanceof Error ? err.message : "Failed",
                              );
                            }
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add user to {coDetailName.trim() || selectedCompany.name}
                        </Button>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium mb-2">People</h4>
                        {(companyUsers ?? []).length === 0 ? (
                          <p className="text-sm text-muted-foreground py-6 text-center border rounded-md">
                            No users yet. Add one above.
                          </p>
                        ) : (
                          <ul className="border rounded-md divide-y max-h-[min(400px,45vh)] overflow-y-auto">
                            {(companyUsers ?? []).map((u) => (
                              <li
                                key={u._id}
                                className="flex items-center gap-2 px-3 py-2 text-sm"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">
                                    {u.name}
                                  </div>
                                  <div className="text-muted-foreground truncate text-xs">
                                    {u.email} · {u.role}
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setUserEditId(u._id);
                                    setUserEditName(u.name);
                                    setUserEditEmail(u.email);
                                    setUserEditRole(u.role);
                                    setUserEditCompanyId(u.companyId);
                                    setUserEditPassword("");
                                    setUserEditOpen(true);
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => {
                                    setUserDeleteId(u._id);
                                    setUserDeleteOpen(true);
                                  }}
                                >
                                  Remove
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="curriculum" className="space-y-6 mt-4">
          <div className="grid lg:grid-cols-[minmax(0,300px)_1fr] gap-6 items-start">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Certifications</CardTitle>
                <CardDescription>
                  Add, reorder, or delete certifications. Click one to open its
                  details and units on the right.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Input
                    placeholder="New certification name"
                    value={levelName}
                    onChange={(e) => setLevelName(e.target.value)}
                  />
                  <Textarea
                    placeholder="Description"
                    value={levelDesc}
                    onChange={(e) => setLevelDesc(e.target.value)}
                    className="min-h-[72px]"
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
                        setSelectedLevel(newId);
                        toast.success("Certification created");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add certification
                  </Button>
                </div>
                {(levels ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center border rounded-md">
                    No certifications yet. Add one above.
                  </p>
                ) : (
                  <ScrollArea className="h-[min(380px,45vh)] rounded-md border">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={onReorderLevels}
                    >
                      <SortableContext
                        items={(levels ?? []).map((l) => l._id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <ul className="p-1 space-y-1">
                          {(levels ?? []).map((l) => (
                            <li key={l._id} className="p-0.5">
                              <SortableLevelRow
                                level={l}
                                selected={selectedLevel === l._id}
                                onSelect={() => setSelectedLevel(l._id)}
                                onDelete={() => {
                                  setSelectedLevel(l._id);
                                  setLevelDeleteOpen(true);
                                }}
                              />
                            </li>
                          ))}
                        </ul>
                      </SortableContext>
                    </DndContext>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6 min-w-0">
              {!selectedLevel || !selectedCert ? (
                <Card>
                  <CardContent className="py-14 text-center text-sm text-muted-foreground px-4">
                    Select a <strong>certification</strong> on the left to edit its
                    details, units, lesson content, assessments, and prerequisites.
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">
                        Certification details
                      </CardTitle>
                      <CardDescription>
                        Catalog title, description, display order, and optional
                        company scope. Drag certifications in the list to reorder.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 max-w-3xl">
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
                            onChange={(e) =>
                              setCertDetailThumbnail(e.target.value)
                            }
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
                          if (!selectedLevel || !certDetailName.trim()) {
                            toast.error("Name is required");
                            return;
                          }
                          const orderNum = Number.parseInt(
                            certDetailOrder,
                            10,
                          );
                          if (Number.isNaN(orderNum)) {
                            toast.error("Display order must be a number");
                            return;
                          }
                          try {
                            await updateLevel({
                              levelId: selectedLevel,
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
                            toast.error(
                              e instanceof Error ? e.message : "Failed",
                            );
                          }
                        }}
                      >
                        Save certification
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">
                        Units in this certification
                      </CardTitle>
                      <CardDescription>
                        Add and reorder units. Select a unit to edit lessons,
                        assessments, and prerequisites below.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {!units ? (
                        <p className="text-sm text-muted-foreground py-6 text-center border rounded-md">
                          Loading units…
                        </p>
                      ) : (
                        <>
                          <div className="flex gap-2 flex-wrap">
                            <Input
                              placeholder="Unit title"
                              value={unitTitle}
                              onChange={(e) => setUnitTitle(e.target.value)}
                              className="flex-1 min-w-[120px]"
                            />
                            <Button
                              size="sm"
                              type="button"
                              onClick={async () => {
                                if (!unitTitle.trim()) {
                                  toast.error("Enter a unit title");
                                  return;
                                }
                                try {
                                  await createUnit({
                                    levelId: selectedLevel,
                                    title: unitTitle.trim(),
                                    description: unitDesc.trim() || "—",
                                    order: units.length,
                                  });
                                  setUnitTitle("");
                                  setUnitDesc("");
                                  toast.success("Unit created");
                                } catch (e) {
                                  toast.error(
                                    e instanceof Error ? e.message : "Failed",
                                  );
                                }
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <Textarea
                            placeholder="Unit description"
                            value={unitDesc}
                            onChange={(e) => setUnitDesc(e.target.value)}
                            className="min-h-[64px]"
                          />
                          <ScrollArea className="h-[min(280px,38vh)] rounded-md border">
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={onReorderUnits}
                            >
                              <SortableContext
                                items={units.map((u) => u._id)}
                                strategy={verticalListSortingStrategy}
                              >
                                <ul className="p-1 space-y-1">
                                  {units.map((u) => (
                                    <li key={u._id} className="p-0.5">
                                      <SortableUnitRow
                                        unit={u}
                                        selected={
                                          selectedDetailUnitId === u._id
                                        }
                                        onSelect={() =>
                                          setSelectedDetailUnitId(u._id)
                                        }
                                        onEdit={() => openEditUnit(u._id)}
                                        onDelete={() => {
                                          setUnitDeleteId(u._id);
                                          setUnitDeleteOpen(true);
                                        }}
                                      />
                                    </li>
                                  ))}
                                </ul>
                              </SortableContext>
                            </DndContext>
                          </ScrollArea>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {!selectedDetailUnitId || !selectedDetailUnit ? (
                    <Card>
                      <CardContent className="py-10 text-center text-sm text-muted-foreground px-4">
                        Select a <strong>unit</strong> above to add lessons
                        (content), assessments, and{" "}
                        <strong>drag prerequisite units</strong> onto it.
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">
                            {selectedDetailUnit.title}
                          </CardTitle>
                          <CardDescription className="flex flex-wrap items-center gap-x-1">
                            <span>Lessons, assessments, prerequisites.</span>
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 text-primary"
                              onClick={() =>
                                openEditUnit(selectedDetailUnitId)
                              }
                            >
                              Edit unit title &amp; description
                            </Button>
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                      <div className="space-y-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Lessons (content)
                        </p>
                        {(detailContent ?? []).length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4 border rounded-md text-center">
                            No lessons yet. Add a row below.
                          </p>
                        ) : (
                          <ul className="border rounded-md divide-y max-h-52 overflow-y-auto text-sm">
                            {(detailContent ?? []).map((item) => (
                              <li
                                key={item._id}
                                className="flex items-center gap-2 px-3 py-2"
                              >
                                <span className="flex-1 min-w-0 truncate">
                                  <span className="font-medium">
                                    {item.title}
                                  </span>
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
                                      await removeContent({
                                        contentId: item._id,
                                      });
                                      toast.success("Lesson removed");
                                    } catch (e) {
                                      toast.error(
                                        e instanceof Error
                                          ? e.message
                                          : "Failed",
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
                        <div className="grid sm:grid-cols-2 gap-3 max-w-2xl rounded-lg border p-4 bg-muted/25">
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
                                    file.type ||
                                    "application/octet-stream",
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
                              const nextOrder = detailContent?.length ?? 0;
                              await createContent({
                                unitId: selectedDetailUnitId,
                                type: kind,
                                title: contentTitle || file.name,
                                url: "#",
                                storageId: json.storageId as Id<"_storage">,
                                order: nextOrder,
                              });
                              toast.success("Uploaded and published");
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
                                await createContent({
                                  unitId: selectedDetailUnitId,
                                  type: contentKind,
                                  title: contentTitle,
                                  url: contentUrl || "#",
                                  order: detailContent?.length ?? 0,
                                });
                                toast.success("Lesson published");
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
                            No assignments yet. Use the form below or{" "}
                            <button
                              type="button"
                              className="text-primary underline-offset-4 hover:underline"
                              onClick={resetToNewAssignment}
                            >
                              start a new one
                            </button>
                            .
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
                      </div>
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
                    </CardContent>
                  </Card>
                  <PrerequisiteDropEditor
                    targetUnitId={selectedDetailUnitId}
                    targetTitle={selectedDetailUnit.title}
                    levels={levels}
                    allUnits={allUnits}
                  />
                </>
              )}
                </>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="database" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Training data</CardTitle>
              <CardDescription>
                Clear removes all certification levels, units, media, assessments,
                prerequisites, and learner progress — <strong>not</strong> companies
                or user accounts. Seed restores operator companies, default admin
                logins, and the Land Lease curriculum (if «Land Lease 101» is
                absent).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button
                variant="destructive"
                onClick={() => setClearTrainingDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Clear training data
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    const res = await seedTrainingDatabase({});
                    if (res.curriculumSkipped) {
                      toast.message(
                        res.message ?? "Curriculum already seeded — clear first to re-insert.",
                      );
                    } else {
                      toast.success(
                        `Seeded ${res.levelCount} levels, ${res.unitCount} units, ${res.prerequisiteCount} prerequisite links`,
                      );
                    }
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Seed failed");
                  }
                }}
              >
                <Database className="h-4 w-4 mr-1.5" />
                Seed database
              </Button>
            </CardContent>
          </Card>

          <Dialog
            open={clearTrainingDialogOpen}
            onOpenChange={setClearTrainingDialogOpen}
          >
            <DialogContent className="sm:max-w-md" showCloseButton>
              <DialogHeader>
                <DialogTitle>Clear all training data?</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                This permanently deletes every certification level, unit, content
                item, assignment, prerequisite rule, progress row, and quiz
                result. Companies and users are kept.
              </p>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setClearTrainingDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={async () => {
                    try {
                      const res = await clearTrainingData({});
                      const c = res.counts;
                      toast.success(
                        `Cleared: ${c.certificationLevels} levels, ${c.units} units, ${c.userProgress} progress, ${c.testResults} results`,
                      );
                      setClearTrainingDialogOpen(false);
                    } catch (e) {
                      toast.error(
                        e instanceof Error ? e.message : "Clear failed",
                      );
                    }
                  }}
                >
                  Clear now
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>

      <Dialog
        open={editContentOpen}
        onOpenChange={(o) => {
          setEditContentOpen(o);
          if (!o) {
            setEditContentId(null);
            setEditContentStorageId(null);
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
                      order: ord,
                    });
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
                const u = units?.find((x) => x._id === editUnitId);
                await updateUnit({
                  unitId: editUnitId,
                  title: editUnitTitle,
                  description: editUnitDesc,
                  order: u?.order ?? 0,
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
        open={companyDeleteOpen}
        onOpenChange={setCompanyDeleteOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete company?</DialogTitle>
            <DialogDescription>
              {selectedCompany
                ? `Permanently delete “${selectedCompany.name}”. You must remove or move every user first; otherwise this will fail.`
                : "Delete this company?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCompanyDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!selectedCompanyId}
              onClick={async () => {
                if (!selectedCompanyId) {
                  return;
                }
                try {
                  await removeCompany({ companyId: selectedCompanyId });
                  toast.success("Company deleted");
                  setCompanyDeleteOpen(false);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Delete company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={userEditOpen}
        onOpenChange={(o) => {
          setUserEditOpen(o);
          if (!o) {
            setUserEditId(null);
            setUserEditPassword("");
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>
              Change profile, company, or set a new password (optional, min 8
              characters).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="user-edit-name">Name</Label>
              <Input
                id="user-edit-name"
                value={userEditName}
                onChange={(e) => setUserEditName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="user-edit-email">Email</Label>
              <Input
                id="user-edit-email"
                type="email"
                value={userEditEmail}
                onChange={(e) => setUserEditEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select
                value={userEditRole}
                onValueChange={(v) =>
                  setUserEditRole((v ?? "operator") as typeof userEditRole)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">operator</SelectItem>
                  <SelectItem value="supervisor">supervisor</SelectItem>
                  <SelectItem value="content_creator">content_creator</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Company</Label>
              <Select
                value={userEditCompanyId}
                onValueChange={(v) => setUserEditCompanyId(v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  {(companies ?? []).map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="user-edit-password">New password (optional)</Label>
              <Input
                id="user-edit-password"
                type="password"
                autoComplete="new-password"
                placeholder="Leave blank to keep current"
                value={userEditPassword}
                onChange={(e) => setUserEditPassword(e.target.value)}
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setUserEditOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!userEditId || !userEditCompanyId}
                onClick={async () => {
                  if (!userEditId || !userEditCompanyId) {
                    return;
                  }
                  if (!userEditName.trim() || !userEditEmail.trim()) {
                    toast.error("Name and email are required");
                    return;
                  }
                  const pw = userEditPassword.trim();
                  if (pw && pw.length < 8) {
                    toast.error("New password must be at least 8 characters");
                    return;
                  }
                  try {
                    await adminUpdateUserProfile({
                      userId: userEditId,
                      name: userEditName.trim(),
                      email: userEditEmail.trim(),
                      role: userEditRole,
                      companyId: userEditCompanyId as Id<"companies">,
                    });
                    if (pw) {
                      await adminSetPassword({
                        userId: userEditId,
                        password: pw,
                      });
                    }
                    toast.success("User saved");
                    setUserEditOpen(false);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed");
                  }
                }}
              >
                Save
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={userDeleteOpen} onOpenChange={setUserDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove user?</DialogTitle>
            <DialogDescription>
              This permanently deletes the account and their progress for this
              deployment. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setUserDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!userDeleteId}
              onClick={async () => {
                if (!userDeleteId) {
                  return;
                }
                try {
                  await adminDeleteUser({ userId: userDeleteId });
                  toast.success("User removed");
                  setUserDeleteOpen(false);
                  setUserDeleteId(null);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Remove user
            </Button>
          </DialogFooter>
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
              disabled={!selectedLevel}
              onClick={async () => {
                if (!selectedLevel) {
                  return;
                }
                try {
                  await deleteCertificationLevel({ levelId: selectedLevel });
                  toast.success("Certification deleted");
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

      <Dialog open={unitDeleteOpen} onOpenChange={setUnitDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete unit?</DialogTitle>
            <DialogDescription>
              Removes this unit and all of its content, assignments, prerequisite
              edges involving it, and related learner progress and quiz results.
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
