/**
 * Jeeves Orchestrator
 *
 * Main coordinator that runs the full analysis cycle:
 * Discovery → Visual Report → Personalized Notifications
 */

import crypto from "crypto";
import {
  getJeevesState,
  updateJeevesState,
  getRecentDiscoveries,
  createDiscovery,
  logActivity,
} from "@/lib/db/jeeves-queries";
import { runDiscovery } from "./discovery-engine";
import { inngest } from "../inngest/client";

/**
 * Analysis execution result
 */
export interface AnalysisResult {
  success: boolean;
  discoveriesCount: number;
  notificationsCount: number;
  discoveries: any[];
  errors: string[];
  executionTime: number;
}

/**
 * Calculate similarity score between two strings (0-1, where 1 is identical)
 * Uses simple token-based Jaccard similarity
 */
function calculateSimilarity(str1: string, str2: string): number {
  const tokens1 = new Set(str1.toLowerCase().split(/\s+/));
  const tokens2 = new Set(str2.toLowerCase().split(/\s+/));

  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

/**
 * Check if a discovery is similar to any recent discoveries
 * Returns true if discovery seems to be a duplicate
 */
function isDuplicateDiscovery(
  newDiscovery: { title: string; category: string; reasoning: string },
  recentDiscoveries: any[],
  similarityThreshold: number = 0.6
): boolean {
  for (const recent of recentDiscoveries) {
    const titleSimilarity = calculateSimilarity(newDiscovery.title, recent.title);
    const reasoningSimilarity = calculateSimilarity(
      newDiscovery.reasoning,
      recent.aiReasoning
    );

    // If title is very similar OR reasoning is very similar, consider it a duplicate
    if (titleSimilarity > similarityThreshold || reasoningSimilarity > similarityThreshold) {
      console.log(`[Jeeves] Potential duplicate detected:`);
      console.log(`  New: "${newDiscovery.title}"`);
      console.log(`  Recent: "${recent.title}"`);
      console.log(`  Title similarity: ${(titleSimilarity * 100).toFixed(1)}%`);
      console.log(`  Reasoning similarity: ${(reasoningSimilarity * 100).toFixed(1)}%`);
      return true;
    }
  }

  return false;
}

/**
 * Calculate next analysis time based on flexible interval format
 * Supports: "Nmin" (e.g., "5min", "30min", "90min") or "Nhour" (e.g., "1hour", "2hour", "6hour")
 */
function calculateNextAnalysis(interval: string): Date {
  const now = new Date();

  // Parse flexible format: "Nmin" or "Nhour"
  const minMatch = interval.match(/^(\d+)min$/);
  const hourMatch = interval.match(/^(\d+)hour$/);

  let milliseconds = 0;

  if (minMatch) {
    milliseconds = parseInt(minMatch[1]) * 60 * 1000;
  } else if (hourMatch) {
    milliseconds = parseInt(hourMatch[1]) * 60 * 60 * 1000;
  } else {
    // Fallback to 5 minutes if format is invalid
    console.warn(`[Jeeves] Invalid interval format: "${interval}" - falling back to 5min`);
    milliseconds = 5 * 60 * 1000;
  }

  return new Date(now.getTime() + milliseconds);
}

/**
 * Main Jeeves analysis orchestration
 */
export async function runJeevesAnalysis(): Promise<AnalysisResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const createdDiscoveries: any[] = [];
  const executionId = crypto.randomUUID();

  console.log("=".repeat(80));
  console.log("🎩 JEEVES ON DUTY - Starting Analysis");
  console.log("=".repeat(80));

  try {
    // Step 1: Get Jeeves state
    const state = await getJeevesState();
    if (!state) {
      throw new Error("Jeeves state not initialized");
    }

    console.log("[Jeeves] State loaded");
    console.log("[Jeeves] Enabled:", state.enabled);
    console.log("[Jeeves] Interval:", state.analysisInterval);
    console.log("[Jeeves] Monitored streams:", state.monitoredStreams);

    await logActivity(executionId, "info", `Monitoring ${(state.monitoredStreams as string[]).length} streams`);

    if (!state.enabled) {
      console.log("[Jeeves] ❌ Analysis skipped - Jeeves is disabled");
      await logActivity(executionId, "warning", "Analysis skipped - Jeeves is disabled");
      const executionTime = Date.now() - startTime;
      await logActivity(executionId, "info", `⏹️ Complete: Skipped (disabled) - ${(executionTime / 1000).toFixed(1)}s`);
      return {
        success: false,
        discoveriesCount: 0,
        notificationsCount: 0,
        discoveries: [],
        errors: ["Jeeves is disabled"],
        executionTime,
      };
    }

    // Step 1b: Check execution lock to prevent overlapping runs
    if (state.lastExecutionStartedAt) {
      const lockAge = Date.now() - new Date(state.lastExecutionStartedAt).getTime();
      const STALE_LOCK_THRESHOLD = 10 * 60 * 1000; // 10 minutes

      if (lockAge < STALE_LOCK_THRESHOLD) {
        console.log("[Jeeves] 🔒 Analysis already running - skipping to prevent duplicates");
        console.log(`[Jeeves] 🔒 Lock age: ${(lockAge / 1000).toFixed(1)}s`);
        await logActivity(executionId, "warning", `🔒 Skipped - analysis already running (${(lockAge / 1000).toFixed(1)}s old)`);
        const executionTime = Date.now() - startTime;
        await logActivity(executionId, "info", `⏹️ Complete: Skipped (execution lock) - ${(executionTime / 1000).toFixed(1)}s`);
        return {
          success: false,
          discoveriesCount: 0,
          notificationsCount: 0,
          discoveries: [],
          errors: ["Analysis already running - prevented duplicate execution"],
          executionTime,
        };
      } else {
        console.log(`[Jeeves] ⚠️ Stale lock detected (${(lockAge / 1000 / 60).toFixed(1)} min old) - proceeding`);
        await logActivity(executionId, "warning", `⚠️ Clearing stale lock (${(lockAge / 1000 / 60).toFixed(1)} min old)`);
      }
    }

    // Step 2: Set execution lock and update timestamps
    console.log("[Jeeves] Setting execution lock...");
    await updateJeevesState({
      lastAnalysisAt: new Date(),
      nextAnalysisAt: calculateNextAnalysis(state.analysisInterval),
      lastExecutionStartedAt: new Date(), // LOCK: Marks execution as in-progress
    });

    // Step 3: Get monitored streams
    const monitoredStreams = (state.monitoredStreams as string[]) || [];
    if (monitoredStreams.length === 0) {
      console.log("[Jeeves] ⚠️  No streams to monitor");
      await logActivity(executionId, "warning", "No monitored streams configured");
      const executionTime = Date.now() - startTime;
      await logActivity(executionId, "info", `⏹️ Complete: No streams configured - ${(executionTime / 1000).toFixed(1)}s`);

      // Clear execution lock
      await updateJeevesState({
        lastExecutionStartedAt: null,
      });

      return {
        success: true,
        discoveriesCount: 0,
        notificationsCount: 0,
        discoveries: [],
        errors: ["No monitored streams configured"],
        executionTime,
      };
    }

    // Step 4: Get recent discoveries for context
    const recentDiscoveries = await getRecentDiscoveries(24, 3);
    console.log("[Jeeves] Recent discoveries:", recentDiscoveries.length);

    // Step 5: Run discovery engine
    console.log("[Jeeves] 🔍 Running discovery engine on", monitoredStreams.length, "streams...");
    console.log("[Jeeves] Streams:", monitoredStreams.join(", "));
    await logActivity(executionId, "info", `🔍 Running discovery on ${monitoredStreams.length} streams: ${monitoredStreams.join(", ")}`);

    let discoveryResult;
    try {
      console.log("[Jeeves] >>> About to call runDiscovery");
      discoveryResult = await runDiscovery(monitoredStreams, recentDiscoveries);
      console.log("[Jeeves] <<< runDiscovery returned");
    } catch (discoveryError: any) {
      console.error("[Jeeves] ❌ Discovery failed:", discoveryError);
      console.error("[Jeeves] Error type:", discoveryError.constructor?.name);
      console.error("[Jeeves] Error message:", discoveryError.message);

      // Check if it's a rate limit timeout (expected behavior)
      const isRateLimitTimeout = discoveryError.message?.includes('Rate limit wait time') ||
                                  discoveryError.message?.includes('would exceed timeout');

      if (isRateLimitTimeout) {
        console.log("[Jeeves] ℹ️ Rate limit requires longer wait than timeout allows");
        console.log(`[Jeeves] Will retry in next scheduled run (${state.analysisInterval})`);
        await logActivity(executionId, "info", `Rate limit hit - will retry in next cycle (${state.analysisInterval})`);
        errors.push(`Rate limit - retrying in next cycle (${state.analysisInterval})`);
      } else {
        console.error("[Jeeves] Error stack:", discoveryError.stack);
        await logActivity(executionId, "error", `Discovery failed: ${discoveryError.message}`);
        errors.push(`Discovery failed: ${discoveryError.message}`);
      }

      const executionTime = Date.now() - startTime;
      await logActivity(executionId, "info", `⏹️ Complete: Discovery failed - ${(executionTime / 1000).toFixed(1)}s`);

      // Clear execution lock
      await updateJeevesState({
        lastExecutionStartedAt: null,
      });

      return {
        success: false,
        discoveriesCount: 0,
        notificationsCount: 0,
        discoveries: [],
        errors,
        executionTime,
      };
    }

    console.log("[Jeeves] ✅ Discovery complete!");
    console.log("[Jeeves] 🎯 Found", discoveryResult.discoveries.length, "potential discoveries");
    await logActivity(executionId, "success", `✅ Discovery complete: Found ${discoveryResult.discoveries.length} potential discoveries`);

    // Step 6: Filter out duplicate discoveries
    console.log("[Jeeves] 🔍 Filtering duplicates...");
    const uniqueDiscoveries = [];
    let duplicateCount = 0;

    for (const disc of discoveryResult.discoveries) {
      const isDupe = isDuplicateDiscovery(disc, recentDiscoveries);
      if (isDupe) {
        console.log(`[Jeeves] ⏭️  Skipping duplicate: "${disc.title}"`);
        await logActivity(executionId, "info", `⏭️ Skipped duplicate: "${disc.title}"`);
        duplicateCount++;
      } else {
        uniqueDiscoveries.push(disc);
      }
    }

    console.log(`[Jeeves] ✅ After deduplication: ${uniqueDiscoveries.length} unique discoveries`);
    await logActivity(executionId, "success", `✅ Filtered: ${uniqueDiscoveries.length} unique, ${duplicateCount} duplicates skipped`);

    // Step 7: Process each unique discovery
    let totalNotifications = 0;

    for (const disc of uniqueDiscoveries) {
      console.log("[Jeeves] 📊 Processing discovery:", disc.title);
      await logActivity(executionId, "info", `📊 Processing: ${disc.title}`);

      try {
        // Step 6a: Save discovery to database WITHOUT dashboard (will be added per persona)
        console.log("[Jeeves] 💾 Saving discovery to database...");
        const savedDiscovery = await createDiscovery({
          title: disc.title,
          category: disc.category,
          severity: disc.severity,
          confidence: String(disc.confidence),
          aiReasoning: disc.reasoning,
          aiEvidence: disc.evidence || {},
          aiHypothesis: disc.hypothesis,
          aiRecommendations: disc.recommendations || [],
          dashboardId: null, // No common dashboard - each persona gets their own
          dashboardSlug: null,
          visualReportUrl: null,
          personaDashboards: [], // Will be populated below
          intendedRecipients: disc.intendedRecipients || [],
          status: "new",
          metadata: {},
        });

        console.log(`[Jeeves] ✅ Discovery saved: ID=${savedDiscovery.id}`);
        await logActivity(executionId, "info", `💾 Discovery saved: ID=${savedDiscovery.id}`);
        createdDiscoveries.push(savedDiscovery);

        // Step 6b: Trigger Inngest background job for notification processing
        // Inngest can run as long as needed (no 5-minute timeout!)
        const recipients = disc.intendedRecipients || [];
        const recipientNames = recipients.map((r: any) => r.personaName).join(", ");
        console.log(`[Jeeves] 🔗 Triggering Inngest for discovery ${savedDiscovery.id}`);
        console.log(`[Jeeves] 🔗 Recipients (${recipients.length}): ${recipientNames}`);
        await logActivity(executionId, "info", `🔗 Sending event: discovery.completed (ID=${savedDiscovery.id}, ${recipients.length} recipients: ${recipientNames})`);

        try {
          await inngest.send({
            name: "discovery.completed",
            id: `discovery-${savedDiscovery.id}`, // IDEMPOTENCY: Prevents duplicate processing
            data: {
              discoveryId: savedDiscovery.id,
              executionId,
            },
          });

          totalNotifications += recipients.length; // Count queued notifications
          console.log(`[Jeeves] ✅ Inngest event sent: discovery.completed (ID=${savedDiscovery.id})`);
          await logActivity(executionId, "success", `✅ Event sent: discovery.completed (ID=${savedDiscovery.id})`);
        } catch (inngestError: any) {
          console.error(`[Jeeves] ❌ Failed to trigger Inngest:`, inngestError);
          await logActivity(executionId, "error", `❌ Inngest event failed (ID=${savedDiscovery.id}): ${inngestError.message}`);
          errors.push(`Inngest trigger failed: ${inngestError.message}`);
        }

      } catch (discError: any) {
        console.error("[Jeeves] Failed to process discovery:", discError);
        await logActivity(executionId, "error", `Processing failed: ${discError.message}`);
        errors.push(`Processing failed for "${disc.title}": ${discError.message}`);
      }
    }

    // Step 7: Summary
    const executionTime = Date.now() - startTime;
    console.log("=".repeat(80));
    console.log("🎩 JEEVES ANALYSIS COMPLETE");
    console.log("=".repeat(80));
    console.log("Discoveries:", createdDiscoveries.length);
    console.log("Notifications queued:", totalNotifications);
    console.log("Errors:", errors.length);
    console.log("Execution time:", (executionTime / 1000).toFixed(2), "seconds");
    console.log("=".repeat(80));

    await logActivity(executionId, "success", `🎩 Analysis complete: ${createdDiscoveries.length} discoveries, ${totalNotifications} notifications queued, ${(executionTime / 1000).toFixed(1)}s`);

    // Clear execution lock
    console.log("[Jeeves] Clearing execution lock...");
    await updateJeevesState({
      lastExecutionStartedAt: null, // UNLOCK: Execution finished
    });

    return {
      success: errors.length === 0,
      discoveriesCount: createdDiscoveries.length,
      notificationsCount: totalNotifications,
      discoveries: createdDiscoveries,
      errors,
      executionTime,
    };

  } catch (error: any) {
    console.error("[Jeeves] FATAL ERROR:", error);
    await logActivity(executionId, "error", `❌ Fatal error: ${error.message}`);
    errors.push(`Fatal error: ${error.message}`);

    const executionTime = Date.now() - startTime;
    await logActivity(executionId, "info", `⏹️ Complete: Fatal error - ${(executionTime / 1000).toFixed(1)}s`);

    // Clear execution lock even on error
    console.log("[Jeeves] Clearing execution lock (error path)...");
    try {
      await updateJeevesState({
        lastExecutionStartedAt: null, // UNLOCK: Execution finished (with error)
      });
    } catch (unlockError) {
      console.error("[Jeeves] Failed to clear lock:", unlockError);
    }

    return {
      success: false,
      discoveriesCount: 0,
      notificationsCount: 0,
      discoveries: [],
      errors,
      executionTime,
    };
  }
}
