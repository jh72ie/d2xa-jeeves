/**
 * Jeeves Feedback API
 *
 * POST: Submit feedback on notification
 */

import { NextResponse } from "next/server";
import { submitNotificationFeedback } from "@/lib/db/jeeves-queries";

/**
 * POST /api/jeeves/feedback
 *
 * Body: { notificationId, helpful: boolean, comment?: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { notificationId, helpful, comment } = body;

    if (!notificationId || typeof helpful !== "boolean") {
      return NextResponse.json(
        { error: "Missing notificationId or helpful (boolean)" },
        { status: 400 }
      );
    }

    await submitNotificationFeedback(notificationId, helpful, comment);

    return NextResponse.json({
      success: true,
      notificationId,
      helpful,
      message: "Feedback recorded. Jeeves will learn from this.",
    });

  } catch (error: any) {
    console.error("[Jeeves Feedback API] Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
