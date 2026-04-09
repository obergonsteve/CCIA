import { buttonVariants } from "@/components/ui/button";
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
    <div className="min-h-svh flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            CCIA Land Lease Training
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in with your organisation account.
          </p>
        </div>
        <LoginForm />
        <p className="text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link href="/register" className={cn(buttonVariants({ variant: "link" }), "p-0 h-auto")}>
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
