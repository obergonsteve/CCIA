import { Suspense } from "react";
import WorkshopsClient from "./workshops-client";

export default function WorkshopsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-8 text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <WorkshopsClient />
    </Suspense>
  );
}
