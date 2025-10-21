import { auth } from "@/app/(auth)/auth";
import { publishedDashboard, user } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, desc, and } from "drizzle-orm";
import postgres from "postgres";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized:api").toResponse();
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // Database connection
    const client = postgres(process.env.POSTGRES_URL!);
    const db = drizzle(client);

    // Build query conditions - show all dashboards from all users
    let conditions: any[] = [];

    if (status && status !== 'all') {
      // Type guard to ensure status is a valid enum value
      if (status === 'active' || status === 'expired' || status === 'revoked' || status === 'paused') {
        conditions.push(eq(publishedDashboard.status, status));
      }
    }

    // Get dashboards with pagination, including user info
    const offset = (page - 1) * limit;
    const dashboards = await db
      .select({
        id: publishedDashboard.id,
        userId: publishedDashboard.userId,
        chatId: publishedDashboard.chatId,
        title: publishedDashboard.title,
        description: publishedDashboard.description,
        html: publishedDashboard.html,
        script: publishedDashboard.script,
        cardId: publishedDashboard.cardId,
        slug: publishedDashboard.slug,
        accessToken: publishedDashboard.accessToken,
        password: publishedDashboard.password,
        expiresAt: publishedDashboard.expiresAt,
        maxViews: publishedDashboard.maxViews,
        currentViews: publishedDashboard.currentViews,
        streams: publishedDashboard.streams,
        config: publishedDashboard.config,
        status: publishedDashboard.status,
        createdAt: publishedDashboard.createdAt,
        updatedAt: publishedDashboard.updatedAt,
        lastAccessedAt: publishedDashboard.lastAccessedAt,
        userEmail: user.email,
        userName: user.email, // Use email as name since User table has no name column
      })
      .from(publishedDashboard)
      .leftJoin(user, eq(publishedDashboard.userId, user.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(publishedDashboard.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const totalResult = await db
      .select({ count: publishedDashboard.id })
      .from(publishedDashboard)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = totalResult.length;
    const totalPages = Math.ceil(total / limit);

    // Calculate status for each dashboard
    const now = new Date();
    const dashboardsWithStatus = dashboards.map(dashboard => {
      let calculatedStatus = dashboard.status;

      // Check if expired
      if (dashboard.expiresAt && dashboard.expiresAt < now) {
        calculatedStatus = 'expired';
      }

      // Check if max views reached
      if (dashboard.maxViews &&
          parseInt(dashboard.currentViews) >= parseInt(dashboard.maxViews)) {
        calculatedStatus = 'expired';
      }

      // Construct full URL
      const baseUrl = process.env.NEXT_PUBLIC_URL ||
                     process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
                     'http://localhost:3000';
      const url = `${baseUrl}/d/${dashboard.slug}`;

      return {
        id: dashboard.id,
        title: dashboard.title,
        description: dashboard.description,
        slug: dashboard.slug,
        url,
        status: calculatedStatus,
        createdAt: dashboard.createdAt,
        expiresAt: dashboard.expiresAt,
        currentViews: parseInt(dashboard.currentViews),
        maxViews: dashboard.maxViews ? parseInt(dashboard.maxViews) : null,
        hasPassword: !!dashboard.password,
        streams: dashboard.streams || [],
        lastAccessed: dashboard.lastAccessedAt,
        userEmail: dashboard.userEmail,
        userName: dashboard.userName,
      };
    });

    // Calculate summary statistics
    const totalDashboards = total;
    const activeDashboards = dashboardsWithStatus.filter(d => d.status === 'active').length;
    const totalViews = dashboardsWithStatus.reduce((sum, d) => sum + d.currentViews, 0);

    await client.end();

    return Response.json({
      success: true,
      dashboards: dashboardsWithStatus,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      summary: {
        totalDashboards,
        activeDashboards,
        totalViews,
      },
    });

  } catch (error) {
    console.error("[List Dashboards API] Error:", error);
    return new ChatSDKError(
      "bad_request:api",
      `Failed to fetch dashboards: ${error instanceof Error ? error.message : String(error)}`
    ).toResponse();
  }
}