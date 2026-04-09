import UnitClient from "./unit-client";

type PageProps = {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UnitPage({ params, searchParams }: PageProps) {
  const [resolvedParams] = await Promise.all([params, searchParams]);
  return <UnitClient unitId={resolvedParams.unitId} />;
}
