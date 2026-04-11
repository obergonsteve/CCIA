"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type Values = z.infer<typeof schema>;

const DEFAULT_AFTER_LOGIN = "/certifications";

/** Only allow post-login redirects to routes that exist (avoid silent 404 after auth). */
const ALLOWED_AFTER_LOGIN_PREFIXES = [
  "/dashboard",
  "/certifications",
  "/units",
  "/admin",
] as const;

function safeNextFromSearch(search: string): string {
  const nextRaw =
    new URLSearchParams(search).get("next") ?? DEFAULT_AFTER_LOGIN;
  if (!nextRaw.startsWith("/") || nextRaw.startsWith("//")) {
    return DEFAULT_AFTER_LOGIN;
  }
  const ok = ALLOWED_AFTER_LOGIN_PREFIXES.some(
    (p) => nextRaw === p || nextRaw.startsWith(`${p}/`),
  );
  return ok ? nextRaw : DEFAULT_AFTER_LOGIN;
}

function stringifyThrown(thrown: unknown): string {
  if (thrown instanceof Error) {
    const parts = [`${thrown.name}: ${thrown.message}`];
    if (thrown.stack) {
      parts.push("", thrown.stack);
    }
    if ("cause" in thrown && thrown.cause !== undefined) {
      parts.push("", "Cause:", stringifyThrown(thrown.cause));
    }
    return parts.join("\n");
  }
  if (typeof thrown === "object" && thrown !== null) {
    try {
      return JSON.stringify(thrown, null, 2);
    } catch {
      return String(thrown);
    }
  }
  return String(thrown);
}

function buildSignInProblemReport(parts: {
  headline: string;
  httpStatus?: number;
  httpStatusText?: string;
  responseBody?: string;
  jsonParseError?: string;
  parsedJson?: unknown;
  thrown?: unknown;
}): string {
  const lines: string[] = [
    parts.headline,
    "",
    `When: ${new Date().toISOString()}`,
    `Page: ${typeof window !== "undefined" ? window.location.href : "(unknown)"}`,
    `User agent: ${typeof navigator !== "undefined" ? navigator.userAgent : "(unknown)"}`,
  ];
  if (parts.httpStatus !== undefined) {
    lines.push(
      `HTTP: ${parts.httpStatus}${parts.httpStatusText ? ` ${parts.httpStatusText}` : ""}`,
    );
  }
  if (parts.jsonParseError) {
    lines.push("", "JSON parse error:", parts.jsonParseError);
  }
  if (parts.parsedJson !== undefined) {
    lines.push("", "Parsed JSON body:");
    try {
      lines.push(JSON.stringify(parts.parsedJson, null, 2));
    } catch {
      lines.push(String(parts.parsedJson));
    }
  }
  if (parts.responseBody !== undefined) {
    lines.push("", "Raw response body:");
    lines.push(parts.responseBody.length ? parts.responseBody : "(empty)");
  }
  if (parts.thrown !== undefined) {
    lines.push("", "Exception / rejection:");
    lines.push(stringifyThrown(parts.thrown));
  }
  return lines.join("\n");
}

export function LoginForm() {
  const [signInProblemOpen, setSignInProblemOpen] = useState(false);
  const [signInProblemReport, setSignInProblemReport] = useState<
    string | null
  >(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      email:
        process.env.NODE_ENV === "development"
          ? "steve.moore@ccia-landlease.com"
          : "",
      password:
        process.env.NODE_ENV === "development" ? "stevemoore" : "",
    },
  });

  async function onSubmit(values: Values) {
    setSignInProblemOpen(false);
    setSignInProblemReport(null);

    try {
      let res: Response;
      try {
        res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(values),
        });
      } catch (thrown) {
        setSignInProblemReport(
          buildSignInProblemReport({
            headline: "Network error calling /api/auth/login",
            thrown,
          }),
        );
        setSignInProblemOpen(true);
        return;
      }

      const responseText = await res.text();
      let parsedJson: unknown | undefined;
      let jsonParseError: string | undefined;
      if (responseText.trim()) {
        try {
          parsedJson = JSON.parse(responseText) as unknown;
        } catch (e) {
          jsonParseError =
            e instanceof Error ? e.message : "Could not parse JSON";
        }
      }

      if (!res.ok) {
        const payload = parsedJson as { error?: string } | undefined;
        setSignInProblemReport(
          buildSignInProblemReport({
            headline:
              payload?.error ??
              `Sign in failed (HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""})`,
            httpStatus: res.status,
            httpStatusText: res.statusText,
            responseBody: responseText,
            jsonParseError,
            parsedJson,
          }),
        );
        setSignInProblemOpen(true);
        return;
      }

      const payload = parsedJson as { user?: unknown; error?: string } | null;
      if (!payload?.user) {
        setSignInProblemReport(
          buildSignInProblemReport({
            headline:
              payload?.error ??
              "Sign in failed: session was not created (response OK but no user).",
            httpStatus: res.status,
            httpStatusText: res.statusText,
            responseBody: responseText,
            jsonParseError,
            parsedJson,
          }),
        );
        setSignInProblemOpen(true);
        return;
      }

      window.location.assign(safeNextFromSearch(window.location.search));
    } catch (thrown) {
      setSignInProblemReport(
        buildSignInProblemReport({
          headline: "Unexpected error during sign-in",
          thrown,
        }),
      );
      setSignInProblemOpen(true);
    }
  }

  async function copySignInProblemReport() {
    if (!signInProblemReport) {
      return;
    }
    try {
      await navigator.clipboard.writeText(signInProblemReport);
      toast.success("Copied full report to clipboard");
    } catch {
      toast.error("Could not copy — select the text below and copy manually.");
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4 max-w-sm"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          Sign in
        </Button>
      </form>

      <Dialog
        open={signInProblemOpen}
        onOpenChange={(open) => {
          setSignInProblemOpen(open);
          if (!open) {
            setSignInProblemReport(null);
          }
        }}
      >
        <DialogContent
          className="flex max-h-[min(90vh,40rem)] max-w-[calc(100%-2rem)] flex-col gap-0 p-0 sm:max-w-2xl"
          aria-describedby="sign-in-problem-desc"
        >
          <div className="border-b px-4 py-3 sm:px-5">
            <DialogHeader>
              <DialogTitle>Sign-in problem</DialogTitle>
              <DialogDescription id="sign-in-problem-desc">
                Full diagnostic text for support or debugging. Use Copy to share
                it exactly.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
            <pre
              className="whitespace-pre-wrap break-words rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-foreground"
              tabIndex={0}
            >
              {signInProblemReport ?? ""}
            </pre>
          </div>
          <DialogFooter className="gap-2 border-t bg-muted/30 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSignInProblemOpen(false);
                setSignInProblemReport(null);
              }}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={() => void copySignInProblemReport()}
              disabled={!signInProblemReport}
            >
              Copy error
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form>
  );
}
