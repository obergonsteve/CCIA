import CertificationsClient from "./certifications-client";

type PageProps = {
  params: Promise<Record<string, string | string[] | undefined>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CertificationsPage({
  params,
  searchParams,
}: PageProps) {
  await Promise.all([params, searchParams]);
  return <CertificationsClient />;
}
