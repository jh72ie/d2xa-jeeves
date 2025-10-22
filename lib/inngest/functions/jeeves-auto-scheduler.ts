/**
 * Jeeves Auto-Scheduler
 *
 * Runs every 5 minutes and checks if it's time to run Jeeves analysis
 * Based on the nextAnalysisAt timestamp in JeevesState
 */

import { inngest } from "@/lib/inngest/client";
import { getJeevesState } from "@/lib/db/jeeves-queries";
import { runJeevesAnalysis } from "@/lib/jeeves/orchestrator";

export const jeevesAutoScheduler = inngest.createFunction(
  {
    id: 'jeeves-auto-scheduler',
    name: 'Jeeves Auto-Scheduler',
    retries: 0,
  },
  { cron: '*/5 * * * *' }, // Every 5 minutes
  async ({ step }) => {
      // Added a delay to see if this is the reason it keeps retrieving older messages when it runs
      await step.sleep('wait-for-mqtt-data', '30s');

      return await step.run('check-and-run-jeeves', async () => {
      console.log('[Jeeves Scheduler] Checking if analysis is due...');

      try {
        const state = await getJeevesState();

        if (!state) {
          console.log('[Jeeves Scheduler] ❌ Jeeves not initialized');
          return { skipped: true, reason: 'Not initialized' };
        }

        if (!state.enabled) {
          console.log('[Jeeves Scheduler] ⏭️ Jeeves is disabled');
          return { skipped: true, reason: 'Disabled' };
        }

        // Check if previous run is still running (execution lock)
        if (state.lastExecutionStartedAt) {
          const lastStartTime = new Date(state.lastExecutionStartedAt).getTime();
          const timeSinceStart = Date.now() - lastStartTime;
          const MAX_EXECUTION_TIME = 240000; // 4 minutes

          if (timeSinceStart < MAX_EXECUTION_TIME) {
            console.log('[Jeeves Scheduler] ⏭️ Previous run still in progress');
            return {
              skipped: true,
              reason: 'Previous analysis still running',
              runningFor: Math.round(timeSinceStart / 1000),
            };
          } else {
            console.log('[Jeeves Scheduler] ⚠️ Previous run exceeded max time - assuming crashed');
          }
        }

        // Check if nextAnalysisAt is reached
        const now = new Date();
        const nextAnalysis = state.nextAnalysisAt ? new Date(state.nextAnalysisAt) : null;

        if (nextAnalysis && nextAnalysis > now) {
          const minutesUntil = Math.round((nextAnalysis.getTime() - now.getTime()) / 60000);
          console.log(`[Jeeves Scheduler] ⏭️ Not yet time (${minutesUntil}min until ${nextAnalysis.toISOString()})`);
          return {
            skipped: true,
            reason: 'Not yet time',
            nextAnalysisAt: nextAnalysis,
            minutesUntil,
          };
        }

        // Time to run!
        console.log('[Jeeves Scheduler] ✅ Running analysis...');
        const result = await runJeevesAnalysis();

        console.log('[Jeeves Scheduler] ✅ Analysis complete');
        console.log(`[Jeeves Scheduler] Discoveries: ${result.discoveriesCount}, Notifications: ${result.notificationsCount}`);

        return {
          success: result.success,
          discoveriesCount: result.discoveriesCount,
          notificationsCount: result.notificationsCount,
          executionTime: result.executionTime,
          errors: result.errors,
        };

      } catch (error: any) {
        console.error('[Jeeves Scheduler] ❌ Error:', error);
        return {
          success: false,
          error: error.message,
        };
      }
    });
  }
);
