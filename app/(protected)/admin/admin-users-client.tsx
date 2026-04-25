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
import {
  Building2,
  Landmark,
  Pencil,
  Plus,
  Trash2,
  Users as UsersIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  SendInAppNoticeRowIconButton,
  SendInAppNoticeTextButton,
} from "@/components/admin/send-in-app-notice-control";
import { SendInAppNoticeDialog } from "@/components/admin/send-in-app-notice-dialog";
import {
  isValidAustraliaIanaTimeZone,
  isValidIanaTimeZone,
  listAustraliaIanaTimeZones,
} from "@/lib/iana-timezone";
import { AdminUserDirectoryCertRow } from "@/components/admin/admin-user-directory-cert-row";
import { useSessionUser } from "@/lib/use-session-user";
import { cn } from "@/lib/utils";

export default function AdminUsersClient() {
  const { user: sessionUser } = useSessionUser();
  const companies = useQuery(api.companies.list);
  const users = useQuery(api.users.listAll);

  const createCompany = useMutation(api.companies.create);
  const updateCompany = useMutation(api.companies.update);
  const removeCompany = useMutation(api.companies.remove);
  const adminUpdateUserProfile = useMutation(api.users.adminUpdateProfile);
  const adminDeleteUser = useMutation(api.users.adminDelete);
  const adminSetPassword = useAction(api.auth.adminSetPassword);
  const adminCreateUser = useAction(api.auth.adminCreateUser);
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
  const [coDetailTimezone, setCoDetailTimezone] = useState("");

  const allIanaTimeZones = useMemo(
    () => listAustraliaIanaTimeZones(),
    [],
  );
  const companyFormHydratedForId = useRef<Id<"companies"> | null>(null);

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

  const [userNoticeOpen, setUserNoticeOpen] = useState(false);
  const [userNoticeTarget, setUserNoticeTarget] = useState<{
    _id: Id<"users">;
    name: string;
    email: string;
  } | null>(null);

  const [companyNoticeOpen, setCompanyNoticeOpen] = useState(false);
  const [companyNoticeCompanyId, setCompanyNoticeCompanyId] =
    useState<Id<"companies"> | null>(null);

  const isAdmin = sessionUser?.role === "admin";
  const canWrite =
    sessionUser?.role === "admin" || sessionUser?.role === "content_creator";
  const certLevels = useQuery(api.certifications.listAllAdmin);
  const companyUsers = useQuery(
    api.users.listByCompany,
    selectedCompanyId ? { companyId: selectedCompanyId } : "skip",
  );
  /** Per user id: `true` = Certifications expanded. */
  const [memberCertsExpanded, setMemberCertsExpanded] = useState<
    Record<string, boolean>
  >({});

  const levelById = useMemo(() => {
    const m = new Map<string, { name: string; code?: string }>();
    for (const l of certLevels ?? []) {
      m.set(String(l._id), { name: l.name, code: l.code });
    }
    return m;
  }, [certLevels]);

  const memberCounts = useMemo(() => {
    const m = new Map<Id<"companies">, number>();
    for (const u of users ?? []) {
      if (u.companyId) {
        m.set(u.companyId, (m.get(u.companyId) ?? 0) + 1);
      }
    }
    return m;
  }, [users]);

  const userEditCompanyTriggerLabel = useMemo(() => {
    if (!userEditCompanyId) {
      return null;
    }
    if (companies === undefined) {
      return "Loading…";
    }
    return (
      companies.find((c) => c._id === userEditCompanyId)?.name ??
      "Unknown member"
    );
  }, [companies, userEditCompanyId]);

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

  const coTimezoneSelectOptions = useMemo(() => {
    const base = allIanaTimeZones;
    const v = coDetailTimezone.trim();
    if (v && isValidIanaTimeZone(v) && !base.includes(v)) {
      return [v, ...base].sort((a, b) => a.localeCompare(b));
    }
    return base;
  }, [allIanaTimeZones, coDetailTimezone]);

  /**
   * Hydrate company form only when switching the selected company (or first load
   * for that id). Do not re-run on every `companies` refetch — that was resetting
   * the form and blocking edits (e.g. time zone) mid-edit.
   */
  useEffect(() => {
    if (selectedCompanyId == null) {
      companyFormHydratedForId.current = null;
      return;
    }
    if (companies === undefined) {
      return;
    }
    const c = companies.find((x) => x._id === selectedCompanyId);
    if (!c) {
      return;
    }
    if (companyFormHydratedForId.current === selectedCompanyId) {
      return;
    }
    companyFormHydratedForId.current = selectedCompanyId;
    setCoDetailName(c.name);
    setCoDetailAddress(c.address ?? "");
    setCoDetailEmail(c.email ?? "");
    setCoDetailPhone(c.phone ?? "");
    setCoDetailStatus(
      c.status === "inactive" || c.status === "pending" ? c.status : "active",
    );
    const j = c.joinedAt;
    if (j != null && typeof j === "number") {
      const d = new Date(j);
      setCoDetailJoined(
        Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10),
      );
    } else {
      setCoDetailJoined("");
    }
    setCoDetailTimezone(
      c.timezone && c.timezone.trim() ? c.timezone.trim() : "",
    );
  }, [selectedCompanyId, companies]);

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
          Manage the members and users that have access to LLLIA Training.
        </p>
        <div className="w-full max-w-[17.25rem] space-y-3">
          {isAdmin && sessionUser ? (
            <SendInAppNoticeTextButton
              preset={null}
              defaultCompanyId={selectedCompanyId ?? undefined}
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

      <div className="grid lg:grid-cols-[minmax(0,280px)_1fr] gap-6 items-start">
        <div className="space-y-4">
          <Card className="gap-1 border border-border/80 bg-card py-3 shadow-sm ring-1 ring-foreground/10 dark:border-white/10 dark:ring-foreground/8 border-l-4 border-l-brand-lime/55">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2
                  className="h-4 w-4 shrink-0 text-brand-lime/90"
                  aria-hidden
                />
                Members
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-0">
              <div className="flex gap-2">
                <Input
                  placeholder="New member name"
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
                      toast.success("Member created");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Failed");
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="h-[min(680px,72vh)] rounded-md border border-border/60 dark:border-white/10">
                <ul className="p-0">
                  {(companies ?? []).map((c) => {
                    const count = memberCounts.get(c._id) ?? 0;
                    const active = selectedCompanyId === c._id;
                    return (
                      <li key={c._id} className="p-0">
                        <div
                          data-active={active ? "true" : undefined}
                          className={cn(
                            "group flex rounded-sm border transition-colors",
                            active
                              ? "border-transparent bg-brand-lime/16 ring-1 ring-inset ring-brand-lime/45 dark:bg-brand-lime/18 dark:ring-brand-lime/55"
                              : "border-transparent hover:bg-muted/30",
                          )}
                        >
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 flex-col items-start gap-0 px-2 py-0.5 text-left text-sm leading-tight"
                            onClick={() => setSelectedCompanyId(c._id)}
                          >
                            <span className="block w-full truncate font-medium leading-tight">
                              {c.name}
                            </span>
                            <span className="text-xs leading-tight text-muted-foreground">
                              {count} user{count === 1 ? "" : "s"}
                            </span>
                          </button>
                          <div
                            className={cn(
                              "flex flex-col border-l shrink-0 self-stretch transition-opacity duration-150",
                              "opacity-100 md:pointer-events-none md:opacity-0",
                              "md:group-hover:pointer-events-auto md:group-hover:opacity-100",
                              "md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100",
                            )}
                          >
                            {isAdmin && sessionUser ? (
                              <SendInAppNoticeRowIconButton
                                onOpen={() => {
                                  setCompanyNoticeCompanyId(c._id);
                                  setCompanyNoticeOpen(true);
                                }}
                                title="Send in-app note for this member"
                                tooltip="Notify everyone in this member, or pick one person in the form."
                                className="!h-7 !w-7 min-h-0 min-w-0 rounded-none"
                              />
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="h-7 w-7 min-h-0 min-w-0 rounded-none text-destructive hover:text-destructive"
                              title="Delete member"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCompanyId(c._id);
                                setCompanyDeleteOpen(true);
                              }}
                            >
                              <Trash2 className="size-3.5" aria-hidden />
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

        <div className="min-w-0 max-w-4xl space-y-4">
          {!selectedCompany || !selectedCompanyId ? (
            <Card className="border border-dashed border-muted-foreground/20 bg-gradient-to-br from-brand-lime/[0.04] via-brand-gold/[0.04] to-brand-sky/[0.05] dark:from-brand-lime/[0.05] dark:via-brand-gold/[0.05] dark:to-brand-sky/[0.07]">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Add a member on the left, then select it to manage users.
              </CardContent>
            </Card>
          ) : (
            <>
            <Card className="gap-2 border border-brand-gold/40 border-l-4 border-l-brand-gold bg-brand-gold/[0.07] shadow-sm ring-brand-gold/15 dark:border-brand-gold/35 dark:bg-brand-gold/[0.10] dark:ring-brand-gold/10">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Landmark
                    className="h-4 w-4 shrink-0 text-brand-gold"
                    aria-hidden
                  />
                  Member details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
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
                    <Label htmlFor="co-email">Email</Label>
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
                        <SelectValue>
                          {(v: unknown) => {
                            const s =
                              typeof v === "string" && v
                                ? v
                                : coDetailStatus;
                            return s
                              ? s.charAt(0).toUpperCase() + s.slice(1)
                              : "";
                          }}
                        </SelectValue>
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
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="co-timezone">Timezone</Label>
                    <select
                      id="co-timezone"
                      name="co-timezone"
                      value={coDetailTimezone}
                      onChange={(e) => {
                        setCoDetailTimezone(e.target.value);
                      }}
                      className={cn(
                        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm",
                        "shadow-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                        "md:text-sm dark:bg-input/30",
                      )}
                      aria-label="Select member timezone; choose Not set to clear"
                    >
                      <option value="">
                        Not set (user’s browser / local default)
                      </option>
                      {coTimezoneSelectOptions.map((z) => (
                        <option key={z} value={z}>
                          {z}
                        </option>
                      ))}
                    </select>
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
                      if (!isValidAustraliaIanaTimeZone(coDetailTimezone)) {
                        toast.error(
                          "Time zone must be empty or a valid Australia IANA zone (e.g. Australia/Sydney).",
                        );
                        return;
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
                          timezone: coDetailTimezone,
                        });
                        toast.success("Member saved");
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                  >
                    Save member details
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/40 hover:bg-destructive/10"
                    onClick={() => setCompanyDeleteOpen(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Delete member
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-300/45 border-l-4 border-l-slate-400 bg-slate-50/80 shadow-sm dark:border-slate-600/45 dark:bg-slate-900/35 dark:border-l-slate-500">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <UsersIcon
                    className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300"
                    aria-hidden
                  />
                  Users
                </CardTitle>
                <CardDescription>
                  Accounts for this member. <strong>Certifications</strong> shows
                  progress, roadmap, and completed (learner dashboard rules). Add
                  people and manage roles below; profile edit and remove are on each
                  row.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 rounded-lg border border-slate-300/40 bg-white/55 p-4 shadow-sm dark:border-slate-600/40 dark:bg-slate-950/25">
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
                  {certLevels === undefined || companyUsers === undefined ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : companyUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center border rounded-md">
                      No users yet. Add one above.
                    </p>
                  ) : (
                    <ul className="max-h-[min(520px,60vh)] space-y-2 overflow-y-auto text-sm">
                      {companyUsers.map((u) => {
                        const certKey = String(u._id);
                        const certsExpanded =
                          memberCertsExpanded[certKey] === true;
                        return (
                          <AdminUserDirectoryCertRow
                            key={u._id}
                            certBreadcrumbFrom="admin-users"
                            userId={u._id}
                            name={u.name}
                            email={u.email}
                            lastLogin={u.lastLogin}
                            levelById={levelById}
                            inProgressLevelIds={
                              u.inProgressCertificationLevelIds ?? []
                            }
                            completedLevelIds={
                              u.completedCertificationLevelIds ?? []
                            }
                            plannedLevelIds={u.plannedCertificationLevelIds ?? []}
                            certsExpanded={certsExpanded}
                            onToggleCertifications={() => {
                              setMemberCertsExpanded((prev) => {
                                const open = prev[certKey] === true;
                                return { ...prev, [certKey]: !open };
                              });
                            }}
                            removing={null}
                            canWrite={canWrite}
                            rowActions={
                              <>
                                {isAdmin ? (
                                  <SendInAppNoticeRowIconButton
                                    compact
                                    title="Send in-app note to this user"
                                    tooltip="Send in-app note to this user"
                                    onOpen={() => {
                                      setUserNoticeTarget({
                                        _id: u._id,
                                        name: u.name,
                                        email: u.email,
                                      });
                                      setUserNoticeOpen(true);
                                    }}
                                  />
                                ) : null}
                                {canWrite ? (
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 shrink-0 rounded-none text-brand-sky hover:bg-brand-sky/15 hover:text-brand-sky dark:text-brand-sky/90 dark:hover:bg-brand-sky/20 dark:hover:text-brand-sky"
                                    title={`Edit account — ${u.name}`}
                                    aria-label={`Edit account — ${u.name}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setUserEditId(u._id);
                                      setUserEditName(u.name);
                                      setUserEditEmail(u.email);
                                      setUserEditRole(u.role);
                                      setUserEditCompanyId(u.companyId ?? "");
                                      setUserEditPassword("");
                                      setUserEditOpen(true);
                                    }}
                                  >
                                    <Pencil
                                      className="h-2.5 w-2.5"
                                      aria-hidden
                                    />
                                  </Button>
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
                                      setUserDeleteId(u._id);
                                      setUserDeleteOpen(true);
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
                </div>
              </CardContent>
            </Card>
            </>
          )}
        </div>
      </div>

      <Dialog open={companyDeleteOpen} onOpenChange={setCompanyDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete member?</DialogTitle>
            <DialogDescription>
              {selectedCompany
                ? `Permanently delete “${selectedCompany.name}”. You must remove or move every user first; otherwise this will fail.`
                : "Delete this member?"}
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
                  toast.success("Member deleted");
                  setCompanyDeleteOpen(false);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Delete member
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
              Change profile, member, or set a new password (optional, min 8
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
              <Label>Member</Label>
              <Select
                value={userEditCompanyId}
                onValueChange={(v) => setUserEditCompanyId(v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select member">
                    {userEditCompanyTriggerLabel}
                  </SelectValue>
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

      {isAdmin && sessionUser ? (
        <>
          <SendInAppNoticeDialog
            open={userNoticeOpen}
            onOpenChange={(o) => {
              setUserNoticeOpen(o);
              if (!o) {
                setUserNoticeTarget(null);
              }
            }}
            preset={null}
            targetUserId={userNoticeTarget?._id}
            targetUserSummary={
              userNoticeTarget
                ? `${userNoticeTarget.name} (${userNoticeTarget.email})`
                : undefined
            }
            defaultCompanyId={selectedCompanyId ?? undefined}
          />
          <SendInAppNoticeDialog
            open={companyNoticeOpen}
            onOpenChange={(o) => {
              setCompanyNoticeOpen(o);
              if (!o) {
                setCompanyNoticeCompanyId(null);
              }
            }}
            preset={null}
            defaultCompanyId={companyNoticeCompanyId ?? undefined}
            initialAudience="company"
          />
        </>
      ) : null}
    </div>
  );
}
