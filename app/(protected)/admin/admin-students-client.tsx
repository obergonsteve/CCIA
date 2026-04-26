"use client";

import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
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
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useSessionUser } from "@/lib/use-session-user";
import { cn } from "@/lib/utils";
import { SendInAppNoticeDialog } from "@/components/admin/send-in-app-notice-dialog";
import { AdminUserDirectoryCertRow } from "@/components/admin/admin-user-directory-cert-row";
import {
  SendInAppNoticeRowIconButton,
  SendInAppNoticeTextButton,
} from "@/components/admin/send-in-app-notice-control";

export default function AdminStudentsClient() {
  const { user: sessionUser } = useSessionUser();
  const students = useQuery(api.users.listWithoutCompany);
  const certLevels = useQuery(api.certifications.listAllAdmin);
  const adminCreateUser = useAction(api.passwordAuthActions.adminCreateUser);
  const adminDeleteUser = useMutation(api.users.adminDelete);
  const adminSetEntitlements = useMutation(
    api.users.adminSetStudentCertificationEntitlements,
  );
  const adminRemovePlanned = useMutation(
    api.users.adminRemoveStudentPlannedCertification,
  );
  const adminReconcilePlannedToEntitled = useMutation(
    api.users.adminReconcilePlannedToEntitledForUsers,
  );
  const [removing, setRemoving] = useState<string | null>(null);
  const reconciledListKey = useRef<string | null>(null);

  const isAdmin = sessionUser?.role === "admin";
  const canWrite =
    sessionUser?.role === "admin" || sessionUser?.role === "content_creator";

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deleteId, setDeleteId] = useState<Id<"users"> | null>(null);
  const [entitlementsUserId, setEntitlementsUserId] = useState<
    Id<"users"> | null
  >(null);
  const [entitlementLevelIds, setEntitlementLevelIds] = useState<
    Id<"certificationLevels">[]
  >([]);
  const [inAppNoteTarget, setInAppNoteTarget] = useState<{
    userId: Id<"users">;
    summary: string;
  } | null>(null);
  /** Per-student: `true` = Certifications expanded; omitted = collapsed. */
  const [certsExpandedByUser, setCertsExpandedByUser] = useState<
    Record<string, boolean>
  >({});

  const levelById = useMemo(() => {
    const m = new Map<string, { name: string; code?: string }>();
    for (const l of certLevels ?? []) {
      m.set(String(l._id), { name: l.name, code: l.code });
    }
    return m;
  }, [certLevels]);

  const editingStudent = useMemo(
    () => students?.find((s) => s._id === entitlementsUserId),
    [students, entitlementsUserId],
  );

  useEffect(() => {
    if (entitlementsUserId == null || !students) {
      return;
    }
    const u = students.find((s) => s._id === entitlementsUserId);
    if (u) {
      setEntitlementLevelIds(u.studentEntitledCertificationLevelIds ?? []);
    }
  }, [entitlementsUserId, students]);

  useEffect(() => {
    if (students === undefined || students.length === 0 || !canWrite) {
      return;
    }
    const key = students
      .map((s) => s._id)
      .sort()
      .join(",");
    if (reconciledListKey.current === key) {
      return;
    }
    reconciledListKey.current = key;
    void adminReconcilePlannedToEntitled({ userIds: students.map((s) => s._id) })
      .then(() => {})
      .catch(() => {
        reconciledListKey.current = null;
      });
  }, [students, canWrite, adminReconcilePlannedToEntitled]);

  return (
    <div
      className={cn(
        "space-y-6 -mt-4",
        "[&_[data-slot=input]]:bg-white/55",
        "[&_[data-slot=textarea]]:bg-white/55",
        "[&_[data-slot=select-trigger]]:bg-white/55",
        "dark:[&_[data-slot=input]]:bg-white/[0.04]",
        "dark:[&_[data-slot=textarea]]:bg-white/[0.04]",
        "dark:[&_[data-slot=select-trigger]]:bg-white/[0.04]",
      )}
    >
      <div className="space-y-3">
        <p className="w-full min-w-0 text-muted-foreground">
          People who registered without a member (company). They can sign in and
          subscribe to training programs in the app.
        </p>
        <div className="w-full max-w-[17.25rem] space-y-3">
          {isAdmin && sessionUser ? (
            <SendInAppNoticeTextButton
              preset={null}
              initialAudience="students"
              className="w-full px-5 shadow-md"
            />
          ) : null}
          <div
            className="flex w-full gap-1.5"
            aria-hidden
          >
            <span className="h-0.5 w-[5.5rem] shrink-0 rounded-full bg-brand-lime/85 dark:bg-brand-lime/70" />
            <span className="h-0.5 w-[5.5rem] shrink-0 rounded-full bg-brand-gold/90 dark:bg-brand-gold/75" />
            <span className="h-0.5 w-[5.5rem] shrink-0 rounded-full bg-brand-sky/85 dark:bg-brand-sky/70" />
          </div>
        </div>
      </div>

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
            <CardDescription>Sorted by name.</CardDescription>
          </CardHeader>
          <CardContent>
            {students === undefined ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : students.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No student accounts yet.
              </p>
            ) : (
              <ul className="max-h-[min(520px,60vh)] space-y-2 overflow-y-auto text-sm">
                {students.map((u) => {
                  const inProgress = u.inProgressCertificationLevelIds ?? [];
                  const done = u.completedCertificationLevelIds ?? [];
                  const planned = u.plannedCertificationLevelIds ?? [];
                  const certKey = String(u._id);
                  const certsExpanded = certsExpandedByUser[certKey] === true;
                  return (
                    <AdminUserDirectoryCertRow
                      key={u._id}
                      certBreadcrumbFrom="admin-students"
                      userId={u._id}
                      name={u.name}
                      email={u.email}
                      lastLogin={u.lastLogin}
                      levelById={levelById}
                      inProgressLevelIds={inProgress}
                      completedLevelIds={done}
                      plannedLevelIds={planned}
                      certsExpanded={certsExpanded}
                      onToggleCertifications={() => {
                        setCertsExpandedByUser((prev) => {
                          const open = prev[certKey] === true;
                          return { ...prev, [certKey]: !open };
                        });
                      }}
                      removing={removing}
                      canWrite={canWrite}
                      onRemovePlanned={
                        canWrite
                          ? (levelId) => {
                              const rkey = `p:${u._id}:${levelId}`;
                              void (async () => {
                                setRemoving(rkey);
                                try {
                                  await adminRemovePlanned({
                                    userId: u._id,
                                    levelId,
                                  });
                                  toast.success("Removed from their roadmap");
                                } catch (e) {
                                  toast.error(
                                    e instanceof Error
                                      ? e.message
                                      : "Failed to remove",
                                  );
                                } finally {
                                  setRemoving(null);
                                }
                              })();
                            }
                          : undefined
                      }
                      rowActions={
                        <>
                          {canWrite ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 rounded-none text-brand-sky hover:bg-brand-sky/15 hover:text-brand-sky dark:text-brand-sky/90 dark:hover:bg-brand-sky/20 dark:hover:text-brand-sky"
                              title="Change which certifications this student may start"
                              aria-label="Change which certifications this student may start"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEntitlementsUserId(u._id);
                              }}
                            >
                              <GraduationCap
                                className="h-2.5 w-2.5"
                                aria-hidden
                              />
                            </Button>
                          ) : null}
                          {isAdmin ? (
                            <SendInAppNoticeRowIconButton
                              compact
                              title="Send in-app note to this student"
                              tooltip="Send in-app note to this student"
                              onOpen={() => {
                                setInAppNoteTarget({
                                  userId: u._id,
                                  summary: `${u.name} · ${u.email}`,
                                });
                              }}
                            />
                          ) : null}
                          {isAdmin ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 rounded-none text-destructive hover:bg-destructive/12 hover:text-destructive dark:hover:bg-destructive/15"
                              title="Remove account"
                              aria-label="Remove account"
                              onClick={() => {
                                setDeleteId(u._id);
                              }}
                            >
                              <Trash2 className="h-2.5 w-2.5" aria-hidden />
                            </Button>
                          ) : null}
                        </>
                      }
                    />
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={entitlementsUserId != null}
        onOpenChange={(o) => {
          if (!o) {
            setEntitlementsUserId(null);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[min(90vh,560px)] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Certifications they can start
              {editingStudent ? (
                <span className="mt-1 block text-base font-normal text-muted-foreground">
                  {editingStudent.name} · {editingStudent.email}
                </span>
              ) : null}
            </DialogTitle>
            <DialogDescription>
              Check every public certification this student is allowed to{" "}
              <strong>start</strong> (for example what they have paid for). They can
              still <strong>view</strong> other certifications, but will not be able
              to add unassigned ones to their roadmap or open those units. Their
              personal roadmap (below in the list) is separate — they set that
              in the app from assigned certifications.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto space-y-2 pr-1">
            {certLevels === undefined ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : certLevels.length === 0 ? (
              <p className="text-sm text-muted-foreground">No certifications in the system.</p>
            ) : (
              certLevels.map((lvl) => {
                const idStr = String(lvl._id);
                const checked = entitlementLevelIds.some((x) => String(x) === idStr);
                return (
                  <label
                    key={idStr}
                    className="flex items-start gap-2 rounded-md border border-border/60 p-2 text-sm cursor-pointer hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5 rounded border-input"
                      checked={checked}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setEntitlementLevelIds((prev) => {
                          if (on) {
                            return prev.some((x) => String(x) === idStr)
                              ? prev
                              : [...prev, lvl._id];
                          }
                          return prev.filter((x) => String(x) !== idStr);
                        });
                      }}
                    />
                    <span className="min-w-0">
                      <span className="font-medium">{lvl.name}</span>
                      {lvl.code?.trim() ? (
                        <span className="ml-1.5 text-xs font-mono text-muted-foreground">
                          {lvl.code.trim()}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEntitlementsUserId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!entitlementsUserId || certLevels === undefined}
              onClick={async () => {
                if (!entitlementsUserId) {
                  return;
                }
                try {
                  await adminSetEntitlements({
                    userId: entitlementsUserId,
                    levelIds: entitlementLevelIds,
                  });
                  toast.success("Certifications updated");
                  setEntitlementsUserId(null);
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Failed to save",
                  );
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <SendInAppNoticeDialog
        open={inAppNoteTarget != null}
        onOpenChange={(o) => {
          if (!o) {
            setInAppNoteTarget(null);
          }
        }}
        preset={null}
        targetUserId={inAppNoteTarget?.userId}
        targetUserSummary={inAppNoteTarget?.summary}
      />
    </div>
  );
}
