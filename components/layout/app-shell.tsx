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
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings2,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
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

  return (
    <div className="min-h-svh flex flex-col md:flex-row">
      <aside className="hidden md:flex w-60 flex-col border-r bg-sidebar text-sidebar-foreground shrink-0 relative pt-1">
        <div
          className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-lime via-brand-gold to-brand-sky"
          aria-hidden
        />
        <div className="p-4 font-semibold flex items-center gap-2 text-white">
          <Award className="h-6 w-6 shrink-0 text-brand-lime" />
          <span className="leading-tight">
            CCIA Land Lease{" "}
            <span className="text-brand-sky/95">Training</span>
          </span>
        </div>
        <Separator />
        <ScrollArea className="flex-1 px-2 py-4">
          <nav className="space-y-1">
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
              <Link href="/admin">
                <span
                  className={cn(
                    "flex items-center gap-2 rounded-md border-l-4 px-3 py-2 text-sm font-medium transition-colors",
                    pathname.startsWith("/admin")
                      ? "border-brand-gold bg-brand-gold/18 text-white"
                      : "border-transparent text-white/72 hover:bg-white/8 hover:text-white",
                  )}
                >
                  <Settings2
                    className={cn(
                      "h-4 w-4 shrink-0",
                      pathname.startsWith("/admin")
                        ? "text-brand-gold"
                        : "text-brand-gold/85",
                    )}
                  />
                  Admin
                </span>
              </Link>
            )}
          </nav>
        </ScrollArea>
        <div className="p-2 border-t space-y-1">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-white/10"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
          >
            {resolvedTheme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
            Theme
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-white/10"
            onClick={() => void logout()}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <header className="md:hidden relative border-b border-white/10 px-4 py-3 pt-4 flex items-center justify-between bg-sidebar text-sidebar-foreground">
          <div
            className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-lime via-brand-gold to-brand-sky"
            aria-hidden
          />
          <span className="font-semibold text-white">CCIA Training</span>
          <Button
            size="icon"
            variant="ghost"
            className="text-sidebar-foreground hover:bg-white/10"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
          >
            {resolvedTheme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </header>
        <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full space-y-4 md:border-l md:border-border/60 md:shadow-[inset_1px_0_0_0_oklch(1_0_0/6%)] dark:md:shadow-[inset_1px_0_0_0_oklch(1_0_0/8%)]">
          <PwaInstallPrompt />
          <OfflineTrainingBanner />
          {children}
        </main>
        <footer className="text-center text-xs text-muted-foreground py-4 px-4 border-t md:border-t-0">
          CCIA Land Lease Division Training Portal — Residential land lease
          communities (Australia).
        </footer>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 border-t border-white/10 bg-sidebar text-sidebar-foreground flex justify-around py-2 z-50 safe-area-pb">
        {nav.map(({ href, label, icon: Icon, accent }) => {
          const active =
            pathname === href || pathname.startsWith(`${href}/`);
          return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center text-[10px] gap-0.5 px-2 py-1",
              active
                ? accent === "lime"
                  ? "text-brand-lime"
                  : "text-brand-sky"
                : "text-white/55",
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
          );
        })}
        {showAdmin && (
          <Link
            href="/admin"
            className={cn(
              "flex flex-col items-center text-[10px] gap-0.5 px-2 py-1",
              pathname.startsWith("/admin")
                ? "text-brand-gold"
                : "text-white/55",
            )}
          >
            <Settings2 className="h-5 w-5" />
            Admin
          </Link>
        )}
      </nav>
    </div>
  );
}
