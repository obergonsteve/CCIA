import AdminPageClient from "./admin-client";

type PageProps = {
  params: Promise<Record<string, string | string[] | undefined>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPage({ params, searchParams }: PageProps) {
  await Promise.all([params, searchParams]);
  return <AdminPageClient />;
}
