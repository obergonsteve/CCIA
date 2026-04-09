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
import { useMutation } from "convex/react";
import { Database, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminDatabaseClient() {
  const clearTrainingData = useMutation(api.seed.adminClearTrainingData);
  const seedTrainingDatabase = useMutation(api.seed.adminSeedTrainingDatabase);
  const [clearTrainingDialogOpen, setClearTrainingDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Training data</h1>
        <p className="text-muted-foreground">
          Seed or clear curriculum and learner progress. Companies and user
          accounts are kept when clearing.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Database</CardTitle>
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
                    res.message ??
                      "Curriculum already seeded — clear first to re-insert.",
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
            item, assignment, prerequisite rule, progress row, and quiz result.
            Companies and users are kept.
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
