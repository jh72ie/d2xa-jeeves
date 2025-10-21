/**
 * Jeeves State API
 *
 * GET: Get current Jeeves configuration
 * PATCH: Update Jeeves configuration
 */

import { NextResponse } from "next/server";
import { getJeevesState, updateJeevesState, ensureJeevesState } from "@/lib/db/jeeves-queries";

/**
 * GET /api/jeeves/state
 */
export async function GET() {
  try {
    const state = await ensureJeevesState();
    return NextResponse.json(state);
  } catch (error: any) {
    console.error("[Jeeves State API] GET error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/jeeves/state
 *
 * Body: { enabled?, ingestionEnabled?, analysisInterval?, monitoredStreams? }
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    // Validate fields
    if (body.analysisInterval &&
        !['1hour', '3hour', '6hour', '24hour'].includes(body.analysisInterval)) {
      return NextResponse.json(
        { error: "Invalid analysisInterval. Must be: 1hour, 3hour, 6hour, or 24hour" },
        { status: 400 }
      );
    }

    if (body.monitoredStreams && !Array.isArray(body.monitoredStreams)) {
      return NextResponse.json(
        { error: "monitoredStreams must be an array" },
        { status: 400 }
      );
    }

    // Ensure state exists before updating
    await ensureJeevesState();

    // Update state
    await updateJeevesState(body);

    // Return updated state
    const updatedState = await getJeevesState();
    return NextResponse.json(updatedState);

  } catch (error: any) {
    console.error("[Jeeves State API] PATCH error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
