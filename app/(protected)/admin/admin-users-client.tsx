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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAction, useMutation, useQuery } from "convex/react";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function AdminUsersClient() {
  const companies = useQuery(api.companies.list);
  const users = useQuery(api.users.listAll);

  const createCompany = useMutation(api.companies.create);
  const updateCompany = useMutation(api.companies.update);
  const removeCompany = useMutation(api.companies.remove);
  const adminUpdateUserProfile = useMutation(api.users.adminUpdateProfile);
  const adminDeleteUser = useMutation(api.users.adminDelete);
  const adminSetPassword = useAction(api.auth.adminSetPassword);
  const adminCreateUser = useAction(api.auth.adminCreateUser);
  const bootstrapDemo = useMutation(api.seed.bootstrapDemo);

  const [selectedCompanyId, setSelectedCompanyId] =
    useState<Id<"companies"> | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companyDeleteOpen, setCompanyDeleteOpen] = useState(false);
  const [coDetailName, setCoDetailName] = useState("");
  const [coDetailAddress, setCoDetailAddress] = useState("");
  const [coDetailEmail, setCoDetailEmail] = useState("");
  const [coDetailPhone, setCoDetailPhone] = useState("");
  const [coDetailStatus, setCoDetailStatus] = useState<
    "active" | "inactive" | "pending"
  >("active");
  const [coDetailJoined, setCoDetailJoined] = useState("");

  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPass, setNewUserPass] = useState("");
  const [newUserRole, setNewUserRole] = useState<
    "operator" | "supervisor" | "admin" | "content_creator"
  >("operator");

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

  const companyUsers = useQuery(
    api.users.listByCompany,
    selectedCompanyId ? { companyId: selectedCompanyId } : "skip",
  );

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">
          Companies and people — select a company to edit its profile and manage
          accounts. Use <strong>Add user</strong> to invite someone to the selected
          company.
        </p>
      </div>

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
                      toast.error(e instanceof Error ? e.message : "Failed");
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
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Company details</CardTitle>
                <CardDescription>
                  Profile for this organization (contact, status, onboarding date).
                  Save before switching companies. Users are managed below.
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
                        setCoDetailStatus((v ?? "active") as typeof coDetailStatus)
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
                        toast.error(e instanceof Error ? e.message : "Failed");
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
                      onChange={(e) => setNewUserEmail(e.target.value)}
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
                        setNewUserRole((v ?? "operator") as typeof newUserRole)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="operator">operator</SelectItem>
                        <SelectItem value="supervisor">supervisor</SelectItem>
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
                            <div className="font-medium truncate">{u.name}</div>
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
          )}
        </div>
      </div>

      <Dialog open={companyDeleteOpen} onOpenChange={setCompanyDeleteOpen}>
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
    </div>
  );
}
