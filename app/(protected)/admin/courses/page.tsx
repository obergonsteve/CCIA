import AdminCoursesClient from "../admin-courses-client";

type PageProps = {
  params: Promise<Record<string, string | string[] | undefined>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminCoursesPage({
  params,
  searchParams,
}: PageProps) {
  await Promise.all([params, searchParams]);
  return <AdminCoursesClient />;
}
