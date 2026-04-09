import AdminUsersClient from "../admin-users-client";

type PageProps = {
  params: Promise<Record<string, string | string[] | undefined>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminUsersPage({ params, searchParams }: PageProps) {
  await Promise.all([params, searchParams]);
  return <AdminUsersClient />;
}
