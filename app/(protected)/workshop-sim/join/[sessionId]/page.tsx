import WorkshopSimJoinClient from "./workshop-sim-join-client";

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
