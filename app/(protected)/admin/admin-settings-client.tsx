"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdminAuthModePanel } from "@/components/admin-auth-mode-panel";
import { NotificationSettingsPanel } from "@/components/notification-settings-panel";
import { UserCog } from "lucide-react";
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
          <CardContent className="space-y-2 pt-2 text-sm">
            {isLoading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : user ? (
              <dl className="space-y-1.5">
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
                  <dt className="shrink-0 font-medium text-muted-foreground">
                    Name
                  </dt>
                  <dd className="min-w-0 break-words text-foreground">
                    {user.name}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
                  <dt className="shrink-0 font-medium text-muted-foreground">
                    Email
                  </dt>
                  <dd className="min-w-0 break-words text-foreground">
                    {user.email}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
                  <dt className="shrink-0 font-medium text-muted-foreground">
                    Role
                  </dt>
                  <dd className="text-foreground">
                    {formatRole(user.role)}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-muted-foreground">No session found.</p>
            )}
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
