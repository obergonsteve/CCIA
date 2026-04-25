import CertificationLevelClient from "./certification-level-client";

type PageProps = {
  params: Promise<{ levelId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CertificationLevelPage({
  params,
  searchParams,
}: PageProps) {
  const [resolvedParams, resolvedSearch] = await Promise.all([
    params,
    searchParams,
  ]);
  const viewAsRaw = resolvedSearch.viewAs;
  const viewAsUserId =
    typeof viewAsRaw === "string" && viewAsRaw.length > 0
      ? viewAsRaw
      : undefined;
  return (
    <CertificationLevelClient
      levelId={resolvedParams.levelId}
      viewAsUserId={viewAsUserId}
    />
  );
}
