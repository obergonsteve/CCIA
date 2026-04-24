"use client";

import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "convex/react";
import { NotificationSettingsPanel } from "@/components/notification-settings-panel";
import { StickyNote, UserCog } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { NotificationImportanceLegend } from "@/lib/notification-importance";
import { useSessionUser } from "@/lib/use-session-user";
import type { Id } from "@/convex/_generated/dataModel";

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
  const [testNotifOpen, setTestNotifOpen] = useState(false);
  const [testTitle, setTestTitle] = useState("Test notification");
  const [testBody, setTestBody] = useState("");
  const [testImportance, setTestImportance] = useState<
    "low" | "normal" | "high" | "urgent"
  >("normal");
  const [testLinkHref, setTestLinkHref] = useState("");
  const [testLinkLabel, setTestLinkLabel] = useState("");
  const createTestNotif = useMutation(
    api.userNotifications.createTestForCurrentUser,
  );

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserCog
                className="h-5 w-5 text-brand-gold"
                aria-hidden
              />
              Your account
            </CardTitle>
            <CardDescription>
              Shown from your current browser session.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {isLoading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : user ? (
              <dl className="space-y-2">
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

      <Card className="max-w-2xl border-dashed border-amber-500/40 bg-amber-500/[0.04] dark:border-amber-500/30">
        <CardHeader>
          <CardTitle className="text-base text-amber-900 dark:text-amber-100/90">
            Temporary: test in-app notifications
          </CardTitle>
          <CardDescription>
            Remove this block before production. Creates a post-it in the
            top-right for your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            onClick={() => {
              setTestTitle("Test notification");
              setTestBody("");
              setTestImportance("normal");
              setTestLinkHref("");
              setTestLinkLabel("");
              setTestNotifOpen(true);
            }}
          >
            <StickyNote className="h-4 w-4" />
            New test notification…
          </Button>
        </CardContent>
      </Card>

      <Dialog open={testNotifOpen} onOpenChange={setTestNotifOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Test notification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="test-notif-title">Title</Label>
              <Input
                id="test-notif-title"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                placeholder="Test notification"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-notif-body">Message</Label>
              <Textarea
                id="test-notif-body"
                value={testBody}
                onChange={(e) => setTestBody(e.target.value)}
                placeholder="Notification text…"
                rows={4}
                className="resize-y min-h-[5rem]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-notif-importance">Importance</Label>
              <select
                id="test-notif-importance"
                value={testImportance}
                onChange={(e) =>
                  setTestImportance(
                    e.target.value as "low" | "normal" | "high" | "urgent",
                  )
                }
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <NotificationImportanceLegend />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-notif-link">Link (optional)</Label>
              <Input
                id="test-notif-link"
                value={testLinkHref}
                onChange={(e) => setTestLinkHref(e.target.value)}
                placeholder="e.g. /dashboard"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-notif-link-label">Link label (optional)</Label>
              <Input
                id="test-notif-link-label"
                value={testLinkLabel}
                onChange={(e) => setTestLinkLabel(e.target.value)}
                placeholder="e.g. Open dashboard"
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTestNotifOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                const title = testTitle.trim() || "Test notification";
                try {
                  if (!user?.userId) {
                    toast.error("No session user id — sign in again.");
                    return;
                  }
                  await createTestNotif({
                    forUserId: user.userId as Id<"users">,
                    title,
                    body: testBody.trim() || undefined,
                    importance: testImportance,
                    linkHref: testLinkHref.trim() || undefined,
                    linkLabel: testLinkLabel.trim() || undefined,
                  });
                  toast.success("Notification created — check the top-right.");
                  setTestNotifOpen(false);
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "Failed to create";
                  toast.error(msg);
                }
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
