import { buttonVariants } from "@/components/ui/button";
import { appPageGradientClass } from "@/lib/app-page-surface";
import {
  SITE_APP_NAME,
  SITE_ORG_INDUSTRY_LINE,
  SITE_ORG_NAME,
} from "@/lib/site-brand";
import Image from "next/image";
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
        className={cn(
          "pointer-events-none absolute inset-0",
          appPageGradientClass,
        )}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-brand-lime via-brand-gold to-brand-sky"
        aria-hidden
      />
      <div
        className={cn(
          "relative w-full max-w-md space-y-6 rounded-2xl border-2 border-brand-gold/55 bg-card/90 p-6 backdrop-blur-sm dark:border-brand-gold/50 dark:bg-card/80 sm:p-8",
          "shadow-[0_20px_40px_-8px_rgba(0,0,0,0.24),0_8px_16px_-4px_rgba(0,0,0,0.12)]",
          "dark:shadow-[0_24px_48px_-8px_rgba(0,0,0,0.62),0_12px_24px_-6px_rgba(0,0,0,0.42)]",
        )}
      >
        <div className="text-center space-y-2">
          <div className="flex justify-center pb-1">
            <Image
              src="/LLLIA_logo.png"
              alt={SITE_APP_NAME}
              width={138}
              height={137}
              className="h-16 w-auto object-contain sm:h-[4.5rem]"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            <span className="block">{SITE_ORG_NAME}</span>
            <span className="mt-0.5 block">
              {SITE_ORG_INDUSTRY_LINE}{" "}
              <span className="text-brand-sky dark:text-brand-sky/95">Training</span>
            </span>
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
