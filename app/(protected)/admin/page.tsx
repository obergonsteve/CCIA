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
import { Eye, GripVertical, Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function SortableLevelRow({
  level,
  onSelect,
}: {
  level: Doc<"certificationLevels">;
  onSelect: () => void;
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
      className="flex items-center gap-2 rounded-md border bg-card p-2"
    >
      <button
        type="button"
        className="cursor-grab touch-none p-1 text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="flex-1 text-left text-sm font-medium"
        onClick={onSelect}
      >
        {level.name}
      </button>
    </div>
  );
}

function SortableUnitRow({ unit }: { unit: Doc<"units"> }) {
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
      className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm"
    >
      <button
        type="button"
        className="cursor-grab p-1 text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span>{unit.title}</span>
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

export default function AdminPage() {
  const companies = useQuery(api.companies.list);
  const users = useQuery(api.users.listAll);
  const levels = useQuery(api.certifications.listAllAdmin);
  const allUnits = useQuery(api.units.listAllAdmin);

  const createCompany = useMutation(api.companies.create);
  const createLevel = useMutation(api.certifications.create);
  const updateLevel = useMutation(api.certifications.update);
  const reorderLevels = useMutation(api.certifications.reorderLevels);
  const createUnit = useMutation(api.units.create);
  const updateUnit = useMutation(api.units.update);
  const reorderUnits = useMutation(api.units.reorderUnits);
  const createContent = useMutation(api.content.create);
  const generateUploadUrl = useMutation(api.content.generateUploadUrl);
  const createAssignment = useMutation(api.assignments.create);
  const updateAssignment = useMutation(api.assignments.update);
  const adminCreateUser = useAction(api.auth.adminCreateUser);
  const bootstrapDemo = useMutation(api.seed.bootstrapDemo);

  const [selectedLevel, setSelectedLevel] =
    useState<Id<"certificationLevels"> | null>(null);
  const units = useQuery(
    api.units.listByLevel,
    selectedLevel ? { levelId: selectedLevel } : "skip",
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const [companyName, setCompanyName] = useState("");
  const [levelName, setLevelName] = useState("");
  const [levelDesc, setLevelDesc] = useState("");
  const [editLevelOpen, setEditLevelOpen] = useState(false);
  const [editLevelName, setEditLevelName] = useState("");
  const [editLevelDesc, setEditLevelDesc] = useState("");

  const [unitTitle, setUnitTitle] = useState("");
  const [unitDesc, setUnitDesc] = useState("");
  const [editUnitOpen, setEditUnitOpen] = useState(false);
  const [editUnitId, setEditUnitId] = useState<Id<"units"> | null>(null);
  const [editUnitTitle, setEditUnitTitle] = useState("");
  const [editUnitDesc, setEditUnitDesc] = useState("");

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPass, setNewUserPass] = useState("");
  const [newUserCompany, setNewUserCompany] = useState<string>("");
  const [newUserRole, setNewUserRole] = useState<
    "operator" | "supervisor" | "admin" | "content_creator"
  >("operator");

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

  function openEditLevel() {
    const lv = levels?.find((l) => l._id === selectedLevel);
    if (!lv) {
      return;
    }
    setEditLevelName(lv.name);
    setEditLevelDesc(lv.description);
    setEditLevelOpen(true);
  }

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
          Manage companies, users, certification structure, training media, and
          assessments. Preview learner content before publishing.
        </p>
      </div>

      <Tabs defaultValue="companies">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="structure">Levels & units</TabsTrigger>
          <TabsTrigger value="content">Content & preview</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Add company</CardTitle>
              <CardDescription>
                Operators granted portal access (CCIA onboarding).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Input
                placeholder="Company name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="max-w-sm"
              />
              <Button
                onClick={async () => {
                  if (!companyName.trim()) {
                    return;
                  }
                  await createCompany({ name: companyName });
                  setCompanyName("");
                  toast.success("Company created");
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
              <Button
                variant="outline"
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
            </CardContent>
          </Card>
          <ul className="text-sm space-y-1">
            {(companies ?? []).map((c) => (
              <li
                key={c._id}
                className="flex justify-between border rounded px-3 py-2"
              >
                <span>{c.name}</span>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="users" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Create user</CardTitle>
              <CardDescription>Passwords are hashed with bcrypt in Convex.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 max-w-lg">
              <Input
                placeholder="Name"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
              />
              <Input
                placeholder="Email"
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
              />
              <Input
                placeholder="Temporary password"
                type="password"
                value={newUserPass}
                onChange={(e) => setNewUserPass(e.target.value)}
              />
              <Select
                value={newUserCompany}
                onValueChange={(v) => setNewUserCompany(v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Company" />
                </SelectTrigger>
                <SelectContent>
                  {(companies ?? []).map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={newUserRole}
                onValueChange={(v) =>
                  setNewUserRole((v ?? "operator") as typeof newUserRole)
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
              <Button
                onClick={async () => {
                  if (!newUserCompany || !newUserEmail || !newUserPass) {
                    toast.error("Fill all fields");
                    return;
                  }
                  try {
                    await adminCreateUser({
                      name: newUserName,
                      email: newUserEmail,
                      password: newUserPass,
                      companyId: newUserCompany as Id<"companies">,
                      role: newUserRole,
                    });
                    toast.success("User created");
                    setNewUserName("");
                    setNewUserEmail("");
                    setNewUserPass("");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed");
                  }
                }}
              >
                Create user
              </Button>
            </CardContent>
          </Card>
          <ul className="text-sm space-y-1">
            {(users ?? []).map((u) => (
              <li key={u._id} className="border rounded px-3 py-2">
                {u.name} — {u.email}{" "}
                <span className="text-muted-foreground">({u.role})</span>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="structure" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>New certification level</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Name"
                value={levelName}
                onChange={(e) => setLevelName(e.target.value)}
              />
              <Textarea
                placeholder="Description"
                value={levelDesc}
                onChange={(e) => setLevelDesc(e.target.value)}
              />
              <Button
                onClick={async () => {
                  const n = levels?.length ?? 0;
                  await createLevel({
                    name: levelName,
                    description: levelDesc,
                    order: n,
                  });
                  setLevelName("");
                  setLevelDesc("");
                  toast.success("Level created");
                }}
              >
                Add level
              </Button>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">Reorder levels</h3>
                {selectedLevel && (
                  <Button size="sm" variant="outline" onClick={openEditLevel}>
                    Edit selected level
                  </Button>
                )}
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onReorderLevels}
              >
                <SortableContext
                  items={(levels ?? []).map((l) => l._id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {(levels ?? []).map((l) => (
                      <SortableLevelRow
                        key={l._id}
                        level={l}
                        onSelect={() => setSelectedLevel(l._id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">
                Units {selectedLevel ? "" : "(select a level)"}
              </h3>
              {selectedLevel && units && (
                <>
                  <div className="flex gap-2 mb-3 flex-wrap">
                    <Input
                      placeholder="Unit title"
                      value={unitTitle}
                      onChange={(e) => setUnitTitle(e.target.value)}
                      className="flex-1 min-w-[120px]"
                    />
                    <Button
                      size="sm"
                      onClick={async () => {
                        await createUnit({
                          levelId: selectedLevel,
                          title: unitTitle,
                          description: unitDesc || "—",
                          order: units.length,
                        });
                        setUnitTitle("");
                        setUnitDesc("");
                        toast.success("Unit added");
                      }}
                    >
                      Add unit
                    </Button>
                  </div>
                  <Input
                    placeholder="Unit description"
                    value={unitDesc}
                    onChange={(e) => setUnitDesc(e.target.value)}
                    className="mb-3"
                  />
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onReorderUnits}
                  >
                    <SortableContext
                      items={units.map((u) => u._id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {units.map((u) => (
                          <div key={u._id} className="flex items-center gap-2">
                            <div className="flex-1">
                              <SortableUnitRow unit={u} />
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditUnit(u._id)}
                            >
                              Edit
                            </Button>
                          </div>
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="content" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Add & preview content</CardTitle>
              <CardDescription>
                Upload video/PDF to Convex storage, or add links / multi-image
                slideshow URLs (JSON array or | separated). Preview matches the
                learner view before you publish.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 max-w-xl">
              <Select
                value={contentUnitId}
                onValueChange={(v) => setContentUnitId(v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Target unit" />
                </SelectTrigger>
                <SelectContent>
                  {(allUnits ?? []).map((u) => (
                    <SelectItem key={u._id} value={u._id}>
                      {u.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Unit ID (optional override)"
                value={contentUnitId}
                onChange={(e) => setContentUnitId(e.target.value)}
              />
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
                placeholder="URL(s) — for slideshow use JSON array or | separated"
                value={contentUrl}
                onChange={(e) => setContentUrl(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
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
                        Add a title and unit first.
                      </p>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
              <Input
                type="file"
                accept="video/*,application/pdf"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !contentUnitId) {
                    toast.error("Choose unit and file");
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
                  const json = (await res.json()) as { storageId: string };
                  const kind = file.type.startsWith("video") ? "video" : "pdf";
                  setContentKind(kind);
                  await createContent({
                    unitId: contentUnitId as Id<"units">,
                    type: kind,
                    title: contentTitle || file.name,
                    url: "#",
                    storageId: json.storageId as Id<"_storage">,
                    order: 0,
                  });
                  toast.success("Uploaded and published");
                }}
              />
              <Button
                onClick={async () => {
                  if (!contentUnitId || !contentTitle) {
                    toast.error("Unit and title required");
                    return;
                  }
                  await createContent({
                    unitId: contentUnitId as Id<"units">,
                    type: contentKind,
                    title: contentTitle,
                    url: contentUrl || "#",
                    order: 0,
                  });
                  toast.success("Content published");
                }}
              >
                Publish content
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Assignment builder</CardTitle>
              <CardDescription>
                Create or edit assessments with multiple-choice and text
                questions. Set a model answer for text to enable auto-grading.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-2xl">
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
              {assignUnitId && (assignmentsForUnit?.length ?? 0) > 0 && (
                <div className="grid gap-2">
                  <Label>Edit existing</Label>
                  <Select
                    value={assignId || "__new__"}
                    onValueChange={(v) => {
                      if (v === "__new__") {
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
                      onChange={(e) =>
                        updateQuestion(i, { question: e.target.value })
                      }
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
                        <SelectItem value="multiple_choice">
                          Multiple choice
                        </SelectItem>
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={editLevelOpen} onOpenChange={setEditLevelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit certification level</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={editLevelName}
              onChange={(e) => setEditLevelName(e.target.value)}
            />
            <Textarea
              value={editLevelDesc}
              onChange={(e) => setEditLevelDesc(e.target.value)}
            />
            <Button
              onClick={async () => {
                if (!selectedLevel) {
                  return;
                }
                const lv = levels?.find((l) => l._id === selectedLevel);
                await updateLevel({
                  levelId: selectedLevel,
                  name: editLevelName,
                  description: editLevelDesc,
                  order: lv?.order ?? 0,
                  companyId: lv?.companyId,
                });
                toast.success("Level updated");
                setEditLevelOpen(false);
              }}
            >
              Save
            </Button>
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
    </div>
  );
}
