import UnitClient from "./unit-client";

type PageProps = {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UnitPage({ params, searchParams }: PageProps) {
  const [resolvedParams, resolvedSearch] = await Promise.all([
    params,
    searchParams,
  ]);
  const levelRaw = resolvedSearch.level;
  const levelId =
    typeof levelRaw === "string" && levelRaw.length > 0 ? levelRaw : undefined;
  return <UnitClient unitId={resolvedParams.unitId} levelId={levelId} />;
}
