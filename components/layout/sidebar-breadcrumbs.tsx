"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Fragment, Suspense } from "react";

/** Exact paths that match primary sidebar entries — no breadcrumb strip. */
const SIDEBAR_EXACT = new Set([
  "/dashboard",
  "/certifications",
  "/admin/users",
  "/admin/courses",
  "/admin/database",
]);

type Crumb = { href?: string; label: string };

function ChipLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex max-w-[min(100%,220px)] shrink-0 items-center truncate rounded-full border border-border bg-muted/50 px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-brand-sky/40 hover:bg-muted"
    >
      {children}
    </Link>
  );
}

function ChipCurrent({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex max-w-[min(100%,280px)] shrink-0 items-center truncate rounded-full border border-brand-gold/30 bg-brand-gold/10 px-3 py-1.5 text-sm font-medium text-foreground"
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
            <ChipLink href={item.href}>{item.label}</ChipLink>
          ) : (
            <ChipCurrent>{item.label}</ChipCurrent>
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
    { href: "/dashboard", label: "Dashboard" },
    { href: "/certifications", label: "Certifications" },
    { label: level?.name ?? "Course" },
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
    { href: "/dashboard", label: "Dashboard" },
    { href: "/certifications", label: "Certifications" },
  ];
  if (levelId) {
    items.push({
      href: `/certifications/${levelId}`,
      label: level?.name ?? "Course",
    });
  }
  items.push({ label: unit?.title ?? "Unit" });
  return <CrumbTrail items={items} />;
}

function UnitBreadcrumbsFallback({ unitIdRaw }: { unitIdRaw: string }) {
  const unitId = unitIdRaw as Id<"units">;
  const unit = useQuery(api.units.get, { unitId });
  const items: Crumb[] = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/certifications", label: "Certifications" },
    { label: unit?.title ?? "Unit" },
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
          ? { href: "/admin/database" as const, label: "Training data" }
          : { href: "/admin/users" as const, label: "Admin" };
  return (
    <CrumbTrail
      items={[
        { href: "/dashboard", label: "Dashboard" },
        { href: section.href, label: section.label },
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
