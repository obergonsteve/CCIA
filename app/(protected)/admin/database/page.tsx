import AdminDatabaseClient from "../admin-database-client";

type PageProps = {
  params: Promise<Record<string, string | string[] | undefined>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminDatabasePage({
  params,
  searchParams,
}: PageProps) {
  await Promise.all([params, searchParams]);
  return <AdminDatabaseClient />;
}
