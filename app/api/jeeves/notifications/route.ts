/**
 * Jeeves Notifications API
 *
 * GET: Get notifications for a persona
 * PATCH: Mark notification as viewed/acknowledged
 */

import { NextResponse } from "next/server";
import {
  getNotificationsByPersona,
  getAllNotifications,
  markNotificationViewed,
  markNotificationAcknowledged,
  countUnreadNotifications,
} from "@/lib/db/jeeves-queries";

/**
 * GET /api/jeeves/notifications?personaName=Bob-eng&limit=50
 * GET /api/jeeves/notifications?all=true (get all notifications)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const personaName = searchParams.get("personaName");
    const all = searchParams.get("all") === "true";
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    let notifications;
    let unreadCount = 0;

    if (all) {
      notifications = await getAllNotifications(limit);
    } else if (personaName) {
      notifications = await getNotificationsByPersona(personaName, limit);
      unreadCount = await countUnreadNotifications(personaName);
    } else {
      return NextResponse.json(
        { error: "Missing personaName or all=true parameter" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      notifications,
      count: notifications.length,
      unreadCount: personaName ? unreadCount : undefined,
      personaName: personaName || undefined,
    });

  } catch (error: any) {
    console.error("[Jeeves Notifications API] GET error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/jeeves/notifications
 *
 * Body: { notificationId, action: "viewed" | "acknowledged" }
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    const { notificationId, action } = body;

    if (!notificationId || !action) {
      return NextResponse.json(
        { error: "Missing notificationId or action" },
        { status: 400 }
      );
    }

    if (action === "viewed") {
      await markNotificationViewed(notificationId);
    } else if (action === "acknowledged") {
      await markNotificationAcknowledged(notificationId);
    } else {
      return NextResponse.json(
        { error: "Invalid action. Must be: viewed or acknowledged" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, notificationId, action });

  } catch (error: any) {
    console.error("[Jeeves Notifications API] PATCH error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
