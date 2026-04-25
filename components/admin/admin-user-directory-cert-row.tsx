import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { AdminStudentDirectoryRow } from "@/components/admin/admin-student-directory-row";
import { cn } from "@/lib/utils";
import { ChevronDown, X } from "lucide-react";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";

export function formatLastLoginForDirectory(ms: number | undefined) {
  if (ms == null) {
    return "—";
  }
  return new Date(ms).toLocaleString();
}

function StudentCertChip({
  href,
  label,
  onRemove,
  removeDisabled,
  variant,
}: {
  href: string;
  label: string;
  onRemove?: () => void;
  removeDisabled?: boolean;
  variant: "roadmap" | "inProgress" | "completed";
}) {
  const ring =
    variant === "inProgress"
      ? "border-brand-sky/50 bg-brand-sky/[0.10] dark:border-brand-sky/40 dark:bg-brand-sky/[0.08]"
      : variant === "completed"
        ? "border-emerald-600/40 bg-emerald-500/[0.09] dark:border-emerald-500/35 dark:bg-emerald-500/[0.08]"
        : "border-brand-lime/50 bg-brand-lime/[0.10] dark:border-brand-lime/40 dark:bg-brand-lime/[0.08]";
  return (
    <span
      className={cn(
        "inline-flex max-w-full min-w-0 items-center overflow-hidden rounded-full border pl-2.5 pr-0.5 text-xs font-medium",
        ring,
      )}
    >
      <Link
        href={href}
        className="min-w-0 max-w-[14rem] truncate py-1.5 pr-0.5 text-foreground hover:underline"
        title="Open certification — their path and progress"
      >
        {label}
      </Link>
      {onRemove != null ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/12 hover:text-destructive"
          title="Remove from their roadmap (leave assigned certs unchanged)"
          disabled={removeDisabled}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </Button>
      ) : null}
    </span>
  );
}

export type AdminUserDirectoryCertRowProps = {
  userId: Id<"users">;
  name: string;
  email: string;
  lastLogin?: number;
  levelById: Map<string, { name: string; code?: string }>;
  inProgressLevelIds: Id<"certificationLevels">[];
  completedLevelIds: Id<"certificationLevels">[];
  plannedLevelIds: Id<"certificationLevels">[];
  certsExpanded: boolean;
  onToggleCertifications: () => void;
  removing: string | null;
  canWrite: boolean;
  onRemovePlanned?: (levelId: Id<"certificationLevels">) => void;
  /** Trailing action icons (e.g. entitlements edit, in-app, delete, profile edit). */
  rowActions: ReactNode;
  /** `?from=` for certification-level breadcrumb (how the admin opened the cert in view-as). */
  certBreadcrumbFrom: "admin-students" | "admin-users";
  /** `AdminStudentDirectoryRow` layout classNames (default matches Students page). */
  rowClassName?: string;
};

/**
 * One directory row: identity + Certifications (in progress, roadmap, completed)
 * with `viewAs` links. Access control for non–company students is via the
 * row **Edit** action + dialog, not a separate “can start” list here.
 */
export function AdminUserDirectoryCertRow({
  userId,
  name,
  email,
  lastLogin,
  levelById,
  inProgressLevelIds,
  completedLevelIds,
  plannedLevelIds,
  certsExpanded,
  onToggleCertifications,
  removing,
  canWrite,
  onRemovePlanned,
  rowActions,
  certBreadcrumbFrom,
  rowClassName = "flex flex-col gap-1.5 px-3 py-1.5 sm:flex-row sm:items-stretch sm:gap-2.5",
}: AdminUserDirectoryCertRowProps) {
  const inProgressIdSet = useMemo(
    () => new Set(inProgressLevelIds.map((id) => String(id))),
    [inProgressLevelIds],
  );
  const completedIdSet = useMemo(
    () => new Set(completedLevelIds.map((id) => String(id))),
    [completedLevelIds],
  );
  /**
   * Planned list can still contain ids after someone starts; progress is
   * computed separately. For display, only show “roadmap” rows that are not
   * already in progress or completed, so a program is not shown twice.
   */
  const plannedNotStartedLevelIds = useMemo(
    () =>
      plannedLevelIds.filter(
        (id) =>
          !inProgressIdSet.has(String(id)) && !completedIdSet.has(String(id)),
      ),
    [plannedLevelIds, inProgressIdSet, completedIdSet],
  );

  /** Distinct level ids across in progress, roadmap (planned), and completed. */
  const certSummaryCount = useMemo(() => {
    const ids = new Set<string>();
    for (const id of inProgressLevelIds) {
      ids.add(String(id));
    }
    for (const id of plannedLevelIds) {
      ids.add(String(id));
    }
    for (const id of completedLevelIds) {
      ids.add(String(id));
    }
    return ids.size;
  }, [inProgressLevelIds, plannedLevelIds, completedLevelIds]);

  const viewAsHref = (levelId: Id<"certificationLevels">) => {
    const q = new URLSearchParams();
    q.set("viewAs", String(userId));
    q.set("from", certBreadcrumbFrom);
    return `/certifications/${levelId}?${q.toString()}`;
  };

  return (
    <AdminStudentDirectoryRow className={rowClassName}>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <div className="font-medium leading-snug text-foreground">{name}</div>
          <div className="text-xs leading-snug text-muted-foreground">
            {email} · last sign-in: {formatLastLoginForDirectory(lastLogin)}
          </div>
        </div>
        <div className="border-t border-border/60 pt-1">
          <button
            type="button"
            className="flex w-full min-w-0 min-h-0 items-center justify-between gap-1.5 rounded-md py-0 text-left leading-tight transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background -mx-1 px-1"
            aria-expanded={certsExpanded}
            aria-label={`Certifications, ${certSummaryCount} ${
              certSummaryCount === 1 ? "program" : "programs"
            } (in progress, on roadmap, or completed)`}
            onClick={onToggleCertifications}
          >
            <h4 className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-sm font-semibold leading-tight tracking-tight text-brand-sky dark:text-brand-sky/90">
              <span>Certifications</span>
              <span
                className="tabular-nums text-[11px] font-medium text-muted-foreground sm:text-xs"
                title="In progress, on their roadmap, or completed (each program counted once)"
              >
                ({certSummaryCount})
              </span>
            </h4>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                !certsExpanded && "-rotate-90",
              )}
              aria-hidden
            />
          </button>
          {certsExpanded ? (
            <div className="space-y-1.5 pt-1.5">
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-brand-sky sm:text-xs dark:text-brand-sky/90">
                  In progress
                </p>
                {inProgressLevelIds.length === 0 ? (
                  <p className="text-xs text-muted-foreground">None started yet</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {inProgressLevelIds.map((levelId) => {
                      const n =
                        levelById.get(String(levelId))?.name ?? "Certification";
                      return (
                        <StudentCertChip
                          key={`i:${userId}:${levelId}`}
                          variant="inProgress"
                          href={viewAsHref(levelId)}
                          label={n}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-brand-sky sm:text-xs dark:text-brand-sky/90">
                  Roadmap
                </p>
                {plannedNotStartedLevelIds.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {plannedLevelIds.length === 0
                      ? "Nothing on their roadmap yet"
                      : "Nothing else on their roadmap — the rest is in progress or completed above."}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {plannedNotStartedLevelIds.map((levelId) => {
                      const n =
                        levelById.get(String(levelId))?.name ?? "Certification";
                      const rkey = `p:${userId}:${levelId}`;
                      return (
                        <StudentCertChip
                          key={rkey}
                          variant="roadmap"
                          href={viewAsHref(levelId)}
                          label={n}
                          removeDisabled={removing != null}
                          onRemove={
                            canWrite && onRemovePlanned
                              ? () => onRemovePlanned(levelId)
                              : undefined
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-brand-sky sm:text-xs dark:text-brand-sky/90">
                  Completed
                </p>
                {completedLevelIds.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    None completed yet
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {completedLevelIds.map((levelId) => {
                      const n =
                        levelById.get(String(levelId))?.name ?? "Certification";
                      return (
                        <StudentCertChip
                          key={`c:${userId}:${levelId}`}
                          variant="completed"
                          href={viewAsHref(levelId)}
                          label={n}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-row items-center justify-end gap-0.5 sm:flex-col sm:items-end sm:justify-start sm:gap-0.5 sm:pl-0 sm:pt-px">
        {rowActions}
      </div>
    </AdminStudentDirectoryRow>
  );
}
