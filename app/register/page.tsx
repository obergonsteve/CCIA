import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { RegisterForm } from "./register-form";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  return (
    <div className="min-h-svh flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Create account</h1>
          <p className="text-sm text-muted-foreground">
            Your company must be provisioned by CCIA before you can register.
          </p>
        </div>
        <RegisterForm />
        <p className="text-center text-sm text-muted-foreground">
          Already registered?{" "}
          <Link href="/login" className={cn(buttonVariants({ variant: "link" }), "p-0 h-auto")}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
