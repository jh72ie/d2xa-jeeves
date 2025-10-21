import { publishedDashboard, publishedDashboardAccess } from "@/lib/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { PublishedDashboard, PublishedDashboardAccess } from "@/lib/db/schema";

// Database connection - support both NEW_POSTGRES_URL (from Neon) and POSTGRES_URL
const client = postgres(process.env.NEW_POSTGRES_URL || process.env.POSTGRES_URL!);
const db = drizzle(client);

/**
 * Get dashboard by slug
 */
export async function getDashboardBySlug(slug: string): Promise<PublishedDashboard | null> {
  const [dashboard] = await db
    .select()
    .from(publishedDashboard)
    .where(eq(publishedDashboard.slug, slug))
    .limit(1);

  return dashboard || null;
}

/**
 * Get dashboard by ID
 */
export async function getDashboardById(id: string): Promise<PublishedDashboard | null> {
  const [dashboard] = await db
    .select()
    .from(publishedDashboard)
    .where(eq(publishedDashboard.id, id))
    .limit(1);

  return dashboard || null;
}

/**
 * Get all dashboards for a user
 */
export async function getDashboardsByUserId(userId: string): Promise<PublishedDashboard[]> {
  return await db
    .select()
    .from(publishedDashboard)
    .where(eq(publishedDashboard.userId, userId))
    .orderBy(desc(publishedDashboard.createdAt));
}

/**
 * Increment view count for dashboard
 */
export async function incrementDashboardViews(dashboardId: string): Promise<void> {
  await db
    .update(publishedDashboard)
    .set({
      currentViews: sql`CAST(COALESCE(${publishedDashboard.currentViews}, '0') AS INTEGER) + 1`,
      lastAccessedAt: new Date(),
    })
    .where(eq(publishedDashboard.id, dashboardId));
}

/**
 * Update dashboard status
 */
export async function updateDashboardStatus(
  dashboardId: string,
  status: 'active' | 'expired' | 'revoked'
): Promise<void> {
  await db
    .update(publishedDashboard)
    .set({ status })
    .where(eq(publishedDashboard.id, dashboardId));
}

/**
 * Track dashboard access
 */
export async function trackDashboardAccess(
  dashboardId: string,
  accessData: {
    ipAddress?: string | null;
    userAgent?: string | null;
    referer?: string | null;
    country?: string | null;
    city?: string | null;
    sessionId?: string | null;
  }
): Promise<void> {
  await db.insert(publishedDashboardAccess).values({
    dashboardId,
    ipAddress: accessData.ipAddress || null,
    userAgent: accessData.userAgent || null,
    referer: accessData.referer || null,
    country: accessData.country || null,
    city: accessData.city || null,
    sessionId: accessData.sessionId || null,
  });
}

/**
 * Get access analytics for dashboard
 */
export async function getDashboardAnalytics(dashboardId: string): Promise<{
  totalAccesses: number;
  recentAccesses: PublishedDashboardAccess[];
  accessesByCountry: Array<{ country: string; count: number }>;
}> {
  // Get total accesses
  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(publishedDashboardAccess)
    .where(eq(publishedDashboardAccess.dashboardId, dashboardId));

  // Get recent accesses
  const recentAccesses = await db
    .select()
    .from(publishedDashboardAccess)
    .where(eq(publishedDashboardAccess.dashboardId, dashboardId))
    .orderBy(desc(publishedDashboardAccess.accessedAt))
    .limit(10);

  // Get accesses by country
  const accessesByCountry = await db
    .select({
      country: publishedDashboardAccess.country,
      count: sql<number>`COUNT(*)`,
    })
    .from(publishedDashboardAccess)
    .where(
      and(
        eq(publishedDashboardAccess.dashboardId, dashboardId),
        sql`${publishedDashboardAccess.country} IS NOT NULL`
      )
    )
    .groupBy(publishedDashboardAccess.country)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(5);

  return {
    totalAccesses: Number(count),
    recentAccesses,
    accessesByCountry: accessesByCountry.map(row => ({
      country: row.country || 'Unknown',
      count: Number(row.count),
    })),
  };
}

/**
 * Check if dashboard has reached view limit
 */
export async function hasReachedViewLimit(dashboardId: string): Promise<boolean> {
  const dashboard = await getDashboardById(dashboardId);
  if (!dashboard || !dashboard.maxViews) return false;

  const currentViews = parseInt(dashboard.currentViews || '0', 10);
  const maxViews = parseInt(dashboard.maxViews, 10);

  return currentViews >= maxViews;
}

/**
 * Check if dashboard is expired
 */
export async function isDashboardExpired(dashboardId: string): Promise<boolean> {
  const dashboard = await getDashboardById(dashboardId);
  if (!dashboard || !dashboard.expiresAt) return false;

  return new Date(dashboard.expiresAt) < new Date();
}

/**
 * Revoke dashboard access
 */
export async function revokeDashboard(dashboardId: string): Promise<void> {
  await updateDashboardStatus(dashboardId, 'revoked');
}

/**
 * Update dashboard settings
 */
export async function updateDashboard(
  dashboardId: string,
  updates: {
    title?: string;
    description?: string;
    expiresAt?: Date | null;
    maxViews?: number | null;
    password?: string | null;
  }
): Promise<void> {
  const updateData: any = {};

  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.expiresAt !== undefined) updateData.expiresAt = updates.expiresAt;
  if (updates.maxViews !== undefined) updateData.maxViews = updates.maxViews ? String(updates.maxViews) : null;
  if (updates.password !== undefined) updateData.password = updates.password;

  await db
    .update(publishedDashboard)
    .set(updateData)
    .where(eq(publishedDashboard.id, dashboardId));
}

/**
 * Expire old dashboards (run as cron job)
 */
export async function expireOldDashboards(): Promise<number> {
  const result = await db
    .update(publishedDashboard)
    .set({ status: 'expired' })
    .where(
      and(
        eq(publishedDashboard.status, 'active'),
        sql`${publishedDashboard.expiresAt} IS NOT NULL`,
        sql`${publishedDashboard.expiresAt} < NOW()`
      )
    )
    .returning();

  return result.length;
}