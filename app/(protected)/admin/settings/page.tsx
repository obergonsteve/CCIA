import AdminSettingsClient from "../admin-settings-client";

type PageProps = {
  params: Promise<Record<string, string | string[] | undefined>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminSettingsPage({
  params,
  searchParams,
}: PageProps) {
  await Promise.all([params, searchParams]);
  return <AdminSettingsClient />;
}
