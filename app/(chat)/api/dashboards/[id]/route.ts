import { auth } from "@/app/(auth)/auth";
import { publishedDashboard } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and } from "drizzle-orm";
import postgres from "postgres";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized:api").toResponse();
    }

    const resolvedParams = await params;
    const dashboardId = resolvedParams.id;
    if (!dashboardId) {
      return new ChatSDKError("bad_request:api", "Invalid dashboard ID").toResponse();
    }

    // Database connection
    const client = postgres(process.env.POSTGRES_URL!);
    const db = drizzle(client);

    // Check if dashboard exists and belongs to user
    const [existing] = await db
      .select()
      .from(publishedDashboard)
      .where(
        and(
          eq(publishedDashboard.id, dashboardId),
          eq(publishedDashboard.userId, session.user.id)
        )
      );

    if (!existing) {
      await client.end();
      return new ChatSDKError("not_found:api", "Dashboard not found").toResponse();
    }

    // Delete the dashboard
    await db
      .delete(publishedDashboard)
      .where(
        and(
          eq(publishedDashboard.id, dashboardId),
          eq(publishedDashboard.userId, session.user.id)
        )
      );

    await client.end();

    return Response.json({
      success: true,
      message: "Dashboard deleted successfully",
    });

  } catch (error) {
    console.error("[Delete Dashboard API] Error:", error);
    return new ChatSDKError(
      "bad_request:api",
      `Failed to delete dashboard: ${error instanceof Error ? error.message : String(error)}`
    ).toResponse();
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new ChatSDKError("unauthorized:api").toResponse();
    }

    const resolvedParams = await params;
    const dashboardId = resolvedParams.id;
    if (!dashboardId) {
      return new ChatSDKError("bad_request:api", "Invalid dashboard ID").toResponse();
    }

    const body = await request.json();
    const { title, description, expiresIn, password, maxViews, status } = body;

    // Database connection
    const client = postgres(process.env.POSTGRES_URL!);
    const db = drizzle(client);

    // Check if dashboard exists and belongs to user
    const [existing] = await db
      .select()
      .from(publishedDashboard)
      .where(
        and(
          eq(publishedDashboard.id, dashboardId),
          eq(publishedDashboard.userId, session.user.id)
        )
      );

    if (!existing) {
      await client.end();
      return new ChatSDKError("not_found:api", "Dashboard not found").toResponse();
    }

    // Calculate new expiry if provided
    let newExpiresAt = existing.expiresAt;
    if (expiresIn !== undefined) {
      if (expiresIn === 'never') {
        newExpiresAt = null;
      } else {
        const now = new Date();
        const durations: Record<string, number> = {
          '1h': 60 * 60 * 1000,
          '24h': 24 * 60 * 60 * 1000,
          '7d': 7 * 24 * 60 * 60 * 1000,
          '30d': 30 * 24 * 60 * 60 * 1000,
        };

        if (durations[expiresIn]) {
          newExpiresAt = new Date(now.getTime() + durations[expiresIn]);
        }
      }
    }

    // Hash password if provided
    let hashedPassword = existing.password;
    if (password !== undefined) {
      if (password) {
        const crypto = await import('crypto');
        hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
      } else {
        hashedPassword = null;
      }
    }

    // Update the dashboard
    const [updated] = await db
      .update(publishedDashboard)
      .set({
        title: title ?? existing.title,
        description: description ?? existing.description,
        expiresAt: newExpiresAt,
        password: hashedPassword,
        maxViews: maxViews !== undefined ? String(maxViews) : existing.maxViews,
        status: status ?? existing.status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(publishedDashboard.id, dashboardId),
          eq(publishedDashboard.userId, session.user.id)
        )
      )
      .returning();

    await client.end();

    return Response.json({
      success: true,
      dashboard: updated,
      message: "Dashboard updated successfully",
    });

  } catch (error) {
    console.error("[Update Dashboard API] Error:", error);
    return new ChatSDKError(
      "bad_request:api",
      `Failed to update dashboard: ${error instanceof Error ? error.message : String(error)}`
    ).toResponse();
  }
}