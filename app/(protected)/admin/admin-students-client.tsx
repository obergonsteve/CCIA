"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAction, useMutation, useQuery } from "convex/react";
import { GraduationCap, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useSessionUser } from "@/lib/use-session-user";
import { cn } from "@/lib/utils";

function formatLastLogin(ms: number | undefined) {
  if (ms == null) {
    return "—";
  }
  return new Date(ms).toLocaleString();
}

export default function AdminStudentsClient() {
  const { user: sessionUser } = useSessionUser();
  const students = useQuery(api.users.listWithoutCompany);
  const adminCreateUser = useAction(api.auth.adminCreateUser);
  const adminDeleteUser = useMutation(api.users.adminDelete);

  const isAdmin = sessionUser?.role === "admin";
  const canWrite =
    sessionUser?.role === "admin" || sessionUser?.role === "content_creator";

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deleteId, setDeleteId] = useState<Id<"users"> | null>(null);

  return (
    <div
      className={cn(
        "space-y-6 -mt-4",
        "[&_[data-slot=input]]:bg-white/55",
        "dark:[&_[data-slot=input]]:bg-white/[0.04]",
      )}
    >
      <p className="w-full min-w-0 text-muted-foreground">
        People who registered without a member (company). They can sign in and
        subscribe to training programs in the app.
      </p>

      <div className="space-y-4 max-w-4xl">
        <Card className="border border-brand-gold/40 border-l-4 border-l-brand-gold bg-brand-gold/[0.07] shadow-sm ring-brand-gold/15 dark:border-brand-gold/35 dark:bg-brand-gold/[0.10] dark:ring-brand-gold/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap
                className="h-4 w-4 shrink-0 text-brand-gold"
                aria-hidden
              />
              Add a student
            </CardTitle>
            <CardDescription>
              Create an account with no member — only name, email, and password
              are required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canWrite ? (
              <div className="space-y-3 rounded-lg border border-brand-gold/25 bg-brand-gold/[0.04] p-4 dark:border-brand-gold/20 dark:bg-brand-gold/[0.06]">
                <div className="grid sm:grid-cols-2 gap-3 max-w-2xl">
                  <Input
                    placeholder="Name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    autoComplete="off"
                  />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    autoComplete="off"
                  />
                  <Input
                    type="password"
                    placeholder="Temporary password (min 8 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={async () => {
                    if (!newEmail.trim() || !newPassword) {
                      toast.error("Email and password are required");
                      return;
                    }
                    if (newPassword.length < 8) {
                      toast.error("Password must be at least 8 characters");
                      return;
                    }
                    try {
                      await adminCreateUser({
                        name: newName.trim() || newEmail.trim(),
                        email: newEmail.trim().toLowerCase(),
                        password: newPassword,
                        role: "operator",
                      });
                      toast.success("Student account created");
                      setNewName("");
                      setNewEmail("");
                      setNewPassword("");
                    } catch (e) {
                      toast.error(
                        e instanceof Error ? e.message : "Failed to create",
                      );
                    }
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create student
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                You can view this list, but only admins and content creators can
                add accounts.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border border-slate-300/45 border-l-4 border-l-slate-400 bg-slate-50/80 shadow-sm dark:border-slate-600/45 dark:bg-slate-900/35 dark:border-l-slate-500">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap
                className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300"
                aria-hidden
              />
              Students
            </CardTitle>
            <CardDescription>
              Accounts with no member; sorted by name.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {students === undefined ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : students.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No student accounts yet.
              </p>
            ) : (
              <ul className="divide-y rounded-md border max-h-[min(480px,55vh)] overflow-y-auto">
                {students.map((u) => (
                  <li
                    key={u._id}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{u.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {u.email} · {u.role} · last sign-in:{" "}
                        {formatLastLogin(u.lastLogin)}
                      </div>
                    </div>
                    {isAdmin ? (
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive shrink-0"
                        title="Remove account"
                        onClick={() => {
                          setDeleteId(u._id);
                        }}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={deleteId != null}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this account?</DialogTitle>
            <DialogDescription>
              This permanently deletes the student and their training progress
              in this app. It cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!deleteId}
              onClick={async () => {
                if (!deleteId) {
                  return;
                }
                try {
                  await adminDeleteUser({ userId: deleteId });
                  toast.success("Account removed");
                  setDeleteId(null);
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Failed to remove",
                  );
                }
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
