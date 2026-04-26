"use client";

import { useAuthModeContext } from "@/components/auth-mode-context";
import { api } from "@/convex/_generated/api";
import { signInWithConvexPassword } from "@/lib/convex-auth-sign-in-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "convex/react";
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
import {
  AUTH_INPUT,
  AUTH_INPUT_NAME,
  AUTH_INPUT_PASSWORD,
} from "@/lib/auth-page-field-classes";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  name: z.string().min(2, "Name required"),
  email: z.string().email(),
  password: z.string().min(8, "At least 8 characters"),
  companyId: z.string().min(1, "Choose your company"),
});

type Values = z.infer<typeof schema>;

export function RegisterForm() {
  const authMode = useAuthModeContext();
  const companies = useQuery(api.companies.listForRegister);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      companyId: "",
    },
  });

  async function onSubmit(values: Values) {
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        name: values.name,
        email: values.email,
        password: values.password,
        companyId: values.companyId,
      }),
    });
    let data: { error?: string } = {};
    try {
      const text = await res.text();
      if (text) data = JSON.parse(text) as { error?: string };
    } catch {
      /* ignore */
    }
    if (!res.ok) {
      setError(data.error ?? "Registration failed");
      return;
    }
    const reg = data as { auth?: string };
    if (authMode === "convex" || reg.auth === "convex") {
      const signIn = await signInWithConvexPassword(
        values.email,
        values.password,
      );
      if (!signIn.ok) {
        setError(
          signIn.error +
            " — Account was created. Try signing in from the login page.",
        );
        return;
      }
    }
    window.location.assign("/dashboard");
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4 max-w-sm"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input
                  autoComplete="name"
                  className={AUTH_INPUT_NAME}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  className={AUTH_INPUT}
                  {...field}
                />
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
                <Input
                  type="password"
                  autoComplete="new-password"
                  className={AUTH_INPUT_PASSWORD}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="companyId"
          render={({ field }) => {
            const companyId = field.value;
            const companyTriggerLabel = !companyId
              ? null
              : companies === undefined
                ? "Loading…"
                : (companies.find((c) => c._id === companyId)?.name ??
                    "Unknown company");

            return (
              <FormItem>
                <FormLabel>Company</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger
                      className={cn(AUTH_INPUT, "w-full min-w-0 justify-between")}
                    >
                      <SelectValue placeholder="Select operator company">
                        {companyTriggerLabel}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(companies ?? []).map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            );
          }}
        />
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button
          type="submit"
          className="w-full border-0 bg-brand-sky font-semibold text-white shadow-md hover:bg-brand-sky/90 dark:hover:bg-brand-sky/85"
          disabled={form.formState.isSubmitting}
        >
          Create account
        </Button>
      </form>
    </Form>
  );
}
