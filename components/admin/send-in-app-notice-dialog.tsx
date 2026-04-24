"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useMutation, useQuery } from "convex/react";
import { useSessionUser } from "@/lib/use-session-user";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Triggers must fill width, allow shrink, and truncate (base trigger uses nowrap + w-fit). */
const inAppSelectTrigger = cn(
  "h-9 w-full min-w-0 max-w-full justify-between gap-2 !whitespace-normal overflow-hidden text-left text-sm shadow-sm",
  "[&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate",
);
const inAppSelectTriggerCompact = cn(
  inAppSelectTrigger,
  "h-8",
);

export type SendInAppNoticePreset =
  | { kind: "certificationLevel"; levelId: Id<"certificationLevels"> }
  | { kind: "unit"; unitId: Id<"units">; levelId?: Id<"certificationLevels"> }
  | {
      kind: "content";
      contentId: Id<"contentItems">;
      unitId: Id<"units">;
      levelId?: Id<"certificationLevels">;
      workshopSessionId?: Id<"workshopSessions">;
    };

type SendInAppNoticeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, link target is fixed (no link type / catalog dropdowns). */
  preset: SendInAppNoticePreset | null;
  /** Shown when `preset` is set, e.g. the cert/unit/content title. */
  presetSummary?: string;
  /** Default company when scope is "company" (e.g. Users admin page). */
  defaultCompanyId?: Id<"companies">;
  /**
   * When the dialog opens, set “Who receives it” to the matching scope.
   * Use `"company"` with `defaultCompanyId` from a company row (Users admin).
   */
  initialAudience?: "all" | "company";
  /**
   * When set, the note is sent only to this user; audience pickers are hidden.
   * Use with `preset={null}` for a full link form targeted at one person.
   */
  targetUserId?: Id<"users">;
  /** e.g. name and email, shown in the “Who receives it” line. */
  targetUserSummary?: string;
};

export function SendInAppNoticeDialog({
  open,
  onOpenChange,
  preset,
  presetSummary,
  defaultCompanyId,
  initialAudience = "all",
  targetUserId,
  targetUserSummary,
}: SendInAppNoticeDialogProps) {
  const { user: sessionUser } = useSessionUser();
  const companies = useQuery(api.companies.list, open ? {} : "skip");
  const adminSendInAppNotification = useMutation(
    api.userNotifications.adminSendInAppNotification,
  );

  const [inAppScope, setInAppScope] = useState<"all" | "company">("all");
  const [inAppCompanyId, setInAppCompanyId] = useState<Id<"companies"> | null>(
    null,
  );
  /** When scope is company: `__all__` = everyone in that company; else one user id. */
  const [inAppCompanyRecipient, setInAppCompanyRecipient] =
    useState<string>("__all__");
  const [inAppTitle, setInAppTitle] = useState("");
  const [inAppBody, setInAppBody] = useState("");
  const [inAppImportance, setInAppImportance] = useState<
    "low" | "normal" | "high" | "urgent"
  >("normal");
  const [inAppLinkHref, setInAppLinkHref] = useState("");
  const [inAppLinkMode, setInAppLinkMode] = useState<
    "none" | "cert" | "unit" | "content" | "manual"
  >("none");
  const [inAppCertCat, setInAppCertCat] = useState<string>("__all__");
  const [inAppUnitCat, setInAppUnitCat] = useState<string>("__all__");
  const [inAppContentCat, setInAppContentCat] = useState<string>("__all__");
  const [inAppContentUnitId, setInAppContentUnitId] = useState<string>("__all__");
  const [inAppPickedLevelId, setInAppPickedLevelId] = useState<string>("");
  const [inAppPickedUnitId, setInAppPickedUnitId] = useState<string>("");
  const [inAppPickedContentKey, setInAppPickedContentKey] = useState("");

  const inAppDataOpen = open && sessionUser?.role === "admin" && !preset;
  const certCategories = useQuery(
    api.certificationCategories.listAdmin,
    inAppDataOpen ? {} : "skip",
  );
  const unitCategories = useQuery(
    api.unitCategories.listAdmin,
    inAppDataOpen ? {} : "skip",
  );
  const contentCategories = useQuery(
    api.contentCategories.listAdmin,
    inAppDataOpen ? {} : "skip",
  );
  const allLevels = useQuery(
    api.certifications.listAllAdmin,
    inAppDataOpen ? {} : "skip",
  );
  const allUnits = useQuery(
    api.units.listAllAdmin,
    inAppDataOpen ? {} : "skip",
  );
  const contentLinkRows = useQuery(
    api.content.listRowsForLinkPickerAdmin,
    inAppDataOpen
      ? {
          contentCategoryId:
            inAppContentCat !== "__all__"
              ? (inAppContentCat as Id<"contentCategories">)
              : undefined,
          unitId:
            inAppContentUnitId !== "__all__"
              ? (inAppContentUnitId as Id<"units">)
              : undefined,
        }
      : "skip",
  );

  const levelsForCertFilter = useMemo(() => {
    if (!allLevels) {
      return [];
    }
    if (inAppCertCat === "__all__") {
      return allLevels;
    }
    return allLevels.filter(
      (l) => l.certificationCategoryId === inAppCertCat,
    );
  }, [allLevels, inAppCertCat]);

  const unitsForLinkFilter = useMemo(() => {
    if (!allUnits) {
      return [];
    }
    if (inAppUnitCat === "__all__") {
      return allUnits;
    }
    return allUnits.filter((r) => r.unitCategoryId === inAppUnitCat);
  }, [allUnits, inAppUnitCat]);

  const inAppScopeLabel =
    inAppScope === "all"
      ? "All users (every company)"
      : "Selected company only";

  const singleUserTarget = targetUserId != null;

  const inAppCompanyUsers = useQuery(
    api.users.listByCompany,
    open &&
      sessionUser?.role === "admin" &&
      !singleUserTarget &&
      inAppScope === "company" &&
      inAppCompanyId
      ? { companyId: inAppCompanyId }
      : "skip",
  );

  const inAppCompanyUserTriggerLabel = useMemo(() => {
    if (inAppCompanyRecipient === "__all__") {
      return "Everyone in this company";
    }
    if (inAppCompanyUsers === undefined) {
      return "Loading…";
    }
    const u = inAppCompanyUsers.find((x) => x._id === inAppCompanyRecipient);
    if (!u) {
      return "Select a user";
    }
    return `${u.name} (${u.email})`;
  }, [inAppCompanyRecipient, inAppCompanyUsers]);

  useEffect(() => {
    if (inAppCompanyRecipient === "__all__" || inAppCompanyUsers === undefined) {
      return;
    }
    const ok = inAppCompanyUsers.some((u) => u._id === inAppCompanyRecipient);
    if (!ok) {
      setInAppCompanyRecipient("__all__");
    }
  }, [inAppCompanyUsers, inAppCompanyRecipient]);

  const inAppCompanyTriggerLabel = useMemo(() => {
    if (inAppCompanyId == null) {
      return null;
    }
    if (companies === undefined) {
      return "Loading…";
    }
    return (
      companies.find((c) => c._id === inAppCompanyId)?.name ?? "Unknown company"
    );
  }, [companies, inAppCompanyId]);

  const certCategoryFilterLabel = useMemo(() => {
    if (inAppCertCat === "__all__") {
      return "All categories";
    }
    const c = certCategories?.find((x) => x._id === inAppCertCat);
    if (!c) {
      return inAppCertCat;
    }
    return `${c.shortCode} — ${c.longDescription.slice(0, 48)}${
      c.longDescription.length > 48 ? "…" : ""
    }`;
  }, [inAppCertCat, certCategories]);

  const unitCategoryFilterLabel = useMemo(() => {
    if (inAppUnitCat === "__all__") {
      return "All categories";
    }
    return (
      unitCategories?.find((x) => x._id === inAppUnitCat)?.shortCode ??
      inAppUnitCat
    );
  }, [inAppUnitCat, unitCategories]);

  const contentCategoryFilterLabel = useMemo(() => {
    if (inAppContentCat === "__all__") {
      return "All categories";
    }
    return (
      contentCategories?.find((x) => x._id === inAppContentCat)?.shortCode ??
      inAppContentCat
    );
  }, [inAppContentCat, contentCategories]);

  const contentUnitFilterLabel = useMemo(() => {
    if (inAppContentUnitId === "__all__") {
      return "All units";
    }
    return (
      allUnits?.find((x) => x._id === inAppContentUnitId)?.title ??
      inAppContentUnitId
    );
  }, [inAppContentUnitId, allUnits]);

  const linkModeLabel = useMemo(() => {
    switch (inAppLinkMode) {
      case "none":
        return "No link";
      case "cert":
        return "Certification";
      case "unit":
        return "Unit";
      case "content":
        return "Content (in a unit)";
      case "manual":
        return "Manual path";
      default:
        return "No link";
    }
  }, [inAppLinkMode]);

  const pickedCertificationName = useMemo(() => {
    if (!inAppPickedLevelId) {
      return null;
    }
    return (
      allLevels?.find((l) => l._id === inAppPickedLevelId)?.name ??
      inAppPickedLevelId
    );
  }, [inAppPickedLevelId, allLevels]);

  const pickedUnitTitle = useMemo(() => {
    if (!inAppPickedUnitId) {
      return null;
    }
    return (
      allUnits?.find((u) => u._id === inAppPickedUnitId)?.title ??
      inAppPickedUnitId
    );
  }, [inAppPickedUnitId, allUnits]);

  const pickedContentRowLabel = useMemo(() => {
    if (!inAppPickedContentKey) {
      return null;
    }
    return (
      contentLinkRows?.find(
        (r) => `${r.contentId}\t${r.unitId}` === inAppPickedContentKey,
      )?.label ?? inAppPickedContentKey
    );
  }, [inAppPickedContentKey, contentLinkRows]);

  useEffect(() => {
    if (open && defaultCompanyId && !singleUserTarget) {
      setInAppCompanyId(defaultCompanyId);
    }
  }, [open, defaultCompanyId, singleUserTarget]);

  const resetForm = useCallback(() => {
    setInAppTitle("");
    setInAppBody("");
    setInAppLinkHref("");
    setInAppLinkMode("none");
    setInAppCertCat("__all__");
    setInAppUnitCat("__all__");
    setInAppContentCat("__all__");
    setInAppContentUnitId("__all__");
    setInAppPickedLevelId("");
    setInAppPickedUnitId("");
    setInAppPickedContentKey("");
    setInAppScope("all");
    setInAppImportance("normal");
    setInAppCompanyId(null);
    setInAppCompanyRecipient("__all__");
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    resetForm();
    if (defaultCompanyId && !singleUserTarget) {
      setInAppCompanyId(defaultCompanyId);
    }
    if (initialAudience === "company" && !singleUserTarget) {
      setInAppScope("company");
    }
  }, [
    open,
    defaultCompanyId,
    initialAudience,
    resetForm,
    singleUserTarget,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[min(92dvh,40rem)] min-h-0 w-full flex-col gap-0 overflow-hidden p-0",
          "border border-red-600/50 ring-1 ring-red-500/20 dark:border-red-500/45 dark:ring-red-400/15",
          "sm:max-w-md",
        )}
      >
        <DialogHeader className="shrink-0 space-y-0 border-b border-border/50 px-4 pb-3 pt-4 pr-12 text-left sm:text-left">
          <DialogTitle className="text-lg text-red-700 dark:text-red-400">
            Send in-app note
          </DialogTitle>
        </DialogHeader>
        <div
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-3 [scrollbar-gutter:stable]"
        >
        <div
          className="space-y-4 text-sm [&_[data-slot=label]]:text-[color-mix(in_oklab,var(--brand-lime)_58%,#0c0e09)] [&_[data-slot=label]]:dark:text-[color-mix(in_oklab,var(--brand-lime)_42%,#d9e0cc)]"
        >
          {singleUserTarget ? (
            <div className="space-y-2">
              <Label>Who receives it</Label>
              <p
                className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm text-foreground"
                id="inapp-single-user-summary"
              >
                <span className="font-medium text-muted-foreground">
                  This person only:{" "}
                </span>
                {targetUserSummary?.trim() || "Selected user"}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="inapp-scope">Who receives it</Label>
                <Select
                  value={inAppScope}
                  onValueChange={(v) => {
                    if (v === "all" || v === "company") {
                      setInAppScope(v);
                    }
                  }}
                >
                  <SelectTrigger
                    id="inapp-scope"
                    className={inAppSelectTrigger}
                  >
                    <SelectValue placeholder="Choose audience">
                      {inAppScopeLabel}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      All users (every company)
                    </SelectItem>
                    <SelectItem value="company">
                      Selected company only
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {inAppScope === "company" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="inapp-company">Company</Label>
                    <Select
                      value={inAppCompanyId ?? ""}
                      onValueChange={(v) => {
                        setInAppCompanyId(v as Id<"companies">);
                        setInAppCompanyRecipient("__all__");
                      }}
                    >
                      <SelectTrigger
                        id="inapp-company"
                        className={inAppSelectTrigger}
                      >
                        <SelectValue placeholder="Select a company">
                          {inAppCompanyTriggerLabel}
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
                  {inAppCompanyId ? (
                    <div className="space-y-2">
                      <Label htmlFor="inapp-company-user">User</Label>
                      <Select
                        value={inAppCompanyRecipient}
                        onValueChange={(v) => {
                          if (v != null) {
                            setInAppCompanyRecipient(v);
                          }
                        }}
                        disabled={inAppCompanyUsers === undefined}
                      >
                        <SelectTrigger
                          id="inapp-company-user"
                          className={inAppSelectTrigger}
                        >
                          <SelectValue placeholder="Everyone or one person">
                            {inAppCompanyUserTriggerLabel}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">
                            Everyone in this company
                          </SelectItem>
                          {(inAppCompanyUsers ?? []).map((u) => (
                            <SelectItem key={u._id} value={u._id}>
                              {u.name} ({u.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {inAppCompanyUsers &&
                      inAppCompanyUsers.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No user accounts in this company yet. Notes to
                          “Everyone” will apply once users are added.
                        </p>
                      ) : inAppCompanyUsers && inAppCompanyUsers.length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Send to everyone in this company, or pick one person
                          in the list above.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="inapp-title">Title</Label>
            <Input
              id="inapp-title"
              value={inAppTitle}
              onChange={(e) => setInAppTitle(e.target.value)}
              placeholder="Short headline"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inapp-body">Message (optional)</Label>
            <Textarea
              id="inapp-body"
              value={inAppBody}
              onChange={(e) => setInAppBody(e.target.value)}
              placeholder="Body text shown on the post-it"
              rows={3}
              className="resize-y min-h-[4.5rem]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inapp-importance">Importance</Label>
            <select
              id="inapp-importance"
              value={inAppImportance}
              onChange={(e) =>
                setInAppImportance(
                  e.target.value as "low" | "normal" | "high" | "urgent",
                )
              }
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {preset ? (
            <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm text-foreground">
              <span className="font-medium text-muted-foreground">Link: </span>
              {presetSummary?.trim() || "This page"}
            </p>
          ) : null}

          {!preset ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="inapp-link-mode">Link (optional)</Label>
                <Select
                  value={inAppLinkMode}
                  onValueChange={(v) => {
                    if (v == null) {
                      return;
                    }
                    if (
                      v === "none" ||
                      v === "cert" ||
                      v === "unit" ||
                      v === "content" ||
                      v === "manual"
                    ) {
                      setInAppLinkMode(v);
                      setInAppPickedLevelId("");
                      setInAppPickedUnitId("");
                      setInAppPickedContentKey("");
                      setInAppContentUnitId("__all__");
                      if (v !== "manual") {
                        setInAppLinkHref("");
                      }
                    }
                  }}
                >
                  <SelectTrigger id="inapp-link-mode" className={inAppSelectTrigger}>
                    <SelectValue placeholder="No link">{linkModeLabel}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No link</SelectItem>
                    <SelectItem value="cert">Certification</SelectItem>
                    <SelectItem value="unit">Unit</SelectItem>
                    <SelectItem value="content">Content (in a unit)</SelectItem>
                    <SelectItem value="manual">Manual path</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {inAppLinkMode === "cert" ? (
                <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Category</Label>
                    <Select
                      value={inAppCertCat}
                      onValueChange={(v) => {
                        if (v == null) {
                          return;
                        }
                        setInAppCertCat(v);
                        setInAppPickedLevelId("");
                      }}
                    >
                      <SelectTrigger className={inAppSelectTriggerCompact}>
                        <SelectValue>{certCategoryFilterLabel}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All categories</SelectItem>
                        {(certCategories ?? []).map((c) => (
                          <SelectItem key={c._id} value={c._id}>
                            {c.shortCode} — {c.longDescription.slice(0, 48)}
                            {c.longDescription.length > 48 ? "…" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Certification</Label>
                    <Select
                      value={inAppPickedLevelId}
                      onValueChange={(v) => setInAppPickedLevelId(v ?? "")}
                    >
                      <SelectTrigger className={inAppSelectTriggerCompact}>
                        <SelectValue placeholder="Choose…">
                          {pickedCertificationName ?? "Choose…"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-[min(20rem,50vh)]">
                        {levelsForCertFilter.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            {allLevels === undefined
                              ? "Loading…"
                              : "No certifications match the filter."}
                          </div>
                        ) : (
                          levelsForCertFilter.map((l) => (
                            <SelectItem key={l._id} value={l._id}>
                              {l.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}

              {inAppLinkMode === "unit" ? (
                <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Unit category</Label>
                    <Select
                      value={inAppUnitCat}
                      onValueChange={(v) => {
                        if (v == null) {
                          return;
                        }
                        setInAppUnitCat(v);
                        setInAppPickedUnitId("");
                      }}
                    >
                      <SelectTrigger className={inAppSelectTriggerCompact}>
                        <SelectValue>{unitCategoryFilterLabel}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All categories</SelectItem>
                        {(unitCategories ?? []).map((c) => (
                          <SelectItem key={c._id} value={c._id}>
                            {c.shortCode}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Unit</Label>
                    <Select
                      value={inAppPickedUnitId}
                      onValueChange={(v) => setInAppPickedUnitId(v ?? "")}
                    >
                      <SelectTrigger className={inAppSelectTriggerCompact}>
                        <SelectValue placeholder="Choose…">
                          {pickedUnitTitle ?? "Choose…"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-[min(20rem,50vh)]">
                        {unitsForLinkFilter.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            {allUnits === undefined
                              ? "Loading…"
                              : "No units in this category."}
                          </div>
                        ) : (
                          unitsForLinkFilter.map((u) => (
                            <SelectItem key={u._id} value={u._id}>
                              {u.title}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}

              {inAppLinkMode === "content" ? (
                <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Content category</Label>
                    <Select
                      value={inAppContentCat}
                      onValueChange={(v) => {
                        if (v == null) {
                          return;
                        }
                        setInAppContentCat(v);
                        setInAppPickedContentKey("");
                      }}
                    >
                      <SelectTrigger className={inAppSelectTriggerCompact}>
                        <SelectValue>{contentCategoryFilterLabel}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All categories</SelectItem>
                        {(contentCategories ?? []).map((c) => (
                          <SelectItem key={c._id} value={c._id}>
                            {c.shortCode}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Unit</Label>
                    <Select
                      value={inAppContentUnitId}
                      onValueChange={(v) => {
                        if (v == null) {
                          return;
                        }
                        setInAppContentUnitId(v);
                        setInAppPickedContentKey("");
                      }}
                    >
                      <SelectTrigger className={inAppSelectTriggerCompact}>
                        <SelectValue>{contentUnitFilterLabel}</SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-[min(20rem,50vh)]">
                        <SelectItem value="__all__">All units</SelectItem>
                        {(allUnits ?? [])
                          .slice()
                          .sort((a, b) =>
                            a.title.localeCompare(b.title, undefined, {
                              sensitivity: "base",
                            }),
                          )
                          .map((u) => (
                            <SelectItem key={u._id} value={u._id}>
                              {u.title}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Content in unit</Label>
                    <Select
                      value={inAppPickedContentKey}
                      onValueChange={(v) => setInAppPickedContentKey(v ?? "")}
                    >
                      <SelectTrigger className={inAppSelectTriggerCompact}>
                        <SelectValue placeholder="Choose…">
                          {pickedContentRowLabel ?? "Choose…"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-[min(20rem,50vh)]">
                        {contentLinkRows === undefined ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            Loading…
                          </div>
                        ) : contentLinkRows.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No content in this filter.
                          </div>
                        ) : (
                          contentLinkRows.map((r) => (
                            <SelectItem
                              key={`${r.contentId}\t${r.unitId}`}
                              value={`${r.contentId}\t${r.unitId}`}
                            >
                              {r.label}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}

              {inAppLinkMode === "manual" ? (
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="inapp-link">In-app path</Label>
                    <Input
                      id="inapp-link"
                      value={inAppLinkHref}
                      onChange={(e) => setInAppLinkHref(e.target.value)}
                      placeholder="e.g. /dashboard"
                      autoComplete="off"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        </div>
        <DialogFooter
          className="!mx-0 !mb-0 m-0 shrink-0 flex-col-reverse gap-2 border-t border-border/60 bg-muted/30 px-4 py-3 sm:flex-row sm:justify-end sm:gap-0"
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-brand-sky text-white hover:bg-brand-sky/90"
            onClick={async () => {
              if (!sessionUser?.userId) {
                toast.error("Not signed in.");
                return;
              }
              if (sessionUser.role !== "admin") {
                toast.error("Admins only.");
                return;
              }
              const t = inAppTitle.trim();
              if (!t) {
                toast.error("Enter a title.");
                return;
              }
              if (
                !singleUserTarget &&
                inAppScope === "company" &&
                !inAppCompanyId
              ) {
                toast.error("Select a company.");
                return;
              }
              if (singleUserTarget && !targetUserId) {
                toast.error("User missing.");
                return;
              }
              const companySendsToOneUser =
                !singleUserTarget &&
                inAppScope === "company" &&
                Boolean(inAppCompanyId) &&
                inAppCompanyRecipient !== "__all__";
              if (companySendsToOneUser) {
                const member = inAppCompanyUsers?.find(
                  (u) => u._id === inAppCompanyRecipient,
                );
                if (!member) {
                  toast.error(
                    "Select a user in this company, or wait for the list to load.",
                  );
                  return;
                }
              }
              try {
                let linkRef:
                  | {
                      kind: "certificationLevel";
                      levelId: Id<"certificationLevels">;
                    }
                  | {
                      kind: "unit";
                      unitId: Id<"units">;
                      levelId?: Id<"certificationLevels">;
                    }
                  | {
                      kind: "content";
                      contentId: Id<"contentItems">;
                      unitId: Id<"units">;
                      levelId?: Id<"certificationLevels">;
                      workshopSessionId?: Id<"workshopSessions">;
                    }
                  | undefined;

                if (preset) {
                  linkRef = preset;
                } else if (inAppLinkMode === "cert") {
                  if (!inAppPickedLevelId) {
                    toast.error("Select a certification.");
                    return;
                  }
                  linkRef = {
                    kind: "certificationLevel",
                    levelId: inAppPickedLevelId as Id<"certificationLevels">,
                  };
                } else if (inAppLinkMode === "unit") {
                  if (!inAppPickedUnitId) {
                    toast.error("Select a unit.");
                    return;
                  }
                  const uu = allUnits?.find(
                    (x) => x._id === inAppPickedUnitId,
                  );
                  const ul: Id<"certificationLevels"> | undefined = uu
                    ? (uu.certificationLevelIds[0] ?? uu.levelId ?? undefined)
                    : undefined;
                  linkRef = {
                    kind: "unit",
                    unitId: inAppPickedUnitId as Id<"units">,
                    levelId: ul,
                  };
                } else if (inAppLinkMode === "content") {
                  if (!inAppPickedContentKey) {
                    toast.error("Select a content item.");
                    return;
                  }
                  const cr = contentLinkRows?.find(
                    (row) =>
                      `${row.contentId}\t${row.unitId}` === inAppPickedContentKey,
                  );
                  if (!cr) {
                    toast.error("Content list not loaded or selection invalid.");
                    return;
                  }
                  linkRef = {
                    kind: "content",
                    contentId: cr.contentId,
                    unitId: cr.unitId,
                    levelId: cr.levelId ?? undefined,
                    workshopSessionId: cr.workshopSessionId ?? undefined,
                  };
                } else {
                  linkRef = undefined;
                }

                const r = await adminSendInAppNotification({
                  forUserId: sessionUser.userId as Id<"users">,
                  scope: singleUserTarget
                    ? "user"
                    : companySendsToOneUser
                      ? "user"
                      : inAppScope,
                  companyId:
                    !singleUserTarget &&
                    inAppScope === "company" &&
                    !companySendsToOneUser
                      ? inAppCompanyId!
                      : undefined,
                  targetUserId: singleUserTarget
                    ? targetUserId
                    : companySendsToOneUser
                      ? (inAppCompanyRecipient as Id<"users">)
                      : undefined,
                  title: t,
                  body: inAppBody.trim() || undefined,
                  importance: inAppImportance,
                  linkHref:
                    !preset && inAppLinkMode === "manual"
                      ? inAppLinkHref.trim() || undefined
                      : undefined,
                  linkRef,
                });
                if (
                  (singleUserTarget || companySendsToOneUser) &&
                  "status" in r
                ) {
                  if (r.status === "created") {
                    toast.success("Note sent to that user.");
                  } else if (r.status === "skipped_dismissed") {
                    toast.message(
                      "A previous note for this person was dismissed; this send was skipped. Try again with a new title or wait for the system to allow a new note.",
                    );
                  } else {
                    toast.message(
                      "A matching note is already active for that user.",
                    );
                  }
                } else if (inAppScope === "all" && "status" in r) {
                  if (r.status === "created") {
                    toast.success("Note sent to all users.");
                  } else {
                    toast.message(
                      "A matching note is already active or was dismissed for this send.",
                    );
                  }
                } else if (inAppScope === "company" && "users" in r) {
                  if (r.users === 0) {
                    toast.message("No users in that company.");
                  } else {
                    toast.success(
                      `Created ${r.created} new post-it(s) for ${r.users} user(s)${r.skippedActive + r.skippedDismissed > 0 ? ` (${r.skippedActive + r.skippedDismissed} skipped as duplicate or already dismissed)` : ""}.`,
                    );
                  }
                } else {
                  toast.success("Done.");
                }
                onOpenChange(false);
              } catch (e) {
                toast.error(
                  e instanceof Error ? e.message : "Failed to send note",
                );
              }
            }}
          >
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
