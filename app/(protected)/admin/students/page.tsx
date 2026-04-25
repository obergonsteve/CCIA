import AdminStudentsClient from "../admin-students-client";

type PageProps = {
  params: Promise<Record<string, string | string[] | undefined>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminStudentsPage({
  params,
  searchParams,
}: PageProps) {
  await Promise.all([params, searchParams]);
  return <AdminStudentsClient />;
}
