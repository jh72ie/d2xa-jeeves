/**
 * Jeeves Manual Analysis Trigger
 *
 * POST: Trigger immediate analysis (bypass schedule)
 * Uses chain pattern: Discovery → Self-call to process notifications
 */

import { NextResponse } from "next/server";
import { after } from "next/server";
import crypto from "crypto";
import {
  getJeevesState,
  updateJeevesState,
  getRecentDiscoveries,
  createDiscovery,
  logActivity,
} from "@/lib/db/jeeves-queries";
import { runDiscovery } from "@/lib/jeeves/discovery-engine";
import { calculateNextAnalysis } from "@/lib/jeeves/orchestrator-utils";
import { inngest } from "@/lib/inngest/client";
import { auth } from "@/app/(auth)/auth";

export const maxDuration = 300; // 5 minutes for discovery only

/**
 * POST /api/jeeves/analyze
 *
 * Step 1: Run discovery engine
 * Step 2: Trigger Inngest background job for notification processing
 */
export async function POST(request: Request) {
  const executionId = crypto.randomUUID();
  const triggeredAt = new Date().toISOString();

  // Get user info for logging
  const session = await auth();
  const userName = session?.user?.name || session?.user?.email || "Unknown User";
  const triggerInfo = `manually by user: ${userName}`;

  console.log(`[Jeeves Trigger] Analysis request received - triggered ${triggerInfo}`);
  await logActivity(executionId, "info", `🎩 Jeeves analysis started (triggered ${triggerInfo})`);

  // Return immediately, continue in background
  after(async () => {
    const startTime = Date.now();
    console.log("[Jeeves] Starting analysis...");
    await logActivity(executionId, "info", "🔍 Beginning discovery phase");

    try {
      // Get state
      const state = await getJeevesState();
      if (!state || !state.enabled) {
        console.log("[Jeeves] Disabled, skipping");
        await logActivity(executionId, "warning", "Jeeves is disabled");
        return;
      }

      // Set lock
      await updateJeevesState({
        lastAnalysisAt: new Date(),
        nextAnalysisAt: calculateNextAnalysis(state.analysisInterval),
        lastExecutionStartedAt: new Date(),
      });

      const monitoredStreams = (state.monitoredStreams as string[]) || [];
      if (monitoredStreams.length === 0) {
        console.log("[Jeeves] No streams to monitor");
        await logActivity(executionId, "warning", "No monitored streams");
        await updateJeevesState({ lastExecutionStartedAt: null });
        return;
      }

      // Run discovery
      const recentDiscoveries = await getRecentDiscoveries(24, 3);
      console.log(`[Jeeves] Running discovery on ${monitoredStreams.length} streams...`);
      await logActivity(executionId, "info", `🔍 Analyzing ${monitoredStreams.length} streams`);

      const discoveryResult = await runDiscovery(monitoredStreams, recentDiscoveries);

      console.log(`[Jeeves] ✅ Discovery complete: ${discoveryResult.discoveries.length} found`);
      await logActivity(executionId, "success", `✅ Discovery: ${discoveryResult.discoveries.length} found`);

      // Filter duplicates (basic filter - detailed in orchestrator)
      const uniqueDiscoveries = discoveryResult.discoveries;

      // Save discoveries and chain to notification processing
      for (const disc of uniqueDiscoveries) {
        const savedDiscovery = await createDiscovery({
          title: disc.title,
          category: disc.category,
          severity: disc.severity,
          confidence: String(disc.confidence),
          aiReasoning: disc.reasoning,
          aiEvidence: disc.evidence || {},
          aiHypothesis: disc.hypothesis,
          aiRecommendations: disc.recommendations || [],
          dashboardId: null,
          dashboardSlug: null,
          visualReportUrl: null,
          personaDashboards: [],
          intendedRecipients: disc.intendedRecipients || [],
          status: "new",
          metadata: {},
        });

        console.log(`[Jeeves] 📊 Discovery saved: ${disc.title}`);
        await logActivity(executionId, "info", `📊 Saved: ${disc.title}`);

        // Trigger Inngest background job for notification processing
        console.log(`[Jeeves] 🔗 Triggering Inngest job for discovery ${savedDiscovery.id}`);
        await logActivity(executionId, "info", `🔗 Triggering notification job`);

        try {
          await inngest.send({
            name: "discovery.completed",
            data: {
              discoveryId: savedDiscovery.id,
              executionId,
            },
          });

          console.log(`[Jeeves] ✅ Inngest job triggered for discovery ${savedDiscovery.id}`);
          await logActivity(executionId, "success", `✅ Notification job queued`);
        } catch (inngestError: any) {
          console.error(`[Jeeves] ❌ Failed to trigger Inngest:`, inngestError);
          await logActivity(executionId, "error", `Inngest trigger failed: ${inngestError.message}`);
        }
      }

      // Clear lock
      await updateJeevesState({ lastExecutionStartedAt: null });

      const executionTime = Date.now() - startTime;
      console.log(`[Jeeves] ✅ Analysis complete in ${(executionTime / 1000).toFixed(1)}s`);
      await logActivity(executionId, "success", `🎩 Complete: ${uniqueDiscoveries.length} discoveries, ${(executionTime / 1000).toFixed(1)}s`);

    } catch (error: any) {
      console.error("[Jeeves] ❌ Fatal error:", error);
      await logActivity(executionId, "error", `❌ Fatal: ${error.message}`);
      await updateJeevesState({ lastExecutionStartedAt: null });
    }
  });

  // Immediate response
  return NextResponse.json({
    success: true,
    message: "Analysis started in background",
    note: "Check activity logs for progress",
    executionId,
    triggeredAt,
  });
}
