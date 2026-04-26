"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AdminAuthModePanel } from "@/components/admin-auth-mode-panel";
import { NotificationSettingsPanel } from "@/components/notification-settings-panel";
import {
  getHideSidebarOnNavigate,
  setHideSidebarOnNavigate,
} from "@/lib/sidebar-on-nav-pref";
import { Settings2, UserCog } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useSessionUser } from "@/lib/use-session-user";

function formatRole(
  role: "operator" | "supervisor" | "admin" | "content_creator" | undefined,
) {
  if (role === "content_creator") {
    return "Content creator";
  }
  if (role === "admin") {
    return "Admin";
  }
  if (role === "supervisor") {
    return "Supervisor";
  }
  if (role === "operator") {
    return "Operator";
  }
  return "—";
}

export default function AdminSettingsClient() {
  const { user, isLoading } = useSessionUser();
  const [hideSidebarOnNavigate, setHideSidebarOnNavigateState] = useState(false);
  const navSwitchId = useId();
  const navLabelId = useId();

  useEffect(() => {
    setHideSidebarOnNavigateState(getHideSidebarOnNavigate());
  }, []);

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <Card className="gap-2 py-3">
          <CardHeader className="gap-0.5 pb-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserCog
                className="h-5 w-5 text-brand-gold"
                aria-hidden
              />
              Your account
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2 text-sm">
            {isLoading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : user ? (
              <dl className="grid grid-cols-[max-content_1fr] items-start gap-x-3 gap-y-1.5">
                <dt className="pt-0.5 font-medium text-muted-foreground">Name</dt>
                <dd className="min-w-0 break-words text-foreground">
                  {user.name}
                </dd>
                <dt className="pt-0.5 font-medium text-muted-foreground">Email</dt>
                <dd className="min-w-0 break-words text-foreground">
                  {user.email}
                </dd>
                <dt className="pt-0.5 font-medium text-muted-foreground">Role</dt>
                <dd className="min-w-0 break-words text-foreground">
                  {formatRole(user.role)}
                </dd>
              </dl>
            ) : (
              <p className="text-muted-foreground">No session found.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="max-w-2xl">
        <Card
          className="gap-2 border border-sky-200/60 bg-sky-100 py-3 shadow-sm ring-1 ring-sky-200/30 dark:border-sky-500/35 dark:bg-sky-900 dark:ring-sky-500/15"
        >
          <CardHeader className="gap-0.5 pb-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings2
                className="h-5 w-5 text-brand-sky"
                aria-hidden
              />
              General
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <Label
                  id={navLabelId}
                  htmlFor={navSwitchId}
                  className="text-sm font-medium text-foreground"
                >
                  Hide sidebar when changing page
                </Label>
                <p
                  id={`${navLabelId}-description`}
                  className="text-xs text-muted-foreground leading-snug"
                >
                  After you open a different page, the left navigation panel
                  closes. Use the menu button to open it again.
                </p>
              </div>
              <Switch
                id={navSwitchId}
                className="shrink-0"
                checked={hideSidebarOnNavigate}
                onCheckedChange={(v) => {
                  setHideSidebarOnNavigate(v);
                  setHideSidebarOnNavigateState(v);
                }}
                aria-labelledby={navLabelId}
                aria-describedby={`${navLabelId}-description`}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <NotificationSettingsPanel showIntro={false} />

      <div className="max-w-2xl">
        <AdminAuthModePanel />
      </div>
    </div>
  );
}
