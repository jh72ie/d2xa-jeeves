/**
 * Jeeves Activity Logs API
 *
 * GET: Fetch recent activity logs
 */

import { NextResponse } from "next/server";
import { getRecentActivityLogs } from "@/lib/db/jeeves-queries";

/**
 * GET /api/jeeves/activity-logs
 *
 * Returns recent activity logs from Jeeves executions
 */
export async function GET() {
  try {
    // Try to get logs, but if table doesn't exist yet, return empty
    let logs = [];
    try {
      logs = await getRecentActivityLogs(100);
    } catch (dbError: any) {
      console.warn("[Activity Logs API] Database not ready (table may not exist yet):", dbError.message);
      // Return empty logs instead of error
      return NextResponse.json({
        logs: [],
        count: 0,
        warning: "Activity log table not created yet. Run migration 012_jeeves_activity_log.sql"
      });
    }

    return NextResponse.json({
      logs,
      count: logs.length,
    });
  } catch (error: any) {
    console.error("[Activity Logs API] Error:", error);
    return NextResponse.json(
      {
        error: error.message,
        logs: [],
        count: 0,
      },
      { status: 500 }
    );
  }
}
