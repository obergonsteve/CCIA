"use client";

import { api } from "@/convex/_generated/api";
import { OfflineTrainingBanner } from "@/components/offline-training-banner";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "convex/react";
import {
  Award,
  Database,
  GraduationCap,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Sun,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const nav = [
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
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const me = useQuery(api.users.me);
  const certificationLevels = useQuery(api.certifications.listForUser);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  const showAdmin =
    me?.role === "admin" || me?.role === "content_creator";

  const [navOpen, setNavOpen] = useState(false);

  const sidebarNav = (
    <>
      <div
        className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-lime via-brand-gold to-brand-sky"
        aria-hidden
      />
      <div className="flex items-start justify-between gap-2 p-4 pt-5">
        <div className="flex min-w-0 items-center gap-2 font-semibold text-white">
          <Award className="h-6 w-6 shrink-0 text-brand-lime" />
          <span className="leading-tight">
            CCIA Land Lease{" "}
            <span className="text-brand-sky/95">Training</span>
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 text-sidebar-foreground hover:bg-white/10"
          aria-label="Collapse navigation"
          onClick={() => setNavOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Separator />
      <ScrollArea className="min-h-0 flex-1 px-2 py-4">
        <nav className="space-y-1" id="app-sidebar-nav">
          {nav.map(({ href, label, icon: Icon, accent }) => (
            <div key={href} className="space-y-0.5">
              <Link href={href}>
                <span
                  className={cn(
                    "flex items-center gap-2 rounded-md border-l-4 px-3 py-2 text-sm font-medium transition-colors",
                    pathname === href || pathname.startsWith(`${href}/`)
                      ? accent === "lime"
                        ? "border-brand-lime bg-brand-lime/15 text-white"
                        : "border-brand-sky bg-brand-sky/18 text-white"
                      : "border-transparent text-white/72 hover:bg-white/8 hover:text-white",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      pathname === href || pathname.startsWith(`${href}/`)
                        ? accent === "lime"
                          ? "text-brand-lime"
                          : "text-brand-sky"
                        : accent === "lime"
                          ? "text-brand-lime/85"
                          : "text-brand-sky/85",
                    )}
                  />
                  {label}
                </span>
              </Link>
              {href === "/certifications" &&
                certificationLevels &&
                certificationLevels.length > 0 && (
                  <ul className="space-y-0.5 pl-2 border-l border-brand-gold/35 ml-3">
                    {certificationLevels.map((level) => {
                      const levelPath = `/certifications/${level._id}`;
                      const active =
                        pathname === levelPath ||
                        pathname.startsWith(`${levelPath}/`);
                      return (
                        <li key={level._id}>
                          <Link href={levelPath}>
                            <span
                              className={cn(
                                "block rounded-md border-l-2 border-transparent px-2 py-1.5 text-xs font-medium transition-colors line-clamp-2",
                                active
                                  ? "border-brand-gold bg-brand-gold/20 text-white"
                                  : "text-white/70 hover:border-white/15 hover:bg-white/6",
                              )}
                            >
                              {level.name}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
            </div>
          ))}
          {showAdmin && (
            <div className="space-y-0.5 pt-2 mt-2 border-t border-white/10">
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-white/45">
                Admin
              </p>
              {(
                [
                  {
                    href: "/admin/users",
                    label: "Users",
                    icon: Users,
                  },
                  {
                    href: "/admin/courses",
                    label: "Training Content",
                    icon: Layers,
                  },
                  {
                    href: "/admin/database",
                    label: "Training data",
                    icon: Database,
                  },
                ] as const
              ).map(({ href, label, icon: Icon }) => {
                const active =
                  pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link key={href} href={href}>
                    <span
                      className={cn(
                        "flex items-center gap-2 rounded-md border-l-4 px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "border-brand-gold bg-brand-gold/18 text-white"
                          : "border-transparent text-white/72 hover:bg-white/8 hover:text-white",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active ? "text-brand-gold" : "text-brand-gold/85",
                        )}
                      />
                      {label}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </nav>
      </ScrollArea>
      <div className="shrink-0 border-t border-white/10 p-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-white/10"
          onClick={() => void logout()}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-svh flex-row overflow-hidden bg-background">
      <aside
        className={cn(
          "relative flex shrink-0 flex-col overflow-hidden border-r border-white/10 bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-in-out",
          navOpen ? "w-60" : "w-0 border-r-0",
        )}
        aria-hidden={!navOpen}
      >
        <div className="flex h-full min-h-0 w-60 min-w-[15rem] flex-col">
          {sidebarNav}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="relative z-40 shrink-0 border-b border-white/10 px-3 py-3 pt-4 sm:px-4 flex items-center gap-2 bg-sidebar text-sidebar-foreground">
          <div
            className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-lime via-brand-gold to-brand-sky"
            aria-hidden
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-sidebar-foreground hover:bg-white/10"
            aria-label={navOpen ? "Toggle navigation" : "Open navigation"}
            aria-expanded={navOpen}
            aria-controls="app-sidebar-nav"
            onClick={() => setNavOpen((o) => !o)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-semibold text-white truncate min-w-0">
            CCIA Training
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="ml-auto shrink-0 text-sidebar-foreground hover:bg-white/10"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
            aria-label="Toggle theme"
          >
            {resolvedTheme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </header>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <main
            className={cn(
              "mx-auto min-h-0 w-full flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 md:p-8 space-y-4",
              pathname.startsWith("/admin/courses")
                ? "max-w-[95rem]"
                : pathname.startsWith("/admin")
                  ? "max-w-7xl"
                  : "max-w-5xl",
            )}
          >
            <PwaInstallPrompt />
            <OfflineTrainingBanner />
            {children}
          </main>
          <footer className="shrink-0 border-t border-border/60 text-center text-xs text-muted-foreground py-3 px-4">
            CCIA Land Lease Division Training Portal — Residential land lease
            communities (Australia).
          </footer>
        </div>
      </div>
    </div>
  );
}
