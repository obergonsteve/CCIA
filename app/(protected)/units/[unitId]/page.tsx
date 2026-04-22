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
  const sessionRaw = resolvedSearch.session;
  const workshopSessionId =
    typeof sessionRaw === "string" && sessionRaw.length > 0
      ? sessionRaw
      : undefined;
  const fromRaw = resolvedSearch.from;
  const fromWorkshops =
    typeof fromRaw === "string" && fromRaw.trim().toLowerCase() === "workshops";
  return (
    <UnitClient
      unitId={resolvedParams.unitId}
      levelId={levelId}
      workshopSessionId={workshopSessionId}
      fromWorkshops={fromWorkshops}
    />
  );
}
