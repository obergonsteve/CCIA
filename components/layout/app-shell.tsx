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
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/certifications", label: "Certifications", icon: GraduationCap },
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
      <aside className="hidden md:flex w-60 flex-col border-r bg-sidebar text-sidebar-foreground shrink-0">
        <div className="p-4 font-semibold text-sidebar-primary flex items-center gap-2">
          <Award className="h-6 w-6 text-sidebar-primary" />
          <span className="leading-tight">CCIA Land Lease Training</span>
        </div>
        <Separator />
        <ScrollArea className="flex-1 px-2 py-4">
          <nav className="space-y-1">
            {nav.map(({ href, label, icon: Icon }) => (
              <div key={href} className="space-y-0.5">
                <Link href={href}>
                  <span
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      pathname === href || pathname.startsWith(`${href}/`)
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "hover:bg-sidebar-accent/60",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </span>
                </Link>
                {href === "/certifications" &&
                  certificationLevels &&
                  certificationLevels.length > 0 && (
                    <ul className="space-y-0.5 pl-2 border-l border-sidebar-border ml-3">
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
                                  "block rounded-md px-2 py-1.5 text-xs font-medium transition-colors line-clamp-2",
                                  active
                                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60",
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
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    pathname.startsWith("/admin")
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "hover:bg-sidebar-accent/60",
                  )}
                >
                  <Settings2 className="h-4 w-4" />
                  Admin
                </span>
              </Link>
            )}
          </nav>
        </ScrollArea>
        <div className="p-2 border-t space-y-1">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
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
            className="w-full justify-start gap-2"
            onClick={() => void logout()}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <header className="md:hidden border-b px-4 py-3 flex items-center justify-between bg-card">
          <span className="font-semibold text-primary">CCIA Training</span>
          <Button
            size="icon"
            variant="ghost"
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
        <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full space-y-4">
          <PwaInstallPrompt />
          <OfflineTrainingBanner />
          {children}
        </main>
        <footer className="text-center text-xs text-muted-foreground py-4 px-4 border-t md:border-t-0">
          CCIA Land Lease Division Training Portal — Residential land lease
          communities (Australia).
        </footer>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 border-t bg-card flex justify-around py-2 z-50 safe-area-pb">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center text-[10px] gap-0.5 px-2 py-1",
              pathname === href || pathname.startsWith(`${href}/`)
                ? "text-primary"
                : "text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
        {showAdmin && (
          <Link
            href="/admin"
            className={cn(
              "flex flex-col items-center text-[10px] gap-0.5 px-2 py-1",
              pathname.startsWith("/admin")
                ? "text-primary"
                : "text-muted-foreground",
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
