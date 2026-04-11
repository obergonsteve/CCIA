import type { LucideIcon } from "lucide-react";
import {
  Database,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Users,
} from "lucide-react";

/** Top-level items in the main app sidebar (non-admin). */
export const primarySidebarNav = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    accent: "lime" as const,
  },
  {
    href: "/certifications",
    label: "Certifications",
    icon: GraduationCap,
    accent: "sky" as const,
  },
] as const;

/** Admin section links (same order as sidebar). */
export const adminSidebarNav = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/courses", label: "Training Content", icon: Layers },
  { href: "/admin/database", label: "Database", icon: Database },
] as const;

export function primaryNavIconClass(
  accent: "lime" | "sky",
  active: boolean,
): string {
  if (active) {
    return accent === "lime" ? "text-brand-lime" : "text-brand-sky";
  }
  return accent === "lime" ? "text-brand-lime/85" : "text-brand-sky/85";
}

/** Icon + title for the current route when it matches a direct sidebar destination. */
export function sidebarMainPageHeading(
  pathname: string,
): { label: string; icon: LucideIcon; iconClassName: string } | null {
  if (pathname === "/dashboard") {
    return {
      label: "Dashboard",
      icon: LayoutDashboard,
      iconClassName: "text-brand-lime",
    };
  }
  if (pathname === "/certifications") {
    return {
      label: "Certifications",
      icon: GraduationCap,
      iconClassName: "text-brand-sky",
    };
  }
  if (pathname.startsWith("/admin/users")) {
    return { label: "Users", icon: Users, iconClassName: "text-brand-gold" };
  }
  if (pathname.startsWith("/admin/courses")) {
    return {
      label: "Training Content",
      icon: Layers,
      iconClassName: "text-brand-gold",
    };
  }
  if (pathname.startsWith("/admin/database")) {
    return {
      label: "Database",
      icon: Database,
      iconClassName: "text-brand-gold",
    };
  }
  return null;
}
