/**
 * Telemetry Data Cleanup Worker
 *
 * Automatically deletes telemetry data older than 48 hours
 * to reduce database storage costs.
 *
 * Runs: Daily at 3:00 AM UTC
 */

import { inngest } from "@/lib/inngest/client";
import { db } from "@/lib/db/queries";
import { TelemetryTick, TelemetryAnomaly } from "@/lib/db/telemetry-ops";
import { lt } from "drizzle-orm";

const TTL_HOURS = 24;

export const telemetryCleanup = inngest.createFunction(
  {
    id: 'telemetry-cleanup',
    name: 'Telemetry Data Cleanup (24h TTL)',
    retries: 2,
  },
  { cron: '0 */6 * * *' }, // Every 6 hours (more frequent cleanup)
  async ({ step }) => {
    return await step.run('cleanup-old-data', async () => {
      console.log(`[Telemetry Cleanup] Starting cleanup of data older than ${TTL_HOURS} hours...`);

      const cutoffDate = new Date(Date.now() - TTL_HOURS * 60 * 60 * 1000);
      console.log(`[Telemetry Cleanup] Cutoff date: ${cutoffDate.toISOString()}`);

      try {
        // Count rows to be deleted (for logging)
        const ticksToDelete = await db
          .select()
          .from(TelemetryTick)
          .where(lt(TelemetryTick.ts, cutoffDate));

        const anomaliesToDelete = await db
          .select()
          .from(TelemetryAnomaly)
          .where(lt(TelemetryAnomaly.ts, cutoffDate));

        console.log(`[Telemetry Cleanup] Found ${ticksToDelete.length} ticks to delete`);
        console.log(`[Telemetry Cleanup] Found ${anomaliesToDelete.length} anomalies to delete`);

        // Delete old telemetry ticks
        const deletedTicks = await db
          .delete(TelemetryTick)
          .where(lt(TelemetryTick.ts, cutoffDate))
          .returning({ id: TelemetryTick.id });

        console.log(`[Telemetry Cleanup] ✓ Deleted ${deletedTicks.length} telemetry ticks`);

        // Delete old anomalies
        const deletedAnomalies = await db
          .delete(TelemetryAnomaly)
          .where(lt(TelemetryAnomaly.ts, cutoffDate))
          .returning({ id: TelemetryAnomaly.id });

        console.log(`[Telemetry Cleanup] ✓ Deleted ${deletedAnomalies.length} anomalies`);

        // Get remaining data stats
        const remainingTicks = await db
          .select()
          .from(TelemetryTick);

        console.log(`[Telemetry Cleanup] Remaining rows: ${remainingTicks.length}`);

        return {
          status: 'success',
          deletedTicks: deletedTicks.length,
          deletedAnomalies: deletedAnomalies.length,
          remainingTicks: remainingTicks.length,
          cutoffDate: cutoffDate.toISOString(),
          ttlHours: TTL_HOURS,
        };

      } catch (error: any) {
        console.error('[Telemetry Cleanup] Error during cleanup:', error);
        throw error;
      }
    });
  }
);
