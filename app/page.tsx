import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Award, BookOpen, Shield, Tablet } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  return (
    <div className="min-h-svh flex flex-col">
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <Award className="h-7 w-7" />
            CCIA Land Lease Division
          </div>
          <div className="flex gap-2">
            <Link
              href="/register"
              className={cn(buttonVariants({ variant: "ghost" }))}
            >
              Register
            </Link>
            <Link href="/login" className={cn(buttonVariants())}>
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-4 py-16 md:py-24 text-center space-y-6">
          <p className="text-sm font-medium text-primary uppercase tracking-wide">
            Operator training — Australia
          </p>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-balance">
            Certification pathways for land lease community operations
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            Structured units, assessments, and realtime progress for staff
            working in residential land lease communities — aligned with
            industry compliance and safety expectations under legislation such as
            the Residential (Land Lease) Communities Act.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/login" className={cn(buttonVariants({ size: "lg" }))}>
              Access training
            </Link>
            <Link
              href="/register"
              className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
            >
              Create an account
            </Link>
          </div>
        </section>

        <section className="bg-muted/40 border-y">
          <div className="max-w-5xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-6">
            <Card className="border-none shadow-none bg-transparent">
              <CardHeader>
                <BookOpen className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Level-based learning</CardTitle>
                <CardDescription>
                  Certification levels and units with videos, documents, and
                  supporting links.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-none shadow-none bg-transparent">
              <CardHeader>
                <Shield className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Assessments</CardTitle>
                <CardDescription>
                  Auto-graded quizzes with clear pass criteria and instant
                  feedback on results.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-none shadow-none bg-transparent">
              <CardHeader>
                <Tablet className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Field-ready PWA</CardTitle>
                <CardDescription>
                  Install on tablet or phone; train on site with offline-aware
                  viewing.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground px-4">
        CCIA Land Lease Division Training Portal — Caravan & Camping Industry
        Association (Australia).
      </footer>
    </div>
  );
}
