/**
 * Jeeves Cron Endpoint
 *
 * Vercel Cron job that runs Jeeves analysis automatically
 * Configure in vercel.json or Vercel dashboard
 */

import { NextResponse } from "next/server";
import { runJeevesAnalysis } from "@/lib/jeeves/orchestrator";
import { getJeevesState, logActivity } from "@/lib/db/jeeves-queries";
import crypto from "crypto";

// Configure as Edge Runtime for Vercel Cron
export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max

/**
 * GET /api/cron/jeeves
 *
 * Triggered by Vercel Cron
 */
export async function GET(request: Request) {
  console.log("[Jeeves Cron] Triggered at", new Date().toISOString());

  try {
    // Check if it's time to run
    const state = await getJeevesState();

    if (!state) {
      return NextResponse.json(
        { error: "Jeeves not initialized" },
        { status: 500 }
      );
    }

    if (!state.enabled) {
      console.log("[Jeeves Cron] Skipped - Jeeves is disabled");
      return NextResponse.json({
        skipped: true,
        reason: "Jeeves is disabled",
        enabled: false,
      });
    }

    // CRITICAL: Check if previous run is still running
    // lastExecutionStartedAt is set when analysis starts, cleared when it finishes
    // If it exists and is < 5 min old, previous run is still active
    if (state.lastExecutionStartedAt) {
      const lastStartTime = new Date(state.lastExecutionStartedAt).getTime();
      const now = Date.now();
      const timeSinceStart = now - lastStartTime;
      const MAX_EXECUTION_TIME = 240000; // 4 minutes (leave 1 min buffer before 5 min timeout)

      if (timeSinceStart < MAX_EXECUTION_TIME) {
        console.log("[Jeeves Cron] ⏭️ SKIPPED - Previous run still in progress");
        console.log("[Jeeves Cron] Started:", new Date(lastStartTime).toISOString());
        console.log("[Jeeves Cron] Running for:", Math.round(timeSinceStart / 1000), "seconds");
        return NextResponse.json({
          skipped: true,
          reason: "Previous analysis still running",
          runningFor: Math.round(timeSinceStart / 1000),
          startedAt: state.lastExecutionStartedAt,
        });
      } else {
        // Previous run exceeded max time - assume it died
        console.log("[Jeeves Cron] ⚠️ Previous run exceeded max time (4 min) - assuming crashed");
        console.log("[Jeeves Cron] Proceeding with new run...");
      }
    }

    // Check if nextAnalysisAt is reached
    if (state.nextAnalysisAt && new Date(state.nextAnalysisAt) > new Date()) {
      console.log("[Jeeves Cron] Skipped - Next analysis scheduled for", state.nextAnalysisAt);
      return NextResponse.json({
        skipped: true,
        reason: "Not yet time for next analysis",
        nextAnalysisAt: state.nextAnalysisAt,
      });
    }

    // Log scheduled trigger
    const executionId = crypto.randomUUID();
    await logActivity(executionId, "info", "🎩 Jeeves analysis started (triggered automatically by schedule)");

    // Run analysis
    console.log("[Jeeves Cron] Running analysis...");
    const result = await runJeevesAnalysis();

    console.log("[Jeeves Cron] Analysis complete");
    console.log("[Jeeves Cron] Discoveries:", result.discoveriesCount);
    console.log("[Jeeves Cron] Notifications:", result.notificationsCount);

    return NextResponse.json({
      success: result.success,
      discoveriesCount: result.discoveriesCount,
      notificationsCount: result.notificationsCount,
      executionTime: result.executionTime,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error("[Jeeves Cron] Error:", error);
    return NextResponse.json(
      {
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
