"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Fragment, Suspense } from "react";
import { cn } from "@/lib/utils";

/** Exact paths that match primary sidebar entries — no breadcrumb strip. */
const SIDEBAR_EXACT = new Set([
  "/dashboard",
  "/certifications",
  "/admin/users",
  "/admin/courses",
  "/admin/database",
]);

type CrumbTone = "dashboard" | "hub" | "cert" | "unit" | "content" | "admin";

type Crumb = { href?: string; label: string; tone: CrumbTone };

const chipBase =
  "inline-flex max-w-[min(100%,260px)] shrink-0 items-center truncate rounded-full border px-2.5 py-1 text-xs font-medium text-foreground shadow-sm transition-colors";

const chipTone: Record<CrumbTone, string> = {
  dashboard:
    "border-border/80 bg-muted/45 hover:border-border hover:bg-muted/70",
  hub: "border-brand-sky/40 bg-brand-sky/12 hover:border-brand-sky/55 hover:bg-brand-sky/18 dark:border-brand-sky/45 dark:bg-brand-sky/14",
  cert: "border-brand-gold/40 bg-brand-gold/10 hover:border-brand-gold/55 hover:bg-brand-gold/16 dark:border-brand-gold/45",
  unit: "border-brand-lime/45 bg-brand-lime/12 hover:border-brand-lime/60 hover:bg-brand-lime/18 dark:border-brand-lime/40",
  content:
    "border-brand-charcoal/35 bg-brand-charcoal/[0.07] hover:border-brand-charcoal/50 hover:bg-brand-charcoal/12 dark:border-foreground/30 dark:bg-foreground/[0.06]",
  admin:
    "border-brand-gold/30 bg-muted/55 hover:border-brand-gold/45 hover:bg-muted/75",
};

const chipCurrentRing: Record<CrumbTone, string> = {
  dashboard: "border-border bg-muted/55 ring-1 ring-border/60",
  hub: "border-brand-sky/45 bg-brand-sky/14 ring-1 ring-brand-sky/25 dark:bg-brand-sky/16",
  cert: "border-brand-gold/45 bg-brand-gold/12 ring-1 ring-brand-gold/25 dark:bg-brand-gold/14",
  unit: "border-brand-lime/50 bg-brand-lime/14 ring-1 ring-brand-lime/25 dark:bg-brand-lime/12",
  content:
    "border-brand-charcoal/40 bg-brand-charcoal/[0.09] ring-1 ring-brand-charcoal/20 dark:border-foreground/35",
  admin: "border-brand-gold/40 bg-muted/65 ring-1 ring-brand-gold/20",
};

function ChipLink({
  href,
  tone,
  children,
}: {
  href: string;
  tone: CrumbTone;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(chipBase, chipTone[tone])}
    >
      {children}
    </Link>
  );
}

function ChipCurrent({
  tone,
  children,
}: {
  tone: CrumbTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(chipBase, chipCurrentRing[tone])}
      aria-current="page"
    >
      {children}
    </span>
  );
}

function CrumbTrail({ items }: { items: Crumb[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-border/60 pb-3 mb-1"
    >
      {items.map((item, i) => (
        <Fragment key={`${item.label}-${i}`}>
          {i > 0 ? (
            <ChevronRight
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          ) : null}
          {item.href ? (
            <ChipLink href={item.href} tone={item.tone}>
              {item.label}
            </ChipLink>
          ) : (
            <ChipCurrent tone={item.tone}>{item.label}</ChipCurrent>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

function CertificationLevelBreadcrumbs({
  levelIdRaw,
}: {
  levelIdRaw: string;
}) {
  const levelId = levelIdRaw as Id<"certificationLevels">;
  const level = useQuery(api.certifications.get, { levelId });
  const items: Crumb[] = [
    { href: "/dashboard", label: "Dashboard", tone: "dashboard" },
    { href: "/certifications", label: "Certifications", tone: "hub" },
    { label: level?.name ?? "Course", tone: "cert" },
  ];
  return <CrumbTrail items={items} />;
}

function UnitBreadcrumbsInner({ unitIdRaw }: { unitIdRaw: string }) {
  const unitId = unitIdRaw as Id<"units">;
  const searchParams = useSearchParams();
  const levelRaw = searchParams.get("level");
  const levelId =
    levelRaw && levelRaw.length > 0
      ? (levelRaw as Id<"certificationLevels">)
      : undefined;

  const unit = useQuery(api.units.get, { unitId });
  const level = useQuery(
    api.certifications.get,
    levelId ? { levelId } : "skip",
  );

  const items: Crumb[] = [
    { href: "/dashboard", label: "Dashboard", tone: "dashboard" },
    { href: "/certifications", label: "Certifications", tone: "hub" },
  ];
  if (levelId) {
    items.push({
      href: `/certifications/${levelId}`,
      label: level?.name ?? "Course",
      tone: "cert",
    });
  }
  items.push({ label: unit?.title ?? "Unit", tone: "unit" });
  return <CrumbTrail items={items} />;
}

function UnitBreadcrumbsFallback({ unitIdRaw }: { unitIdRaw: string }) {
  const unitId = unitIdRaw as Id<"units">;
  const unit = useQuery(api.units.get, { unitId });
  const items: Crumb[] = [
    { href: "/dashboard", label: "Dashboard", tone: "dashboard" },
    { href: "/certifications", label: "Certifications", tone: "hub" },
    { label: unit?.title ?? "Unit", tone: "unit" },
  ];
  return <CrumbTrail items={items} />;
}

function AdminOtherBreadcrumbs({ pathname }: { pathname: string }) {
  const section =
    pathname.startsWith("/admin/users")
      ? { href: "/admin/users" as const, label: "Users" }
      : pathname.startsWith("/admin/courses")
        ? { href: "/admin/courses" as const, label: "Training Content" }
        : pathname.startsWith("/admin/database")
          ? { href: "/admin/database" as const, label: "Database" }
          : { href: "/admin/users" as const, label: "Admin" };
  return (
    <CrumbTrail
      items={[
        { href: "/dashboard", label: "Dashboard", tone: "dashboard" },
        { href: section.href, label: section.label, tone: "admin" },
      ]}
    />
  );
}

export function SidebarBreadcrumbs() {
  const pathname = usePathname();

  if (SIDEBAR_EXACT.has(pathname)) {
    return null;
  }

  const certMatch = /^\/certifications\/([^/]+)$/.exec(pathname);
  if (certMatch?.[1]) {
    return <CertificationLevelBreadcrumbs levelIdRaw={certMatch[1]} />;
  }

  const unitMatch = /^\/units\/([^/]+)$/.exec(pathname);
  if (unitMatch?.[1]) {
    return (
      <Suspense
        fallback={<UnitBreadcrumbsFallback unitIdRaw={unitMatch[1]} />}
      >
        <UnitBreadcrumbsInner unitIdRaw={unitMatch[1]} />
      </Suspense>
    );
  }

  if (pathname.startsWith("/admin")) {
    if (SIDEBAR_EXACT.has(pathname)) {
      return null;
    }
    return <AdminOtherBreadcrumbs pathname={pathname} />;
  }

  return null;
}
