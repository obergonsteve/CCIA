"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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

function safeNextFromSearch(search: string): string {
  const nextRaw =
    new URLSearchParams(search).get("next") ?? DEFAULT_AFTER_LOGIN;
  return nextRaw.startsWith("/") && !nextRaw.startsWith("//")
    ? nextRaw
    : DEFAULT_AFTER_LOGIN;
}

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(values),
    });
    let data: { error?: string } = {};
    try {
      const text = await res.text();
      if (text) data = JSON.parse(text) as { error?: string };
    } catch {
      /* non-JSON body from 500 etc. */
    }
    if (!res.ok) {
      setError(data.error ?? `Sign in failed (${res.status})`);
      return;
    }
    const payload = data as { user?: unknown; error?: string };
    if (!payload.user) {
      setError(payload.error ?? "Sign in failed: session was not created.");
      return;
    }
    window.location.assign(safeNextFromSearch(window.location.search));
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
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          Sign in
        </Button>
      </form>
    </Form>
  );
}
