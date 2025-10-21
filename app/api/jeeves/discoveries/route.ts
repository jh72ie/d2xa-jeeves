/**
 * Jeeves Discoveries API
 *
 * GET: Get recent discoveries
 */

import { NextResponse } from "next/server";
import { getRecentDiscoveries, getDiscoveriesByStatus } from "@/lib/db/jeeves-queries";

/**
 * GET /api/jeeves/discoveries?hours=24&limit=50&status=new
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const hours = parseInt(searchParams.get("hours") || "24", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const status = searchParams.get("status");

    let discoveries;

    if (status) {
      discoveries = await getDiscoveriesByStatus(status, limit);
    } else {
      discoveries = await getRecentDiscoveries(hours, limit);
    }

    return NextResponse.json({
      discoveries,
      count: discoveries.length,
      hours: status ? undefined : hours,
      status: status || undefined,
    });

  } catch (error: any) {
    console.error("[Jeeves Discoveries API] Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
