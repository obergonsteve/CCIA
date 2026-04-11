"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery } from "convex/react";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type CategoryRow = {
  _id: string;
  shortCode: string;
  longDescription: string;
};

const categoryColumnToneClass: Record<
  "lime" | "gold" | "sky",
  string
> = {
  lime:
    "border border-brand-lime/40 border-l-4 border-r-4 border-l-brand-lime border-r-brand-lime bg-brand-lime/[0.11] shadow-lg dark:border-brand-lime/35 dark:border-l-brand-lime dark:border-r-brand-lime dark:bg-brand-lime/[0.14]",
  gold:
    "border border-brand-gold/40 border-l-4 border-r-4 border-l-brand-gold border-r-brand-gold bg-brand-gold/[0.14] shadow-lg dark:border-brand-gold/35 dark:border-l-brand-gold dark:border-r-brand-gold dark:bg-brand-gold/[0.12]",
  sky:
    "border border-brand-sky/40 border-l-4 border-r-4 border-l-brand-sky border-r-brand-sky bg-brand-sky/[0.10] shadow-lg dark:border-brand-sky/35 dark:border-l-brand-sky dark:border-r-brand-sky dark:bg-brand-sky/[0.12]",
};

function CategoryCrudColumn({
  title,
  tone,
  rows,
  onCreate,
  onUpdate,
  onRemove,
}: {
  title: string;
  tone: keyof typeof categoryColumnToneClass;
  rows: CategoryRow[] | undefined;
  onCreate: (args: {
    shortCode: string;
    longDescription: string;
  }) => Promise<unknown>;
  onUpdate: (args: {
    id: string;
    shortCode: string;
    longDescription: string;
  }) => Promise<unknown>;
  onRemove: (id: string) => Promise<unknown>;
}) {
  const [shortCode, setShortCode] = useState("");
  const [longDescription, setLongDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editShort, setEditShort] = useState("");
  const [editLong, setEditLong] = useState("");

  function startEdit(row: CategoryRow) {
    setEditingId(row._id);
    setEditShort(row.shortCode);
    setEditLong(row.longDescription);
  }

  async function handleAdd() {
    try {
      await onCreate({
        shortCode: shortCode.trim(),
        longDescription: longDescription.trim(),
      });
      setShortCode("");
      setLongDescription("");
      toast.success("Category added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function handleSaveEdit(id: string) {
    try {
      await onUpdate({
        id,
        shortCode: editShort.trim(),
        longDescription: editLong.trim(),
      });
      setEditingId(null);
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function handleRemove(id: string) {
    try {
      await onRemove(id);
      if (editingId === id) {
        setEditingId(null);
      }
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className={cn("rounded-2xl p-4", categoryColumnToneClass[tone])}>
      <h3 className="text-sm font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <div className="mt-3 space-y-2 rounded-md border border-border/60 bg-background/80 p-2.5">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">
            New short code
          </Label>
          <Input
            value={shortCode}
            onChange={(e) => setShortCode(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">
            New long description
          </Label>
          <Input
            value={longDescription}
            onChange={(e) => setLongDescription(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="w-full"
          onClick={() => void handleAdd()}
        >
          Add category
        </Button>
      </div>
      {!rows?.length ? (
        <p className="mt-3 text-xs text-muted-foreground">No categories yet.</p>
      ) : (
        <ul className="mt-3 max-h-[min(40vh,360px)] space-y-2 overflow-y-auto pr-0.5">
          {rows.map((row) => (
            <li
              key={row._id}
              className="group space-y-2 rounded-md border border-border/60 bg-background/80 p-2.5"
            >
              {editingId === row._id ? (
                <>
                  <Input
                    value={editShort}
                    onChange={(e) => setEditShort(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Input
                    value={editLong}
                    onChange={(e) => setEditLong(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void handleSaveEdit(row._id)}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="truncate text-sm font-medium">
                      {row.shortCode}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {row.longDescription}
                    </p>
                  </div>
                  <div
                    className="flex shrink-0 flex-col items-end gap-1.5 self-start opacity-100 transition-opacity duration-150 md:pointer-events-none md:opacity-0 md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100"
                  >
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      aria-label={`Edit ${title}`}
                      onClick={() => startEdit(row)}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      aria-label={`Delete ${title}`}
                      onClick={() => void handleRemove(row._id)}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdminCategoryCrudSection() {
  const certRows = useQuery(api.certificationCategories.listAdmin);
  const unitRows = useQuery(api.unitCategories.listAdmin);
  const contentRows = useQuery(api.contentCategories.listAdmin);

  const certCreate = useMutation(api.certificationCategories.create);
  const certUpdate = useMutation(api.certificationCategories.update);
  const certRemove = useMutation(api.certificationCategories.remove);

  const unitCreate = useMutation(api.unitCategories.create);
  const unitUpdate = useMutation(api.unitCategories.update);
  const unitRemove = useMutation(api.unitCategories.remove);

  const contentCreate = useMutation(api.contentCategories.create);
  const contentUpdate = useMutation(api.contentCategories.update);
  const contentRemove = useMutation(api.contentCategories.remove);

  return (
    <section className="mt-10 overflow-hidden rounded-2xl border border-border shadow-md">
      <div
        className="grid h-1.5 grid-cols-3"
        aria-hidden
      >
        <div className="bg-brand-lime" />
        <div className="bg-brand-gold" />
        <div className="bg-brand-sky" />
      </div>
      <div className="bg-card/80 px-4 pb-8 pt-6 backdrop-blur-sm dark:bg-card/60 sm:px-6">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          Categories
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Add and edit categories here, then assign them from the dropdowns on
          each certification, unit, and content form above.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <CategoryCrudColumn
            title="Certifications"
            tone="lime"
            rows={certRows as CategoryRow[] | undefined}
            onCreate={(a) => certCreate(a)}
            onUpdate={(a) =>
              certUpdate({
                id: a.id as Id<"certificationCategories">,
                shortCode: a.shortCode,
                longDescription: a.longDescription,
              })
            }
            onRemove={(id) =>
              certRemove({ id: id as Id<"certificationCategories"> })
            }
          />
          <CategoryCrudColumn
            title="Units"
            tone="gold"
            rows={unitRows as CategoryRow[] | undefined}
            onCreate={(a) => unitCreate(a)}
            onUpdate={(a) =>
              unitUpdate({
                id: a.id as Id<"unitCategories">,
                shortCode: a.shortCode,
                longDescription: a.longDescription,
              })
            }
            onRemove={(id) => unitRemove({ id: id as Id<"unitCategories"> })}
          />
          <CategoryCrudColumn
            title="Content"
            tone="sky"
            rows={contentRows as CategoryRow[] | undefined}
            onCreate={(a) => contentCreate(a)}
            onUpdate={(a) =>
              contentUpdate({
                id: a.id as Id<"contentCategories">,
                shortCode: a.shortCode,
                longDescription: a.longDescription,
              })
            }
            onRemove={(id) => contentRemove({ id: id as Id<"contentCategories"> })}
          />
        </div>
      </div>
    </section>
  );
}
