import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
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
  {
    href: "/workshops",
    label: "Workshops",
    icon: CalendarDays,
    accent: "purple" as const,
  },
] as const;

/** Admin section links (same order as sidebar). */
export const adminSidebarNav = [
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/courses", label: "Training Content", icon: Layers },
  { href: "/admin/workshops", label: "Timetable", icon: CalendarDays },
  { href: "/admin/database", label: "Database", icon: Database },
] as const;

export function primaryNavIconClass(
  accent: "lime" | "sky" | "gold" | "purple",
  active: boolean,
): string {
  if (active) {
    if (accent === "lime") {
      return "text-brand-lime";
    }
    if (accent === "sky") {
      return "text-brand-sky";
    }
    if (accent === "purple") {
      return "text-purple-100";
    }
    return "text-brand-gold";
  }
  if (accent === "lime") {
    return "text-brand-lime/85";
  }
  if (accent === "sky") {
    return "text-brand-sky/85";
  }
  if (accent === "purple") {
    return "text-purple-400/90";
  }
  return "text-brand-gold/85";
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
  if (pathname === "/workshops" || pathname.startsWith("/workshops/")) {
    return {
      label: "Workshops",
      icon: CalendarDays,
      iconClassName: "text-purple-600 dark:text-purple-400",
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
  if (pathname.startsWith("/admin/workshops")) {
    return {
      label: "Timetable",
      icon: CalendarDays,
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
