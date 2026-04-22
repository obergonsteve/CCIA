"use client";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMutation, useQuery } from "convex/react";
import { Database, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function formatDeletedAt(ms: number | undefined) {
  if (ms == null) {
    return "—";
  }
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

export default function AdminDatabaseClient() {
  const clearTrainingData = useMutation(api.seed.adminClearTrainingData);
  const seedTrainingDatabase = useMutation(api.seed.adminSeedTrainingDatabase);
  const clearAndReseedTrainingDatabase = useMutation(
    api.seed.adminClearAndReseedTrainingDatabase,
  );
  const restoreCert = useMutation(api.adminDeleted.restoreCertificationLevel);
  const restoreUnit = useMutation(api.adminDeleted.restoreUnit);
  const restoreContent = useMutation(api.adminDeleted.restoreContentItem);
  const deletedCerts = useQuery(api.adminDeleted.listDeletedCertifications);
  const deletedUnits = useQuery(api.adminDeleted.listDeletedUnits);
  const deletedContent = useQuery(api.adminDeleted.listDeletedContent);
  const [clearTrainingDialogOpen, setClearTrainingDialogOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-muted-foreground">
          Seed demo operators, admins, and the Land Lease curriculum — or clear
          curriculum and learner test data. Companies and user accounts are not
          removed when you clear.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test data — seed &amp; clear</CardTitle>
          <CardDescription>
            <strong>Clear test data</strong> deletes certification levels,
            units, library content, assignments, prerequisites, curriculum
            category rows, certification–unit and unit–content links, all learner
            progress (per-step content progress, audit events, workshop session
            sync data), and quiz/test results; clears pinned certification
            roadmaps on user accounts. <strong>Companies and user accounts
            stay.</strong>{" "}
            <strong>Seed test data</strong> ensures demo operator companies and
            default admin logins, then inserts the full Land Lease curriculum
            only when it is not already present — use{" "}
            <strong>Clear and re-seed</strong> for a one-step reset, or clear
            first then seed.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="destructive"
            onClick={() => setClearTrainingDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Clear test data
          </Button>
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const res = await seedTrainingDatabase({});
                if (res.curriculumSkipped) {
                  toast.message(
                    res.message ??
                      "Curriculum already seeded — clear first to re-insert.",
                  );
                } else {
                  const ws =
                    "workshopUnitsInserted" in res &&
                    typeof (res as { workshopUnitsInserted?: unknown })
                      .workshopUnitsInserted === "number"
                      ? (res as { workshopUnitsInserted: number })
                          .workshopUnitsInserted
                      : 0;
                  toast.success(
                    `Seeded ${res.levelCount} levels, ${res.unitCount} units (${ws} live workshop), ${res.prerequisiteCount} prerequisite links`,
                  );
                }
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Seed failed");
              }
            }}
          >
            <Database className="h-4 w-4 mr-1.5" />
            Seed test data
          </Button>
          <Button
            variant="default"
            onClick={async () => {
              try {
                const res = await clearAndReseedTrainingDatabase({});
                const c = res.clearCounts;
                const ws =
                  typeof res.workshopUnitsInserted === "number"
                    ? res.workshopUnitsInserted
                    : 0;
                toast.success(
                  `Cleared and re-seeded: ${c.certificationLevels} levels, ${res.levelCount} new levels, ${res.unitCount} units (${ws} live workshop), ${res.prerequisiteCount} prerequisite links. Roadmap pins cleared: ${c.userRoadmapPinsCleared} users.`,
                );
              } catch (e) {
                toast.error(
                  e instanceof Error ? e.message : "Clear and re-seed failed",
                );
              }
            }}
          >
            <Database className="h-4 w-4 mr-1.5" />
            Clear and re-seed
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Soft-deleted records</CardTitle>
          <CardDescription>
            Certifications, units, and library content removed in Training
            Content are hidden from the app but kept here. Restore a row to make
            it visible again (links to certifications and units on lessons are
            unchanged).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">
              Certifications
            </h2>
            {deletedCerts === undefined ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : deletedCerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <ul className="divide-y rounded-md border border-border">
                {deletedCerts.map((row) => (
                  <DeletedRow
                    key={row._id}
                    primary={row.name}
                    secondary={`Deleted ${formatDeletedAt(row.deletedAt)}`}
                    busy={restoringId === row._id}
                    onRestore={() =>
                      void (async () => {
                        setRestoringId(row._id);
                        try {
                          await restoreCert({ levelId: row._id });
                          toast.success(`Restored “${row.name}”`);
                        } catch (e) {
                          toast.error(
                            e instanceof Error ? e.message : "Restore failed",
                          );
                        } finally {
                          setRestoringId(null);
                        }
                      })()
                    }
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Units</h2>
            {deletedUnits === undefined ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : deletedUnits.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <ul className="divide-y rounded-md border border-border">
                {deletedUnits.map((row) => (
                  <DeletedRow
                    key={row._id}
                    primary={row.title}
                    secondary={`Deleted ${formatDeletedAt(row.deletedAt)}`}
                    busy={restoringId === row._id}
                    onRestore={() =>
                      void (async () => {
                        setRestoringId(row._id);
                        try {
                          await restoreUnit({ unitId: row._id });
                          toast.success(`Restored “${row.title}”`);
                        } catch (e) {
                          toast.error(
                            e instanceof Error ? e.message : "Restore failed",
                          );
                        } finally {
                          setRestoringId(null);
                        }
                      })()
                    }
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Content</h2>
            {deletedContent === undefined ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : deletedContent.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <ul className="divide-y rounded-md border border-border">
                {deletedContent.map((row) => (
                  <DeletedRow
                    key={row._id}
                    primary={row.title}
                    secondary={`${row.type} · deleted ${formatDeletedAt(row.deletedAt)}`}
                    busy={restoringId === row._id}
                    onRestore={() =>
                      void (async () => {
                        setRestoringId(row._id);
                        try {
                          await restoreContent({ contentId: row._id });
                          toast.success(`Restored “${row.title}”`);
                        } catch (e) {
                          toast.error(
                            e instanceof Error ? e.message : "Restore failed",
                          );
                        } finally {
                          setRestoringId(null);
                        }
                      })()
                    }
                  />
                ))}
              </ul>
            )}
          </section>
        </CardContent>
      </Card>

      <Dialog
        open={clearTrainingDialogOpen}
        onOpenChange={setClearTrainingDialogOpen}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Clear all test data?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes certification levels, units, content items,
            assignments, prerequisite rules, curriculum category and link rows,
            all step-level progress, progress events, workshop session sync logs,
            user progress, and quiz/test results, and removes pinned
            certification plans from every user. Companies and user accounts are
            kept.
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
                  toast.error(e instanceof Error ? e.message : "Clear failed");
                }
              }}
            >
              Clear now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeletedRow({
  primary,
  secondary,
  busy,
  onRestore,
}: {
  primary: string;
  secondary: string;
  busy: boolean;
  onRestore: () => void;
}) {
  return (
    <li className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{primary}</p>
        <p className="text-xs text-muted-foreground">{secondary}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 self-start sm:self-center"
        disabled={busy}
        onClick={onRestore}
      >
        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
        {busy ? "Restoring…" : "Restore"}
      </Button>
    </li>
  );
}
