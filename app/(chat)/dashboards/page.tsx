import { auth } from "@/app/(auth)/auth";
import { redirect } from "next/navigation";
import DashboardControlPanel from "./components/dashboard-control-panel";

export default async function DashboardsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Published Dashboards</h1>
          <p className="text-muted-foreground mt-2">
            View and manage all published dashboards from all users
          </p>
        </div>
      </div>

      <DashboardControlPanel userId={session.user.id} />
    </div>
  );
}

export const metadata = {
  title: "Published Dashboards",
  description: "Manage your published dashboards and view analytics",
};