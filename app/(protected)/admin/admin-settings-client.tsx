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
import { useAuthModeContext } from "@/components/auth-mode-context";
import { useAdminTestMode } from "@/lib/admin-test-mode-context";
import { api } from "@/convex/_generated/api";
import { Settings2, UserCog, FlaskConical } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useQuery, useConvexAuth } from "convex/react";
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
  const authMode = useAuthModeContext();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const { user, isLoading, actualRole } = useSessionUser();
  const { disableAdmin, setDisableAdmin } = useAdminTestMode();
  const [hideSidebarOnNavigate, setHideSidebarOnNavigateState] = useState(false);
  const navSwitchId = useId();
  const navLabelId = useId();
  const disableAdminSwitchId = useId();
  const disableAdminLabelId = useId();

  /** Server role from Convex; only `admin` may see the UI-testing switch (not content creators, etc.). */
  const me = useQuery(
    api.users.me,
    authMode === "convex" && isAuthenticated && !authLoading ? {} : "skip",
  );
  const showAdminUiTestCard =
    authMode === "convex"
      ? me !== undefined && me !== null && me.role === "admin"
      : !isLoading && actualRole === "admin";

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
                  {actualRole === "admin" && disableAdmin ? (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Your account is Admin; the app is simulating an operator
                      for UI testing.
                    </span>
                  ) : null}
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
                  className="text-base font-medium text-foreground"
                >
                  Hide sidebar when changing page
                </Label>
                <div
                  id={`${navLabelId}-description`}
                  className="text-sm text-muted-foreground leading-relaxed"
                >
                  <p className="m-0 min-w-0">
                    After you open a different page, the left navigation panel
                    closes. Use the{" "}
                    <span className="font-medium text-foreground/90">
                      menu button
                    </span>{" "}
                    <span
                      className="ms-0.5 inline-flex w-5 flex-col items-stretch justify-center gap-[3px] py-0.5 align-middle"
                      aria-hidden
                    >
                      <span className="h-0.5 rounded-full bg-brand-sky" />
                      <span className="h-0.5 rounded-full bg-brand-sky" />
                      <span className="h-0.5 rounded-full bg-brand-sky" />
                    </span>{" "}
                    in the top bar to open it again.
                  </p>
                </div>
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

      {showAdminUiTestCard ? (
        <div className="max-w-2xl">
          <Card
            className="gap-2 border border-amber-200/80 bg-amber-50/90 py-3 shadow-sm ring-1 ring-amber-200/50 dark:border-amber-500/35 dark:bg-amber-950/30 dark:ring-amber-500/20"
          >
            <CardHeader className="gap-0.5 pb-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FlaskConical
                  className="h-5 w-5 text-amber-700 dark:text-amber-400"
                  aria-hidden
                />
                UI testing
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <Label
                    id={disableAdminLabelId}
                    htmlFor={disableAdminSwitchId}
                    className="text-base font-medium text-foreground"
                  >
                    Disable admin
                  </Label>
                  <p
                    id={`${disableAdminLabelId}-description`}
                    className="text-sm text-muted-foreground leading-relaxed m-0"
                  >
                    Hide admin navigation and treat your session like a
                    non-admin in the app (operator). Convex still enforces your
                    real role on mutations.
                  </p>
                </div>
                <Switch
                  id={disableAdminSwitchId}
                  className="shrink-0"
                  checked={disableAdmin}
                  onCheckedChange={setDisableAdmin}
                  aria-labelledby={disableAdminLabelId}
                  aria-describedby={`${disableAdminLabelId}-description`}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
