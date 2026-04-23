"use client";

import { api } from "@/convex/_generated/api";
import { OfflineTrainingBanner } from "@/components/offline-training-banner";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "convex/react";
import { LogOut, Menu, Moon, Sun, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import type { Id } from "@/convex/_generated/dataModel";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { SidebarBreadcrumbs } from "@/components/layout/sidebar-breadcrumbs";
import { SidebarMainPageHeading } from "@/components/layout/sidebar-main-page-heading";
import {
  adminSidebarNav,
  primaryNavIconClass,
  primarySidebarNav,
} from "@/lib/sidebar-nav";
import { appPageGradientClass } from "@/lib/app-page-surface";
import { SITE_APP_NAME, SITE_FOOTER_APP } from "@/lib/site-brand";
import { useSessionUser } from "@/lib/use-session-user";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setTheme, resolvedTheme } = useTheme();
  const { user: sessionUser } = useSessionUser();
  const certificationLevels = useQuery(api.certifications.listForUser);

  const isWorkshopSimShell = pathname.startsWith("/workshop-sim");
  const workshopSimJoinSessionId = useMemo(() => {
    const m = pathname.match(/^\/workshop-sim\/join\/([^/?#]+)/);
    const raw = m?.[1]?.trim();
    return raw != null && raw.length > 0
      ? (raw as Id<"workshopSessions">)
      : undefined;
  }, [pathname]);
  const simJoinSession = useQuery(
    api.workshops.getSessionForUser,
    workshopSimJoinSessionId != null
      ? { sessionId: workshopSimJoinSessionId }
      : "skip",
  );
  const backToUnitHref =
    simJoinSession?.session != null
      ? (() => {
          const unitId = simJoinSession.session.workshopUnitId;
          const level = searchParams.get("level")?.trim();
          return level != null && level.length > 0
            ? `/units/${unitId}?level=${encodeURIComponent(level)}`
            : `/units/${unitId}`;
        })()
      : null;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  const showAdmin =
    sessionUser?.role === "admin" ||
    sessionUser?.role === "content_creator";

  /** Open by default so learners see nav immediately after sign-in (menu still toggles). */
  const [navOpen, setNavOpen] = useState(true);

  const sidebarNav = (
    <>
      <div
        className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-lime via-brand-gold to-brand-sky"
        aria-hidden
      />
      <div className="flex min-h-[72px] shrink-0 items-center justify-between gap-2 border-b border-sidebar-border bg-sidebar px-3 py-1 text-sidebar-foreground sm:px-4">
        <div className="flex min-w-0 flex-1 items-center justify-start">
          <Image
            src="/LLLIA_logo.png"
            alt={SITE_APP_NAME}
            width={138}
            height={137}
            unoptimized
            className="size-[2.1rem] shrink-0 object-contain object-left"
            priority
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 text-sidebar-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground"
          aria-label="Collapse navigation"
          onClick={() => setNavOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Separator />
      <ScrollArea className="min-h-0 flex-1 px-2 py-4">
        <nav className="space-y-1" id="app-sidebar-nav">
          {primarySidebarNav.map(({ href, label, icon: Icon, accent }) => {
            const active =
              pathname === href || pathname.startsWith(`${href}/`);
            return (
            <div key={href} className="space-y-0.5">
              <Link href={href}>
                <span
                  className={cn(
                    "flex items-center gap-2 rounded-md border-l-4 px-3 py-2 text-[15px] font-medium transition-colors",
                    active
                      ? accent === "lime"
                        ? "border-brand-lime bg-brand-lime/15 text-white"
                        : accent === "sky"
                          ? "border-brand-sky bg-brand-sky/18 text-white"
                          : accent === "purple"
                            ? "border-purple-400 bg-purple-500/25 text-white"
                            : "border-brand-gold bg-brand-gold/20 text-white"
                      : "border-transparent text-white/72 hover:bg-white/8 hover:text-white",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-[18px] w-[18px] shrink-0",
                      primaryNavIconClass(accent, active),
                    )}
                  />
                  {label}
                </span>
              </Link>
              {href === "/certifications" &&
                certificationLevels &&
                certificationLevels.length > 0 && (
                  <ul className="space-y-0.5 border-l-2 border-brand-gold/35 pl-2 ml-3">
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
                                "block rounded-md border-l-2 border-transparent px-2 py-1.5 text-sm font-medium leading-snug transition-colors line-clamp-2",
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
            );
          })}
          {showAdmin && (
            <div className="space-y-0.5 pt-2 mt-2 border-t border-white/10">
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-white/45">
                Admin
              </p>
              {adminSidebarNav.map(({ href, label, icon: Icon }) => {
                const active =
                  pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link key={href} href={href}>
                    <span
                      className={cn(
                        "flex items-center gap-2 rounded-md border-l-4 px-3 py-2 text-[15px] font-medium transition-colors",
                        active
                          ? "border-brand-gold bg-brand-gold/18 text-white"
                          : "border-transparent text-white/72 hover:bg-white/8 hover:text-white",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0",
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
      <div className="shrink-0 space-y-1 border-t border-white/10 p-2">
        {sessionUser ? (
          <p
            className="truncate px-2 text-xs font-medium text-brand-sky"
            title={sessionUser.name}
          >
            {sessionUser.name}
          </p>
        ) : null}
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-2 text-[15px] font-normal",
            "text-sidebar-foreground/55 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/92",
            "focus-visible:border-sidebar-border focus-visible:ring-sidebar-ring/40 focus-visible:ring-offset-0",
          )}
          onClick={() => void logout()}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0 text-inherit" />
          Sign out
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-svh flex-row overflow-hidden bg-background">
      {!isWorkshopSimShell ? (
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
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="relative z-40 flex min-h-[72px] shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-1 text-card-foreground sm:px-4 dark:border-white/10 dark:bg-white/[0.07] dark:text-foreground">
          <div
            className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-lime via-brand-gold to-brand-sky"
            aria-hidden
          />
          {isWorkshopSimShell ? (
            <>
              {backToUnitHref != null ? (
                <Link
                  href={backToUnitHref}
                  className={cn(
                    buttonVariants({ variant: "default", size: "sm" }),
                    "h-9 shrink-0 px-4 font-medium",
                  )}
                >
                  Back to unit
                </Link>
              ) : (
                <Link
                  href="/workshops"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "h-9 shrink-0 px-4 font-medium",
                  )}
                >
                  Back to webinars
                </Link>
              )}
              <div className="min-w-0 flex-1" aria-hidden />
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0 text-card-foreground hover:bg-muted/80 dark:text-foreground dark:hover:bg-white/10"
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
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-card-foreground hover:bg-muted/80 dark:text-foreground dark:hover:bg-white/10"
                aria-label={navOpen ? "Toggle navigation" : "Open navigation"}
                aria-expanded={navOpen}
                aria-controls="app-sidebar-nav"
                onClick={() => setNavOpen((o) => !o)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <Image
                  src="/LLLIA_trans.png"
                  alt={SITE_APP_NAME}
                  width={632}
                  height={186}
                  className="h-[60px] w-auto max-h-[60px] max-w-full shrink-0 object-contain object-left"
                  priority
                />
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto shrink-0 text-card-foreground hover:bg-muted/80 dark:text-foreground dark:hover:bg-white/10"
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
            </>
          )}
        </header>

        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col",
            appPageGradientClass,
          )}
        >
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
            {!isWorkshopSimShell ? (
              <>
                <SidebarBreadcrumbs />
                <SidebarMainPageHeading />
              </>
            ) : null}
            {children}
          </main>
          <footer className="shrink-0 border-t border-border/60 text-center text-xs text-muted-foreground py-3 px-4">
            {SITE_FOOTER_APP}
          </footer>
        </div>
      </div>
    </div>
  );
}
