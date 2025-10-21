/**
 * Jeeves Dashboard Data API
 *
 * GET: Return dashboard HTML, script, and cardId for embedding
 */

import { NextResponse } from "next/server";
import { getDashboardBySlug } from "@/lib/db/dashboard-queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    console.log("[Dashboard Data API] Fetching dashboard:", slug);

    const dashboard = await getDashboardBySlug(slug);

    if (!dashboard) {
      console.log("[Dashboard Data API] Dashboard not found");
      return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
    }

    // Check if dashboard is accessible (not revoked, not expired, etc.)
    if (dashboard.status === 'revoked') {
      return NextResponse.json({ error: "Dashboard revoked" }, { status: 403 });
    }

    if (dashboard.expiresAt && new Date(dashboard.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Dashboard expired" }, { status: 410 });
    }

    console.log("[Dashboard Data API] Returning dashboard data");

    // Return only the HTML, script, and cardId needed for embedding
    return NextResponse.json({
      html: dashboard.html,
      script: dashboard.script,
      cardId: dashboard.cardId,
    });

  } catch (error: any) {
    console.error("[Dashboard Data API] Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
