import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getDashboardBySlug, incrementDashboardViews, trackDashboardAccess, hasReachedViewLimit } from "@/lib/db/dashboard-queries";
import { PublicDashboardViewer } from "@/components/public-dashboard-viewer";
import { DashboardExpired } from "@/components/dashboard-expired";
import { DashboardNotFound } from "@/components/dashboard-not-found";
import { DashboardViewLimitReached } from "@/components/dashboard-view-limit-reached";
import { PasswordProtectedDashboard } from "@/components/password-protected-dashboard";

export const dynamic = "force-dynamic";

interface PublicDashboardPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function PublicDashboardPage({ params }: PublicDashboardPageProps) {
  const { slug } = await params;

  console.log("[PublicDashboard] Loading dashboard with slug:", slug);

  // Fetch dashboard
  const dashboard = await getDashboardBySlug(slug);

  if (!dashboard) {
    console.log("[PublicDashboard] Dashboard not found");
    return <DashboardNotFound />;
  }

  console.log("[PublicDashboard] Dashboard found:", dashboard.id, dashboard.title);

  // Check if revoked
  if (dashboard.status === 'revoked') {
    console.log("[PublicDashboard] Dashboard revoked");
    return <DashboardExpired reason="revoked" />;
  }

  // Check if expired
  if (dashboard.expiresAt && new Date(dashboard.expiresAt) < new Date()) {
    console.log("[PublicDashboard] Dashboard expired at:", dashboard.expiresAt);
    return <DashboardExpired
      reason="expired"
      expiresAt={new Date(dashboard.expiresAt)}
    />;
  }

  // Check view limit
  if (await hasReachedViewLimit(dashboard.id)) {
    console.log("[PublicDashboard] View limit reached");
    return <DashboardViewLimitReached
      maxViews={parseInt(dashboard.maxViews || '0', 10)}
    />;
  }

  // Check password protection
  if (dashboard.password) {
    console.log("[PublicDashboard] Dashboard is password protected");
    // TODO: Check for valid session cookie
    // For now, always show password form
    return <PasswordProtectedDashboard dashboard={dashboard} />;
  }

  // Track access
  const headersList = await headers();
  await trackDashboardAccess(dashboard.id, {
    ipAddress: headersList.get('x-forwarded-for'),
    userAgent: headersList.get('user-agent'),
    referer: headersList.get('referer'),
  });

  console.log("[PublicDashboard] Access tracked");

  // Increment view count
  await incrementDashboardViews(dashboard.id);
  console.log("[PublicDashboard] View count incremented");

  // Render dashboard
  return (
    <PublicDashboardViewer
      dashboard={dashboard}
      html={dashboard.html}
      script={dashboard.script}
    />
  );
}

// Metadata
export async function generateMetadata({ params }: PublicDashboardPageProps) {
  const { slug } = await params;
  const dashboard = await getDashboardBySlug(slug);

  if (!dashboard) {
    return {
      title: 'Dashboard Not Found',
    };
  }

  return {
    title: dashboard.title,
    description: dashboard.description || 'Live Dashboard',
  };
}