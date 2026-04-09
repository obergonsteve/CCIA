import CertificationLevelClient from "./certification-level-client";

type PageProps = {
  params: Promise<{ levelId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CertificationLevelPage({
  params,
  searchParams,
}: PageProps) {
  const [resolvedParams] = await Promise.all([params, searchParams]);
  return <CertificationLevelClient levelId={resolvedParams.levelId} />;
}
