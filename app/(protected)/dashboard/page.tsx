import DashboardClient from "./dashboard-client";

type PageProps = {
  params: Promise<Record<string, string | string[] | undefined>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({ params, searchParams }: PageProps) {
  await Promise.all([params, searchParams]);
  return <DashboardClient />;
}
