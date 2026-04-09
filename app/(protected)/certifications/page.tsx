"use client";

import { api } from "@/convex/_generated/api";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useQuery } from "convex/react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function CertificationsPage() {
  const levels = useQuery(api.certifications.listForUser);

  if (!levels) {
    return <div className="animate-pulse h-48 bg-muted rounded" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Certifications</h1>
        <p className="text-muted-foreground">
          CCIA standard levels and any levels assigned to your company appear
          here.
        </p>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {levels.map((level) => (
          <li key={level._id}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{level.name}</CardTitle>
                <CardDescription className="line-clamp-3">
                  {level.description}
                </CardDescription>
                <Link
                  href={`/certifications/${level._id}`}
                  className={cn(
                    buttonVariants({ variant: "secondary", size: "sm" }),
                    "w-fit mt-2 inline-flex gap-2",
                  )}
                >
                  View units <ArrowRight className="h-4 w-4" />
                </Link>
              </CardHeader>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
