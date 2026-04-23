import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SITE_APP_NAME, SITE_FOOTER_PUBLIC, SITE_ORG_NAME_NSW } from "@/lib/site-brand";
import { BookOpen, Shield, Video } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<Record<string, string | string[] | undefined>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LandingPage({ params, searchParams }: PageProps) {
  await Promise.all([params, searchParams]);
  return (
    <div className="min-h-svh flex flex-col bg-gradient-to-b from-background via-brand-gold/[0.07] to-brand-sky/[0.1]">
      <header className="relative border-b border-white/10 bg-brand-charcoal pt-1 text-white shadow-md">
        <div
          className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-lime via-brand-gold to-brand-sky"
          aria-hidden
        />
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/LLLIA_trans.png"
              alt={SITE_APP_NAME}
              width={260}
              height={56}
              className="h-10 w-auto max-w-[min(100%,14rem)] shrink-0 object-contain object-left sm:h-11"
              priority
            />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-4 py-16 md:py-24 text-center space-y-6 relative">
          <div
            className="pointer-events-none absolute inset-x-0 top-8 mx-auto h-40 max-w-lg rounded-full bg-gradient-to-r from-brand-lime/15 via-brand-gold/12 to-brand-sky/15 blur-3xl"
            aria-hidden
          />
          <div className="relative flex flex-col items-center gap-2 sm:gap-2.5">
            <Image
              src="/LLLIA_logo.png"
              alt={SITE_APP_NAME}
              width={138}
              height={137}
              className="h-20 w-auto object-contain sm:h-24 md:h-28"
              priority
            />
            <p className="text-sm sm:text-base font-medium text-foreground/90 text-balance max-w-md px-2">
              {SITE_ORG_NAME_NSW}
            </p>
          </div>
          <p className="relative text-base sm:text-lg md:text-xl font-semibold uppercase tracking-wide text-[color-mix(in_oklab,var(--brand-sky)_74%,black)] drop-shadow-sm dark:text-[color-mix(in_oklab,var(--brand-sky)_72%,black)]">
            Operator training
          </p>
          <h1 className="relative text-3xl md:text-5xl font-bold tracking-tight text-balance bg-gradient-to-br from-brand-lime via-brand-gold to-brand-sky bg-clip-text text-transparent">
            Certification pathways for land lease community operations
          </h1>
          <p className="relative text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            Structured units, assessments, and realtime progress for staff
            working in residential land lease communities — aligned with
            industry compliance and safety expectations under legislation such as
            the Residential (Land Lease) Communities Act.
          </p>
          <div className="relative flex flex-wrap justify-center gap-3">
            <Link
              href="/login"
              className={cn(
                buttonVariants({ size: "lg", variant: "lime" }),
                "min-w-[8.5rem] px-8 sm:min-w-36 sm:px-10",
                "text-white hover:text-white",
              )}
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className={cn(
                buttonVariants({ size: "lg", variant: "ruby" }),
                "min-w-[8.5rem] px-8 sm:min-w-36 sm:px-10",
              )}
            >
              Register
            </Link>
          </div>
        </section>

        <section className="border-y border-white/10 bg-brand-charcoal text-white">
          <div className="max-w-5xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-6">
            <Card className="border border-white/12 bg-white/5 shadow-none backdrop-blur-sm">
              <CardHeader>
                <BookOpen className="h-8 w-8 text-brand-lime mb-2" />
                <CardTitle className="text-lg text-white">Level-based learning</CardTitle>
                <CardDescription className="text-white/75">
                  Certification levels and units with videos, documents, and
                  supporting links.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border border-white/12 bg-white/5 shadow-none backdrop-blur-sm">
              <CardHeader>
                <Shield className="h-8 w-8 text-brand-gold mb-2" />
                <CardTitle className="text-lg text-white">Assessments</CardTitle>
                <CardDescription className="text-white/75">
                  Auto-graded quizzes with clear pass criteria and instant
                  feedback on results.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border border-white/12 bg-white/5 shadow-none backdrop-blur-sm">
              <CardHeader>
                <Video className="h-8 w-8 text-brand-sky mb-2" />
                <CardTitle className="text-lg text-white">Live webinars</CardTitle>
                <CardDescription className="text-white/75">
                  Expert-led sessions in Microsoft Teams; browse the Webinars
                  calendar, register, and join when it&apos;s time.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground px-4">
        {SITE_FOOTER_PUBLIC}
      </footer>
    </div>
  );
}
