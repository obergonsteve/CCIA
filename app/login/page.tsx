import { buttonVariants } from "@/components/ui/button";
import { SITE_ORG_NAME } from "@/lib/site-brand";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<Record<string, string | string[] | undefined>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ params, searchParams }: PageProps) {
  await Promise.all([params, searchParams]);
  return (
    <div className="relative min-h-svh overflow-hidden p-6 flex flex-col items-center justify-center">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-sky/[0.14] via-background to-brand-lime/[0.12] dark:from-brand-sky/20 dark:via-background dark:to-brand-lime/16"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-brand-lime via-brand-gold to-brand-sky"
        aria-hidden
      />
      <div className="relative w-full max-w-md space-y-6 rounded-2xl border-2 border-brand-gold/55 bg-card/90 p-6 shadow-lg backdrop-blur-sm dark:border-brand-gold/50 dark:bg-card/80 sm:p-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {SITE_ORG_NAME}{" "}
            <span className="text-brand-sky dark:text-brand-sky/95">Training</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in with your organisation account.
          </p>
        </div>
        <LoginForm />
        <p className="text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link href="/register" className={cn(buttonVariants({ variant: "link" }), "p-0 h-auto text-brand-sky")}>
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
