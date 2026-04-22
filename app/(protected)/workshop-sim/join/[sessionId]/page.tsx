import WorkshopSimJoinClient from "./workshop-sim-join-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Webinar session" },
};

type PageProps = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WorkshopSimJoinPage({
  params,
  searchParams,
}: PageProps) {
  const [resolvedParams] = await Promise.all([params, searchParams]);
  return <WorkshopSimJoinClient sessionId={resolvedParams.sessionId} />;
}
